import { Test, TestingModule } from '@nestjs/testing';
import { AdsService } from './ads.service';
import { PrismaService } from '../database/prisma.service';
import { AiAnalysisResult } from '../ai/ai.types';

describe('AdsService', () => {
  let service: AdsService;

  const mockPrisma = {
    saleRequest: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    generatedAd: {
      create: jest.fn(),
    },
    requestMedia: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AdsService>(AdsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a sale request', async () => {
    const mockRequest = {
      id: 'req-1',
      userId: 'user-1',
      rawDescription: 'Item description',
      city: 'Тель-Авив',
      currency: 'ILS',
    };
    mockPrisma.saleRequest.create.mockResolvedValue(mockRequest);

    const result = await service.createSaleRequest(
      'user-1',
      'Item description',
      undefined,
      'Тель-Авив',
    );

    expect(result).toEqual(mockRequest);
    expect(mockPrisma.saleRequest.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        rawDescription: 'Item description',
        itemTitle: null,
        city: 'Тель-Авив',
        currency: 'ILS',
        status: 'ANALYZING',
      },
    });
  });

  it('should save analysis result and generated ads', async () => {
    const mockAnalysis: AiAnalysisResult = {
      itemTitle: 'Test Phone',
      category: 'Smartphones',
      condition: 'New',
      city: 'Тель-Авив',
      isComplete: true,
      missingDetails: [],
      clarifyingQuestions: [],
      hasPhoto: true,
      priceEstimation: {
        min: 100,
        max: 150,
        recommended: 130,
        currency: 'ILS',
        reasoning: 'Good condition',
      },
      recommendedPlatforms: ['YAD2', 'TELEGRAM'],
      ads: [
        {
          platform: 'YAD2',
          language: 'HE',
          title: 'Ad Title Yad2',
          content: 'Ad Content Yad2',
          recommendedPrice: 130,
        },
      ],
    };

    const mockUpdated = {
      id: 'req-1',
      itemTitle: 'Test Phone',
      city: 'Тель-Авив',
      status: 'COMPLETED',
    };
    mockPrisma.saleRequest.update.mockResolvedValue(mockUpdated);
    mockPrisma.generatedAd.create.mockResolvedValue({ id: 'ad-1' });

    const result = await service.saveAnalysisResult('req-1', mockAnalysis);

    expect(result).toEqual(mockUpdated);
    expect(mockPrisma.saleRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: {
        itemTitle: 'Test Phone',
        city: 'Тель-Авив',
        estimatedPriceMin: 100,
        estimatedPriceMax: 150,
        currency: 'ILS',
        status: 'COMPLETED',
      },
    });
    expect(mockPrisma.generatedAd.create).toHaveBeenCalledWith({
      data: {
        saleRequestId: 'req-1',
        targetPlatform: 'YAD2',
        language: 'HE',
        adTitle: 'Ad Title Yad2',
        adContent: 'Ad Content Yad2',
        recommendedPrice: 130,
      },
    });
  });

  it('should attach media to sale request', async () => {
    const mockMedia = {
      id: 'm-1',
      saleRequestId: 'req-1',
      fileType: 'IMAGE',
      telegramFileId: 'tf-1',
    };
    mockPrisma.requestMedia.create.mockResolvedValue(mockMedia);

    const result = await service.attachMedia('req-1', 'IMAGE', 'tf-1');

    expect(result).toEqual(mockMedia);
    expect(mockPrisma.requestMedia.create).toHaveBeenCalledWith({
      data: {
        saleRequestId: 'req-1',
        fileType: 'IMAGE',
        telegramFileId: 'tf-1',
        localPath: null,
      },
    });
  });

  it('should get sale request with details', async () => {
    const mockRequest = { id: 'req-1', media: [], generatedAds: [] };
    mockPrisma.saleRequest.findUnique.mockResolvedValue(mockRequest);

    const result = await service.getSaleRequestWithDetails('req-1');

    expect(result).toEqual(mockRequest);
    expect(mockPrisma.saleRequest.findUnique).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      include: { media: true, generatedAds: true },
    });
  });

  it('should get latest sale request for user', async () => {
    const mockRequest = { id: 'req-1', userId: 'user-1' };
    mockPrisma.saleRequest.findFirst.mockResolvedValue(mockRequest);

    const result = await service.getLatestSaleRequestForUser('user-1');

    expect(result).toEqual(mockRequest);
    expect(mockPrisma.saleRequest.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      include: { media: true, generatedAds: true },
    });
  });
});
