import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { session } from 'telegraf';
import { AiModule } from '../ai/ai.module';
import { AdsModule } from '../ads/ads.module';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
import { TelegramService } from './telegram.service';
import { TelegramUpdate } from './telegram.update';

@Module({
  imports: [
    AiModule,
    AdsModule,
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const token =
          configService.get<string>('telegram.botToken') || 'dummy_token';
        const isTest =
          configService.get<string>('environment') === 'test' ||
          process.env.NODE_ENV === 'test';
        return {
          token,
          middlewares: [session()],
          launchOptions: isTest ? false : undefined,
        };
      },
    }),
  ],
  providers: [TelegramAuthGuard, TelegramService, TelegramUpdate],
  exports: [TelegramService, TelegramAuthGuard],
})
export class TelegramModule {}
