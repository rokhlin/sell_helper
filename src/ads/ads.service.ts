import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiAnalysisResult } from '../ai/ai.types';

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createSaleRequest(
    userId: string,
    rawDescription: string,
    itemTitle?: string,
    city?: string,
  ) {
    this.logger.log(`Creating sale request for user: ${userId}`);
    return this.prisma.saleRequest.create({
      data: {
        userId,
        rawDescription,
        itemTitle: itemTitle || null,
        city: city || null,
        currency: 'ILS',
        status: 'ANALYZING',
      },
    });
  }

  async saveAnalysisResult(saleRequestId: string, analysis: AiAnalysisResult) {
    this.logger.log(
      `Saving analysis result for sale request: ${saleRequestId}`,
    );

    // Update sale request details
    const updatedRequest = await this.prisma.saleRequest.update({
      where: { id: saleRequestId },
      data: {
        itemTitle: analysis.itemTitle,
        city: analysis.city || undefined,
        estimatedPriceMin: analysis.priceEstimation.min,
        estimatedPriceMax: analysis.priceEstimation.max,
        currency: analysis.priceEstimation.currency || 'ILS',
        status: analysis.isComplete ? 'COMPLETED' : 'DRAFT',
      },
    });

    // Save generated ads
    if (analysis.ads && analysis.ads.length > 0) {
      for (const ad of analysis.ads) {
        await this.prisma.generatedAd.create({
          data: {
            saleRequestId,
            targetPlatform: ad.platform,
            language: ad.language || null,
            adTitle: ad.title,
            adContent: ad.content,
            recommendedPrice:
              ad.recommendedPrice || analysis.priceEstimation.recommended,
          },
        });
      }
    }

    return updatedRequest;
  }

  async attachMedia(
    saleRequestId: string,
    fileType: 'IMAGE' | 'AUDIO' | 'DOCUMENT',
    telegramFileId?: string,
    localPath?: string,
  ) {
    this.logger.log(
      `Attaching media (${fileType}) to request: ${saleRequestId}`,
    );
    return this.prisma.requestMedia.create({
      data: {
        saleRequestId,
        fileType,
        telegramFileId: telegramFileId || null,
        localPath: localPath || null,
      },
    });
  }

  async getSaleRequestWithDetails(saleRequestId: string) {
    return this.prisma.saleRequest.findUnique({
      where: { id: saleRequestId },
      include: {
        media: true,
        generatedAds: true,
      },
    });
  }

  async getLatestSaleRequestForUser(userId: string) {
    return this.prisma.saleRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        media: true,
        generatedAds: true,
      },
    });
  }
}
