import {
  Controller,
  Get,
  Param,
  Render,
  NotFoundException,
} from '@nestjs/common';
import { AdsService } from '../ads/ads.service';

@Controller('ads')
export class WebviewController {
  constructor(private readonly adsService: AdsService) {}

  @Get(':id')
  @Render('ad-preview')
  async getAdPreview(@Param('id') id: string) {
    const saleRequest = await this.adsService.getSaleRequestWithDetails(id);

    if (!saleRequest) {
      throw new NotFoundException(
        `Объявление с идентификатором "${id}" не найдено.`,
      );
    }

    return {
      saleRequest,
    };
  }
}
