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
    const rawWebBaseUrl = this.configService.get<string>('webBaseUrl');
    const webBaseUrl = (rawWebBaseUrl || 'http://localhost:3000').replace(
      /\/+$/,
      '',
    );
    const webViewUrl = `${webBaseUrl}/ads/${requestId}`;
    const isPublicWebUrl = this.isValidTelegramButtonUrl(webViewUrl);

    await ctx.answerCbQuery('🌐 Открытие Web-страницы...');
    if (isPublicWebUrl) {
      await ctx.reply(
        `🌐 <b>Web-страница объявления готова:</b>\n\nСсылка для просмотра и быстрого копирования:\n<a href="${webViewUrl}">${webViewUrl}</a>`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.url('🌐 Открыть в браузере', webViewUrl)],
          ]),
        },
      );
    } else {
      await ctx.reply(
        `🌐 <b>Web-страница объявления готова:</b>\n\nЛокальный адрес для просмотра:\n<code>${webViewUrl}</code>\n\n<i>(Для отображения кликабельной кнопки в Telegram настройте публичный WEB_BASE_URL в .env)</i>`,
        {
          parse_mode: 'HTML',
        },
      );
    }
  }

  @Action(/^autopublish:(.+)$/)
  async onAutoPublishAction(@Ctx() ctx: Context) {
    await ctx.answerCbQuery('🚀 Автопубликация');
    await ctx.reply(
      '🚀 Прямая автопубликация на площадки (Yad2, Facebook) запланирована в рамках этапа SH-04.',
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

    const detectedCity = this.detectIsraeliCity(text);

    // 1. Create sale request record in DB
    const saleRequest = await this.adsService.createSaleRequest(
      userId,
      text,
      undefined,
      detectedCity,
    );

    // 2. Perform AI analysis using Gemini
    const analysis = await this.aiService.analyzeItem({
      text,
      city: detectedCity,
    });

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

    const detectedCity = this.detectIsraeliCity(caption);

    const saleRequest = await this.adsService.createSaleRequest(
      userId,
      caption || 'Фотография товара от пользователя',
      undefined,
      detectedCity,
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
        'Определи товар по предоставленному фото, оцени состояние и рыночную стоимость для Израиля.',
      city: detectedCity,
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
      text: 'Расшифруй и проанализируй голосовое описание товара для продажи в Израиле.',
      audio: audioBase64
        ? { base64: audioBase64, mimeType: 'audio/ogg' }
        : undefined,
    });

    await this.adsService.saveAnalysisResult(saleRequest.id, analysis);
    await this.replyWithAnalysis(ctx, analysis, saleRequest.id);
  }

  private detectIsraeliCity(text: string): string | undefined {
    if (!text) return undefined;
    const lower = text.toLowerCase();
    const cityMap: [RegExp, string][] = [
      [/тель[- ]авив|tel[- ]aviv|תל[- ]אביב/i, 'Тель-Авив'],
      [/иерусалим|jerusalem|ירושלים/i, 'Иерусалим'],
      [/хайф[аеыу]|haifa|חיפה/i, 'Хайфа'],
      [/нетан[иь][яеию]|netanya|נתניה/i, 'Нетания'],
      [/бат[- ]ям|bat[- ]yam|בת[- ]ים/i, 'Бат-Ям'],
      [/ришон[- ]ле[- ]цион|ришон|rishon|ראשון לציון/i, 'Ришон-ле-Цион'],
      [/ашдод|ashdod|אשדוד/i, 'Ашдод'],
      [/ашкелон|ashkelon|אשקלון/i, 'Ашкелон'],
      [/беэр[- ]шев[аеы]|beer[- ]sheva|באר שבע/i, 'Беэр-Шева'],
      [/петах[- ]тикв[аеы]|petah[- ]tikva|פתח תקווה/i, 'Петах-Тиква'],
      [/холон|holon|חולון/i, 'Холон'],
      [/рамат[- ]ган|ramat[- ]gan|רמת גן/i, 'Рамат-Ган'],
      [/герцли[ияе]|herzliya|הרצליה/i, 'Герцлия'],
      [/реховот|rehovot|רחובות/i, 'Реховот'],
      [/кфар[- ]саб[аеы]|kfar[- ]saba|כפר סבא/i, 'Кфар-Саба'],
      [/раанан[аеы]|ra'anana|raanana|רעננה/i, 'Раанана'],
    ];

    for (const [pattern, name] of cityMap) {
      if (pattern.test(lower)) {
        return name;
      }
    }
    return undefined;
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
    if (analysis.city) {
      lines.push(`📍 <b>Город:</b> ${this.escapeHtml(analysis.city)}, Израиль`);
    } else {
      lines.push(`📍 <b>Локация:</b> <i>Израиль (город не указан)</i>`);
    }
    lines.push('');

    // Price Estimation
    lines.push(`💰 <b>Оценка стоимости:</b>`);
    const curr =
      analysis.priceEstimation.currency === 'ILS'
        ? '₪'
        : analysis.priceEstimation.currency;
    lines.push(
      `• Диапазон: <code>${analysis.priceEstimation.min} — ${analysis.priceEstimation.max} ${curr}</code>`,
    );
    lines.push(
      `• Рекомендуемая цена: <b>${analysis.priceEstimation.recommended} ${curr}</b>`,
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

    // Photo Guidance
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
          `🎨 <i>Промпт:</i> <code>${this.escapeHtml(analysis.suggestedPhotoPrompt)}</code>`,
        );
      }
    }
    lines.push('');

    // Clarifying Questions if incomplete
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

    // Generated Ads
    if (analysis.ads && analysis.ads.length > 0) {
      lines.push(`📝 <b>Готовые тексты объявлений:</b>`);
      for (const ad of analysis.ads) {
        const langBadge = ad.language ? ` (${ad.language})` : '';
        lines.push(`\n━━━━━━━━━━━━━━━━━━`);
        lines.push(
          `<b>[${ad.platform}${langBadge}] ${this.escapeHtml(ad.title)}</b>`,
        );
        lines.push(`${this.escapeHtml(ad.content)}`);
      }
    }

    // Recommended Facebook Channels & Communities
    if (analysis.facebookChannels && analysis.facebookChannels.length > 0) {
      lines.push('');
      lines.push(`📢 <b>Топ-5 каналов и групп Facebook для размещения:</b>`);
      const topChannels = analysis.facebookChannels.slice(0, 5);
      topChannels.forEach((ch, idx) => {
        const langBadge = ch.language ? ` [${ch.language}]` : '';
        const escapedName = this.escapeHtml(ch.name);
        const desc = ch.description
          ? ` — <i>${this.escapeHtml(ch.description)}</i>`
          : '';
        lines.push(
          `${idx + 1}. <a href="${ch.url}">${escapedName}</a>${langBadge}${desc}`,
        );
      });
    }

    const rawWebBaseUrl = this.configService.get<string>('webBaseUrl');
    const webBaseUrl = (rawWebBaseUrl || 'http://localhost:3000').replace(
      /\/+$/,
      '',
    );
    const webViewUrl = `${webBaseUrl}/ads/${saleRequestId}`;
    const isPublicWebUrl = this.isValidTelegramButtonUrl(webViewUrl);

    if (!isPublicWebUrl) {
      lines.push('');
      lines.push(`🌐 <b>Web-версия (локально):</b> <code>${webViewUrl}</code>`);
    }

    const actionButtons = [];
    if (isPublicWebUrl) {
      actionButtons.push(
        Markup.button.url('🌐 Просмотр Web-версии', webViewUrl),
      );
    }
    actionButtons.push(
      Markup.button.callback('🚀 Опубликовать', `autopublish:${saleRequestId}`),
    );

    const inlineKeyboard = Markup.inlineKeyboard([actionButtons]);
    const chunks = this.chunkLines(lines, 3800);

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      const extra = isLast ? inlineKeyboard : undefined;
      await this.sendChunk(ctx, chunks[i], extra);
    }
  }

  private async sendChunk(
    ctx: Context,
    text: string,
    extra?: any,
  ): Promise<void> {
    try {
      if (extra) {
        await ctx.reply(text, {
          parse_mode: 'HTML',
          ...extra,
        });
      } else {
        await ctx.reply(text, {
          parse_mode: 'HTML',
        });
      }
    } catch (e) {
      this.logger.warn(
        `Failed to send HTML formatted message, falling back to plain text: ${(e as Error).message}`,
      );
      const plainText = text.replace(/<[^>]*>/g, '');
      try {
        if (extra) {
          await ctx.reply(plainText, extra);
        } else {
          await ctx.reply(plainText);
        }
      } catch (innerError) {
        this.logger.error(
          `Failed to send message with keyboard: ${(innerError as Error).message}. Sending plain text without keyboard.`,
        );
        try {
          await ctx.reply(plainText);
        } catch (finalError) {
          this.logger.error(
            `Failed to send plain text message: ${(finalError as Error).message}`,
          );
        }
      }
    }
  }

  private chunkLines(lines: string[], maxLength = 3800): string[] {
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const rawLine of lines) {
      const subLines: string[] = [];
      if (rawLine.length > maxLength) {
        let remaining = rawLine;
        while (remaining.length > maxLength) {
          let splitIdx = remaining.lastIndexOf('\n', maxLength);
          if (splitIdx === -1 || splitIdx < maxLength / 2) {
            splitIdx = remaining.lastIndexOf(' ', maxLength);
          }
          if (splitIdx === -1 || splitIdx < maxLength / 2) {
            splitIdx = maxLength;
          }

          // Avoid slicing across an HTML entity like &quot; or &#39;
          const ampIndex = remaining.lastIndexOf('&', splitIdx);
          const semiIndex = remaining.lastIndexOf(';', splitIdx);
          if (
            ampIndex !== -1 &&
            ampIndex > semiIndex &&
            splitIdx - ampIndex < 10
          ) {
            splitIdx = ampIndex;
          }

          subLines.push(remaining.slice(0, splitIdx));
          remaining = remaining.slice(splitIdx).trimStart();
        }
        if (remaining.length > 0) {
          subLines.push(remaining);
        }
      } else {
        subLines.push(rawLine);
      }

      for (const line of subLines) {
        const addedLength =
          currentChunk.length === 0 ? line.length : line.length + 1;
        if (currentLength + addedLength > maxLength && currentChunk.length > 0) {
          chunks.push(currentChunk.join('\n'));
          currentChunk = [line];
          currentLength = line.length;
        } else {
          currentChunk.push(line);
          currentLength += addedLength;
        }
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks.length > 0 ? chunks : [''];
  }

  private isValidTelegramButtonUrl(urlStr: string): boolean {
    try {
      const parsed = new URL(urlStr);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
      }
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        !hostname.includes('.')
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
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
