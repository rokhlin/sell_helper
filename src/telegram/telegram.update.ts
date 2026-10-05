import { UseGuards, Logger } from '@nestjs/common';
import { Update, Start, Help, On, Action, Ctx } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
import { TelegramService } from './telegram.service';

@Update()
@UseGuards(TelegramAuthGuard)
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);

  constructor(private readonly telegramService: TelegramService) {}

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

  @On('text')
  async onText(@Ctx() ctx: Context) {
    await ctx.reply(
      '📝 Got your message! Item description received. When AI analysis is enabled, I will parse the item details and estimate market prices.',
    );
  }

  @On('photo')
  async onPhoto(@Ctx() ctx: Context) {
    await ctx.reply(
      '📷 Photo received! I will inspect this photo once the AI module is initialized.',
    );
  }

  @On('voice')
  async onVoice(@Ctx() ctx: Context) {
    await ctx.reply(
      '🎙️ Voice message received! Voice transcription will process your description.',
    );
  }
}
