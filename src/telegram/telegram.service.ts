import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Context } from 'telegraf';
import { WELCOME_MESSAGE, HELP_MESSAGE } from './telegram.constants';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncUser(ctx: Context) {
    if (!ctx.from) return null;

    const {
      id,
      username,
      first_name: firstName,
      last_name: lastName,
    } = ctx.from;
    const userId = String(id);

    try {
      const user = await this.prisma.user.upsert({
        where: { id: userId },
        update: {
          username: username || null,
          firstName: firstName || null,
          lastName: lastName || null,
          isAuthorized: true,
        },
        create: {
          id: userId,
          username: username || null,
          firstName: firstName || null,
          lastName: lastName || null,
          isAuthorized: true,
        },
      });
      return user;
    } catch (error) {
      this.logger.error(
        `Failed to sync user ${userId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  getWelcomeMessage(): string {
    return WELCOME_MESSAGE;
  }

  getHelpMessage(): string {
    return HELP_MESSAGE;
  }
}
