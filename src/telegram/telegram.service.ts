import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Context, Markup } from 'telegraf';
import {
  WELCOME_MESSAGE,
  HELP_MESSAGE,
  ADMIN_WELCOME_MESSAGE,
  BUTTON_CONFIRM_TEXT,
  BUTTON_DELETE_TEXT,
  ACCESS_APPROVED_NOTIFICATION,
} from './telegram.constants';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAdmin() {
    try {
      return await this.prisma.user.findFirst({
        where: { role: 'ADMIN' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to find admin in database: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async isFirstUser(): Promise<boolean> {
    const admin = await this.findAdmin();
    return !admin;
  }

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
      const existing = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (existing) {
        return await this.prisma.user.update({
          where: { id: userId },
          data: {
            username: username || null,
            firstName: firstName || null,
            lastName: lastName || null,
          },
        });
      }

      // If no admin exists in the system, this user automatically becomes the first ADMIN
      const admin = await this.findAdmin();
      const isFirst = !admin;

      return await this.prisma.user.create({
        data: {
          id: userId,
          username: username || null,
          firstName: firstName || null,
          lastName: lastName || null,
          role: isFirst ? 'ADMIN' : 'USER',
          status: isFirst ? 'APPROVED' : 'PENDING',
          isAuthorized: isFirst,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to sync user ${userId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async getUser(userId: string) {
    try {
      return await this.prisma.user.findUnique({
        where: { id: userId },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get user ${userId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async notifyAdminNewRequest(ctx: Context, applicantId: string) {
    const admin = await this.findAdmin();
    if (!admin) {
      this.logger.warn(`Cannot notify admin: no admin found in database.`);
      return;
    }

    const from = ctx.from;
    const username = from?.username ? `@${from.username}` : 'отсутствует';
    const fullName =
      [from?.first_name, from?.last_name].filter(Boolean).join(' ') || 'N/A';

    const message =
      `🔔 *Новый запрос на доступ к боту*\n\n` +
      `• *ID:* \`${applicantId}\`\n` +
      `• *Имя:* ${fullName}\n` +
      `• *Username:* ${username}\n\n` +
      `Предоставить пользователю доступ к системе?`;

    const keyboard = Markup.inlineKeyboard([
      Markup.button.callback(BUTTON_CONFIRM_TEXT, `approve:${applicantId}`),
      Markup.button.callback(BUTTON_DELETE_TEXT, `reject:${applicantId}`),
    ]);

    try {
      await ctx.telegram.sendMessage(admin.id, message, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      this.logger.log(
        `Sent authorization request for user ${applicantId} to admin ${admin.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send notification to admin ${admin.id}: ${(error as Error).message}`,
      );
    }
  }

  async approveUser(userId: string, ctx: Context) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isAuthorized: true,
        status: 'APPROVED',
      },
    });

    try {
      await ctx.telegram.sendMessage(userId, ACCESS_APPROVED_NOTIFICATION, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      this.logger.warn(
        `Failed to notify approved user ${userId}: ${(error as Error).message}`,
      );
    }

    return user;
  }

  async rejectUser(userId: string) {
    return await this.prisma.user.update({
      where: { id: userId },
      data: {
        isAuthorized: false,
        status: 'REJECTED',
      },
    });
  }

  getWelcomeMessage(): string {
    return WELCOME_MESSAGE;
  }

  getAdminWelcomeMessage(): string {
    return ADMIN_WELCOME_MESSAGE;
  }

  getHelpMessage(): string {
    return HELP_MESSAGE;
  }
}
