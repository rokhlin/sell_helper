import { UseGuards, Logger } from '@nestjs/common';
import { Update, Start, Help, On, Ctx } from 'nestjs-telegraf';
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
    await this.telegramService.syncUser(ctx);
    const welcome = this.telegramService.getWelcomeMessage();
    await ctx.reply(welcome, { parse_mode: 'Markdown' });
  }

  @Help()
  async onHelp(@Ctx() ctx: Context) {
    const help = this.telegramService.getHelpMessage();
    await ctx.reply(help, { parse_mode: 'Markdown' });
  }

  @On('text')
  async onText(@Ctx() ctx: Context) {
    // Basic interaction handler acknowledging receipt for authorized users
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
