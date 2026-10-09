import { Module } from '@nestjs/common';
import { AdsModule } from '../ads/ads.module';
import { WebviewController } from './webview.controller';

@Module({
  imports: [AdsModule],
  controllers: [WebviewController],
})
export class WebviewModule {}
