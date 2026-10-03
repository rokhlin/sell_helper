import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegrafExecutionContext } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { ACCESS_DENIED_MESSAGE } from '../telegram.constants';

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly logger = new Logger(TelegramAuthGuard.name);
  private readonly authorizedUsers: string[];

  constructor(private readonly configService: ConfigService) {
    const rawUsers =
      this.configService.get<string[]>('telegram.authorizedUsers') || [];
    this.authorizedUsers = rawUsers.map((id) => String(id).trim());
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const telegrafContext = TelegrafExecutionContext.create(context);
    const ctx = telegrafContext.getContext<Context>();

    const userId = ctx.from?.id != null ? String(ctx.from.id) : null;

    if (!userId || !this.authorizedUsers.includes(userId)) {
      this.logger.warn(
        `Unauthorized access attempt from Telegram User ID: ${userId || 'unknown'}`,
      );
      if (typeof ctx.reply === 'function') {
        try {
          await ctx.reply(ACCESS_DENIED_MESSAGE);
        } catch (error) {
          this.logger.error(
            `Failed to send access denied reply: ${(error as Error).message}`,
          );
        }
      }
      return false;
    }

    return true;
  }
}
