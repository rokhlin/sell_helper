import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { TelegrafExecutionContext } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { TelegramService } from '../telegram.service';
import {
  PENDING_ACCESS_MESSAGE,
  ALREADY_PENDING_MESSAGE,
  REJECTED_ACCESS_MESSAGE,
} from '../telegram.constants';

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly logger = new Logger(TelegramAuthGuard.name);

  constructor(private readonly telegramService: TelegramService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const telegrafContext = TelegrafExecutionContext.create(context);
    const ctx = telegrafContext.getContext<Context>();

    const userId = ctx.from?.id != null ? String(ctx.from.id) : null;

    if (!userId) {
      this.logger.warn('Access attempt with missing Telegram User ID.');
      return false;
    }

    // 1. Handle Callback Queries (e.g., inline buttons from admin)
    if (ctx.callbackQuery) {
      const user = await this.telegramService.getUser(userId);
      if (user?.role === 'ADMIN') {
        return true;
      }
      this.logger.warn(
        `Non-admin user ${userId} attempted callback action: ${JSON.stringify(
          ctx.callbackQuery,
        )}`,
      );
      if (typeof ctx.answerCbQuery === 'function') {
        try {
          await ctx.answerCbQuery(
            '⛔ Действие доступно только администратору.',
            { show_alert: true },
          );
        } catch (error) {
          this.logger.error(
            `Failed to answer callback query: ${(error as Error).message}`,
          );
        }
      }
      return false;
    }

    // 2. First-User Admin Bootstrapping Check
    const admin = await this.telegramService.findAdmin();
    if (!admin) {
      this.logger.log(
        `No admin registered yet. User ${userId} will be bootstrapped as the first ADMIN.`,
      );
      await this.telegramService.syncUser(ctx);
      return true;
    }

    // 3. User Authorization Check
    const user = await this.telegramService.getUser(userId);

    if (user?.isAuthorized) {
      return true;
    }

    // 4. Handle Rejected State
    if (user?.status === 'REJECTED') {
      this.logger.warn(`Rejected user ${userId} attempted access to bot.`);
      if (typeof ctx.reply === 'function') {
        try {
          await ctx.reply(REJECTED_ACCESS_MESSAGE, { parse_mode: 'Markdown' });
        } catch (error) {
          this.logger.error(
            `Failed to send rejected message: ${(error as Error).message}`,
          );
        }
      }
      return false;
    }

    // 5. Handle Already Pending State
    if (user?.status === 'PENDING') {
      this.logger.log(
        `Pending user ${userId} attempted access while awaiting approval.`,
      );
      if (typeof ctx.reply === 'function') {
        try {
          await ctx.reply(ALREADY_PENDING_MESSAGE, { parse_mode: 'Markdown' });
        } catch (error) {
          this.logger.error(
            `Failed to send already pending message: ${(error as Error).message}`,
          );
        }
      }
      return false;
    }

    // 6. First-time unknown user: Record as PENDING, inform user, and notify Administrator
    this.logger.log(
      `New user ${userId} requesting access. Registering as PENDING and notifying admin.`,
    );
    await this.telegramService.syncUser(ctx);

    if (typeof ctx.reply === 'function') {
      try {
        await ctx.reply(PENDING_ACCESS_MESSAGE, { parse_mode: 'Markdown' });
      } catch (error) {
        this.logger.error(
          `Failed to send pending notice: ${(error as Error).message}`,
        );
      }
    }

    await this.telegramService.notifyAdminNewRequest(ctx, userId);
    return false;
  }
}
