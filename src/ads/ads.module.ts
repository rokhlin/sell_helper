import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AdsService } from './ads.service';

@Module({
  imports: [DatabaseModule],
  providers: [AdsService],
  exports: [AdsService],
})
export class AdsModule {}
