import { UseGuards, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Update, Start, Help, On, Action, Ctx } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
import { TelegramService } from './telegram.service';
import { AiService } from '../ai/ai.service';
import { AdsService } from '../ads/ads.service';
import { AiAnalysisResult } from '../ai/ai.types';

@Update()
@UseGuards(TelegramAuthGuard)
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly aiService: AiService,
    private readonly adsService: AdsService,
    private readonly configService: ConfigService,
  ) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const user = await this.telegramService.syncUser(ctx);
    const welcome =
      user?.role === 'ADMIN'
        ? this.telegramService.getAdminWelcomeMessage()
        : this.telegramService.getWelcomeMessage();
    await ctx.reply(welcome, { parse_mode: 'Markdown' });
  }

  @Help()
  async onHelp(@Ctx() ctx: Context) {
    const help = this.telegramService.getHelpMessage();
    await ctx.reply(help, { parse_mode: 'Markdown' });
  }

  @Action(/^approve:(.+)$/)
  async onApproveUser(@Ctx() ctx: Context) {
    const match = (ctx as unknown as { match: RegExpMatchArray }).match;
    const targetUserId = match?.[1];

    if (!targetUserId) {
      await ctx.answerCbQuery('Ошибка: ID пользователя не найден.');
      return;
    }

    this.logger.log(`Admin approved access for user: ${targetUserId}`);
    await this.telegramService.approveUser(targetUserId, ctx);

    try {
      await ctx.answerCbQuery('✅ Пользователь подтвержден');
      await ctx.editMessageText(
        `✅ *Пользователь подтвержден!*\n\nПользователю с ID: \`${targetUserId}\` предоставлен полный доступ к боту.`,
        { parse_mode: 'Markdown' },
      );
    } catch (error) {
      this.logger.error(
        `Failed to update admin message after approval: ${(error as Error).message}`,
      );
    }
  }

  @Action(/^reject:(.+)$/)
  async onRejectUser(@Ctx() ctx: Context) {
    const match = (ctx as unknown as { match: RegExpMatchArray }).match;
    const targetUserId = match?.[1];

    if (!targetUserId) {
      await ctx.answerCbQuery('Ошибка: ID пользователя не найден.');
      return;
    }

    this.logger.log(`Admin rejected access for user: ${targetUserId}`);
    await this.telegramService.rejectUser(targetUserId);

    try {
      await ctx.answerCbQuery('❌ Запрос отклонен');
      await ctx.editMessageText(
        `❌ *Запрос отклонен*\n\nПользователю с ID: \`${targetUserId}\` доступ к боту не предоставлен.`,
        { parse_mode: 'Markdown' },
      );
    } catch (error) {
      this.logger.error(
        `Failed to update admin message after rejection: ${(error as Error).message}`,
      );
    }
  }

  @Action(/^webview:(.+)$/)
  async onWebViewAction(@Ctx() ctx: Context) {
    const match = (ctx as unknown as { match: RegExpMatchArray }).match;
    const requestId = match?.[1];
    const webBaseUrl =
      this.configService.get<string>('webBaseUrl') || 'http://localhost:3000';
    const webViewUrl = `${webBaseUrl}/ads/${requestId}`;

    await ctx.answerCbQuery('🌐 Открытие Web-страницы...');
    await ctx.reply(
      `🌐 <b>Web-страница объявления готова:</b>\n\nСсылка для просмотра и быстрого копирования:\n<a href="${webViewUrl}">${webViewUrl}</a>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.url('🌐 Открыть в браузере', webViewUrl)],
        ]),
      },
    );
  }

  @Action(/^autopublish:(.+)$/)
  async onAutoPublishAction(@Ctx() ctx: Context) {
    await ctx.answerCbQuery('🚀 Автопубликация');
    await ctx.reply(
      '🚀 Прямая автопубликация на площадки (Avito, Kufar, Facebook) запланирована в рамках этапа SH-04.',
    );
  }

  @On('text')
  async onText(@Ctx() ctx: Context) {
    const userId = ctx.from?.id != null ? String(ctx.from.id) : null;
    const message = ctx.message as any;
    const text = message?.text;

    if (!text || !userId) {
      return;
    }

    this.logger.log(
      `Processing text input from user ${userId}: "${text.substring(0, 60)}..."`,
    );
    await this.safelySendChatAction(ctx, 'typing');

    // 1. Create sale request record in DB
    const saleRequest = await this.adsService.createSaleRequest(userId, text);

    // 2. Perform AI analysis using Gemini
    const analysis = await this.aiService.analyzeItem({ text });

    // 3. Persist analysis results & generated ads
    await this.adsService.saveAnalysisResult(saleRequest.id, analysis);

    // 4. Send response to user
    await this.replyWithAnalysis(ctx, analysis, saleRequest.id);
  }

  @On('photo')
  async onPhoto(@Ctx() ctx: Context) {
    const userId = ctx.from?.id != null ? String(ctx.from.id) : null;
    const message = ctx.message as any;
    const photos = message?.photo;
    const caption = message?.caption || '';

    if (!photos || photos.length === 0 || !userId) {
      return;
    }

    const photo = photos[photos.length - 1]; // Highest resolution
    this.logger.log(
      `Processing photo input from user ${userId}, file_id: ${photo.file_id}`,
    );
    await this.safelySendChatAction(ctx, 'typing');

    const saleRequest = await this.adsService.createSaleRequest(
      userId,
      caption || 'Фотография товара от пользователя',
    );
    await this.adsService.attachMedia(saleRequest.id, 'IMAGE', photo.file_id);

    // Download image buffer from Telegram if possible
    let imageBase64: string | undefined;
    try {
      if (ctx.telegram && typeof ctx.telegram.getFileLink === 'function') {
        const link = await ctx.telegram.getFileLink(photo.file_id);
        const res = await fetch(link.href);
        const arrayBuf = await res.arrayBuffer();
        imageBase64 = Buffer.from(arrayBuf).toString('base64');
      }
    } catch (e) {
      this.logger.warn(`Failed to fetch photo buffer: ${(e as Error).message}`);
    }

    const analysis = await this.aiService.analyzeItem({
      text:
        caption ||
        'Определи товар по предоставленному фото, оцени состояние и рыночную стоимость.',
      images: imageBase64
        ? [{ base64: imageBase64, mimeType: 'image/jpeg' }]
        : undefined,
    });

    await this.adsService.saveAnalysisResult(saleRequest.id, analysis);
    await this.replyWithAnalysis(ctx, analysis, saleRequest.id);
  }

  @On('voice')
  async onVoice(@Ctx() ctx: Context) {
    const userId = ctx.from?.id != null ? String(ctx.from.id) : null;
    const message = ctx.message as any;
    const voice = message?.voice;

    if (!voice || !userId) {
      return;
    }

    this.logger.log(
      `Processing voice message from user ${userId}, file_id: ${voice.file_id}`,
    );
    await this.safelySendChatAction(ctx, 'record_voice');

    const saleRequest = await this.adsService.createSaleRequest(
      userId,
      'Голосовое описание товара',
    );
    await this.adsService.attachMedia(saleRequest.id, 'AUDIO', voice.file_id);

    let audioBase64: string | undefined;
    try {
      if (ctx.telegram && typeof ctx.telegram.getFileLink === 'function') {
        const link = await ctx.telegram.getFileLink(voice.file_id);
        const res = await fetch(link.href);
        const arrayBuf = await res.arrayBuffer();
        audioBase64 = Buffer.from(arrayBuf).toString('base64');
      }
    } catch (e) {
      this.logger.warn(`Failed to fetch voice buffer: ${(e as Error).message}`);
    }

    const analysis = await this.aiService.analyzeItem({
      text: 'Расшифруй и проанализируй голосовое описание товара для продажи.',
      audio: audioBase64
        ? { base64: audioBase64, mimeType: 'audio/ogg' }
        : undefined,
    });

    await this.adsService.saveAnalysisResult(saleRequest.id, analysis);
    await this.replyWithAnalysis(ctx, analysis, saleRequest.id);
  }

  private async replyWithAnalysis(
    ctx: Context,
    analysis: AiAnalysisResult,
    saleRequestId: string,
  ) {
    const lines: string[] = [];

    // Header & Item Summary
    lines.push(`🏷 <b>Товар:</b> ${this.escapeHtml(analysis.itemTitle)}`);
    lines.push(`📂 <b>Категория:</b> ${this.escapeHtml(analysis.category)}`);
    lines.push(`✨ <b>Состояние:</b> ${this.escapeHtml(analysis.condition)}`);
    lines.push('');

    // Price Estimation
    lines.push(`💰 <b>Оценка стоимости:</b>`);
    lines.push(
      `• Диапазон: <code>${analysis.priceEstimation.min} — ${analysis.priceEstimation.max} ${this.escapeHtml(analysis.priceEstimation.currency)}</code>`,
    );
    lines.push(
      `• Рекомендуемая цена продажи: <b>${analysis.priceEstimation.recommended} ${this.escapeHtml(analysis.priceEstimation.currency)}</b>`,
    );
    lines.push(
      `💡 <i>${this.escapeHtml(analysis.priceEstimation.reasoning)}</i>`,
    );
    lines.push('');

    // Platforms
    lines.push(
      `🎯 <b>Рекомендуемые площадки:</b> ${analysis.recommendedPlatforms.join(', ')}`,
    );
    lines.push('');

    // Photo Guidance (AC-2)
    if (analysis.hasPhoto) {
      lines.push(`📸 <b>Фото:</b> Прикреплено к описанию.`);
    } else {
      lines.push(`📸 <b>Фотографии:</b> <i>Не прикреплены</i>`);
      if (analysis.photoRecommendations) {
        lines.push(
          `💡 <i>Совет:</i> ${this.escapeHtml(analysis.photoRecommendations)}`,
        );
      }
      if (analysis.suggestedPhotoPrompt) {
        lines.push(
          `🎨 <i>Промпт для поиска/генерации:</i> <code>${this.escapeHtml(analysis.suggestedPhotoPrompt)}</code>`,
        );
      }
    }
    lines.push('');

    // Clarifying Questions if incomplete (AC-3, AC-4)
    if (
      !analysis.isComplete &&
      analysis.clarifyingQuestions &&
      analysis.clarifyingQuestions.length > 0
    ) {
      lines.push(`❓ <b>Для более точной оценки не хватает деталей:</b>`);
      analysis.clarifyingQuestions.forEach((q, idx) => {
        lines.push(`${idx + 1}. ${this.escapeHtml(q)}`);
      });
      lines.push(
        `<i>Вы можете просто ответить на эти вопросы следующим сообщением.</i>`,
      );
      lines.push('');
    }

    // Generated Ads (AC-6)
    if (analysis.ads && analysis.ads.length > 0) {
      lines.push(`📝 <b>Готовые тексты объявлений:</b>`);
      for (const ad of analysis.ads) {
        lines.push(`\n━━━━━━━━━━━━━━━━━━`);
        lines.push(`<b>[${ad.platform}] ${this.escapeHtml(ad.title)}</b>`);
        lines.push(`${this.escapeHtml(ad.content)}`);
      }
    }

    const messageText = lines.join('\n');

    const webBaseUrl =
      this.configService.get<string>('webBaseUrl') || 'http://localhost:3000';
    const webViewUrl = `${webBaseUrl}/ads/${saleRequestId}`;

    const inlineKeyboard = Markup.inlineKeyboard([
      [
        Markup.button.url('🌐 Просмотр Web-версии', webViewUrl),
        Markup.button.callback(
          '🚀 Опубликовать',
          `autopublish:${saleRequestId}`,
        ),
      ],
    ]);

    try {
      await ctx.reply(messageText, {
        parse_mode: 'HTML',
        ...inlineKeyboard,
      });
    } catch (e) {
      this.logger.warn(
        `Failed to send HTML formatted message, falling back to plain text: ${(e as Error).message}`,
      );
      await ctx.reply(
        lines.map((l) => l.replace(/<[^>]*>/g, '')).join('\n'),
        inlineKeyboard,
      );
    }
  }

  private async safelySendChatAction(
    ctx: Context,
    action: 'typing' | 'record_voice',
  ) {
    try {
      if (typeof ctx.sendChatAction === 'function') {
        await ctx.sendChatAction(action);
      }
    } catch (e) {
      this.logger.debug(`Could not send chat action: ${(e as Error).message}`);
    }
  }

  private escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
