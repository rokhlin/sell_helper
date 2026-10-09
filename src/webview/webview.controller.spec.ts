import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WebviewController } from './webview.controller';
import { AdsService } from '../ads/ads.service';

describe('WebviewController', () => {
  let controller: WebviewController;
  let adsService: AdsService;

  const mockAdsService = {
    getSaleRequestWithDetails: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebviewController],
      providers: [
        {
          provide: AdsService,
          useValue: mockAdsService,
        },
      ],
    }).compile();

    controller = module.get<WebviewController>(WebviewController);
    adsService = module.get<AdsService>(AdsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAdPreview', () => {
    it('should return saleRequest when found', async () => {
      const mockRequest = {
        id: 'req-123',
        itemTitle: 'Велосипед',
        media: [],
        generatedAds: [
          {
            id: 'ad-1',
            targetPlatform: 'AVITO',
            adTitle: 'Продам велосипед',
            adContent: 'Отличное состояние',
            recommendedPrice: 200,
          },
        ],
      };

      mockAdsService.getSaleRequestWithDetails.mockResolvedValue(mockRequest);

      const result = await controller.getAdPreview('req-123');

      expect(adsService.getSaleRequestWithDetails).toHaveBeenCalledWith(
        'req-123',
      );
      expect(result).toEqual({ saleRequest: mockRequest });
    });

    it('should throw NotFoundException when ad does not exist', async () => {
      mockAdsService.getSaleRequestWithDetails.mockResolvedValue(null);

      await expect(controller.getAdPreview('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      expect(adsService.getSaleRequestWithDetails).toHaveBeenCalledWith(
        'non-existent',
      );
    });
  });
});
