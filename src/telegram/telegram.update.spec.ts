import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TelegramUpdate } from './telegram.update';
import { TelegramService } from './telegram.service';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
import { AiService } from '../ai/ai.service';
import { AdsService } from '../ads/ads.service';
import { AiAnalysisResult } from '../ai/ai.types';

describe('TelegramUpdate', () => {
  let update: TelegramUpdate;
  let telegramService: TelegramService;
  let aiService: AiService;
  let adsService: AdsService;

  const mockConfigService = {
    get: jest.fn((key: string): string | null => {
      if (key === 'webBaseUrl') return 'http://localhost:3000';
      return null;
    }),
  };

  const mockTelegramService = {
    syncUser: jest.fn(),
    getWelcomeMessage: jest.fn().mockReturnValue('Welcome text'),
    getAdminWelcomeMessage: jest.fn().mockReturnValue('Admin welcome text'),
    getHelpMessage: jest.fn().mockReturnValue('Help text'),
    approveUser: jest.fn(),
    rejectUser: jest.fn(),
    findAdmin: jest.fn(),
    getUser: jest.fn(),
  };

  const mockAnalysisResult: AiAnalysisResult = {
    itemTitle: 'Велосипед Trek Marlin 5',
    category: 'Спорт и отдых / Велосипеды',
    condition: 'Отличное',
    city: 'Тель-Авив',
    isComplete: true,
    missingDetails: [],
    clarifyingQuestions: [],
    hasPhoto: false,
    photoRecommendations: 'Сделайте фото сбоку и трансмиссию',
    suggestedPhotoPrompt: 'Trek Marlin 5 bicycle outdoors',
    priceEstimation: {
      min: 300,
      max: 380,
      recommended: 350,
      currency: 'ILS',
      reasoning:
        'Хороший спрос на качественные брендовые велосипеды в Израиле.',
    },
    recommendedPlatforms: ['YAD2', 'FACEBOOK', 'TELEGRAM'],
    ads: [
      {
        platform: 'YAD2',
        language: 'HE',
        title: 'למכירה אופניים Trek Marlin 5',
        content: 'למכירה אופני הרים במצב מעולה.',
        recommendedPrice: 350,
      },
    ],
  };

  const mockAiService = {
    analyzeItem: jest.fn().mockResolvedValue(mockAnalysisResult),
  };

  const mockAdsService = {
    createSaleRequest: jest.fn().mockResolvedValue({ id: 'sale-req-123' }),
    saveAnalysisResult: jest.fn().mockResolvedValue({ id: 'sale-req-123' }),
    attachMedia: jest.fn().mockResolvedValue({ id: 'media-123' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramUpdate,
        {
          provide: TelegramService,
          useValue: mockTelegramService,
        },
        {
          provide: AiService,
          useValue: mockAiService,
        },
        {
          provide: AdsService,
          useValue: mockAdsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        TelegramAuthGuard,
      ],
    }).compile();

    update = module.get<TelegramUpdate>(TelegramUpdate);
    telegramService = module.get<TelegramService>(TelegramService);
    aiService = module.get<AiService>(AiService);
    adsService = module.get<AdsService>(AdsService);
    jest.clearAllMocks();
  });

  it('should handle /start for regular user by sending standard welcome', async () => {
    const mockCtx = {
      from: { id: 123456789 },
      reply: jest.fn().mockResolvedValue(true),
    } as any;

    mockTelegramService.syncUser.mockResolvedValue({
      id: '123456789',
      role: 'USER',
    });

    await update.onStart(mockCtx);

    expect(telegramService.syncUser).toHaveBeenCalledWith(mockCtx);
    expect(telegramService.getWelcomeMessage).toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith('Welcome text', {
      parse_mode: 'Markdown',
    });
  });

  it('should handle /start for admin user by sending admin welcome', async () => {
    const mockCtx = {
      from: { id: 111 },
      reply: jest.fn().mockResolvedValue(true),
    } as any;

    mockTelegramService.syncUser.mockResolvedValue({
      id: '111',
      role: 'ADMIN',
    });

    await update.onStart(mockCtx);

    expect(telegramService.syncUser).toHaveBeenCalledWith(mockCtx);
    expect(telegramService.getAdminWelcomeMessage).toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith('Admin welcome text', {
      parse_mode: 'Markdown',
    });
  });

  it('should handle /help by returning help message', async () => {
    const mockCtx = {
      reply: jest.fn().mockResolvedValue(true),
    } as any;

    await update.onHelp(mockCtx);

    expect(telegramService.getHelpMessage).toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith('Help text', {
      parse_mode: 'Markdown',
    });
  });

  it('should handle approve action when match is present', async () => {
    const mockCtx = {
      match: ['approve:222', '222'],
      answerCbQuery: jest.fn().mockResolvedValue(true),
      editMessageText: jest.fn().mockResolvedValue(true),
    } as any;

    mockTelegramService.approveUser.mockResolvedValue({ id: '222' });

    await update.onApproveUser(mockCtx);

    expect(telegramService.approveUser).toHaveBeenCalledWith('222', mockCtx);
    expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('подтвержден'),
    );
    expect(mockCtx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('предоставлен полный доступ'),
      { parse_mode: 'Markdown' },
    );
  });

  it('should handle approve action when match is missing', async () => {
    const mockCtx = {
      match: null,
      answerCbQuery: jest.fn().mockResolvedValue(true),
    } as any;

    await update.onApproveUser(mockCtx);

    expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('Ошибка'),
    );
    expect(telegramService.approveUser).not.toHaveBeenCalled();
  });

  it('should handle reject action when match is present', async () => {
    const mockCtx = {
      match: ['reject:333', '333'],
      answerCbQuery: jest.fn().mockResolvedValue(true),
      editMessageText: jest.fn().mockResolvedValue(true),
    } as any;

    mockTelegramService.rejectUser.mockResolvedValue({ id: '333' });

    await update.onRejectUser(mockCtx);

    expect(telegramService.rejectUser).toHaveBeenCalledWith('333');
    expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('отклонен'),
    );
    expect(mockCtx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('доступ к боту не предоставлен'),
      { parse_mode: 'Markdown' },
    );
  });

  it('should handle reject action when match is missing', async () => {
    const mockCtx = {
      match: null,
      answerCbQuery: jest.fn().mockResolvedValue(true),
    } as any;

    await update.onRejectUser(mockCtx);

    expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('Ошибка'),
    );
    expect(telegramService.rejectUser).not.toHaveBeenCalled();
  });

  describe('AI Content Generation Flow', () => {
    it('should process text messages, analyze with AI, persist request and reply with structured analysis', async () => {
      const mockCtx = {
        from: { id: 123456789 },
        message: {
          text: 'Продаю велосипед Trek Marlin 5 в отличном состоянии',
        },
        sendChatAction: jest.fn().mockResolvedValue(true),
        reply: jest.fn().mockResolvedValue(true),
      } as any;

      mockAdsService.createSaleRequest.mockResolvedValue({ id: 'req-456' });
      mockAiService.analyzeItem.mockResolvedValue(mockAnalysisResult);

      await update.onText(mockCtx);

      expect(mockCtx.sendChatAction).toHaveBeenCalledWith('typing');
      expect(adsService.createSaleRequest).toHaveBeenCalledWith(
        '123456789',
        'Продаю велосипед Trek Marlin 5 в отличном состоянии',
        undefined,
        undefined,
      );
      expect(aiService.analyzeItem).toHaveBeenCalledWith({
        text: 'Продаю велосипед Trek Marlin 5 в отличном состоянии',
        city: undefined,
      });
      expect(adsService.saveAnalysisResult).toHaveBeenCalledWith(
        'req-456',
        mockAnalysisResult,
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Trek Marlin 5'),
        expect.objectContaining({ parse_mode: 'HTML' }),
      );
    });

    it('should detect Israeli city from message text and pass to AI and DB', async () => {
      const mockCtx = {
        from: { id: 123456789 },
        message: {
          text: 'Продаю диван в Нетании самовывоз',
        },
        sendChatAction: jest.fn().mockResolvedValue(true),
        reply: jest.fn().mockResolvedValue(true),
      } as any;

      mockAdsService.createSaleRequest.mockResolvedValue({ id: 'req-city' });
      mockAiService.analyzeItem.mockResolvedValue(mockAnalysisResult);

      await update.onText(mockCtx);

      expect(adsService.createSaleRequest).toHaveBeenCalledWith(
        '123456789',
        'Продаю диван в Нетании самовывоз',
        undefined,
        'Нетания',
      );
      expect(aiService.analyzeItem).toHaveBeenCalledWith({
        text: 'Продаю диван в Нетании самовывоз',
        city: 'Нетания',
      });
    });

    it('should include clarifying questions if item information is incomplete', async () => {
      const incompleteAnalysis: AiAnalysisResult = {
        ...mockAnalysisResult,
        isComplete: false,
        missingDetails: ['Размер рамы', 'Год выпуска'],
        clarifyingQuestions: [
          'Укажите, пожалуйста, размер рамы (M, L)?',
          'Какого года выпуска велосипед?',
        ],
      };

      const mockCtx = {
        from: { id: 123456789 },
        message: { text: 'Велосипед' },
        sendChatAction: jest.fn().mockResolvedValue(true),
        reply: jest.fn().mockResolvedValue(true),
      } as any;

      mockAdsService.createSaleRequest.mockResolvedValue({
        id: 'req-incomplete',
      });
      mockAiService.analyzeItem.mockResolvedValue(incompleteAnalysis);

      await update.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Укажите, пожалуйста, размер рамы'),
        expect.objectContaining({ parse_mode: 'HTML' }),
      );
    });

    it('should process photo messages, attach media and analyze', async () => {
      const mockCtx = {
        from: { id: 123456789 },
        message: {
          photo: [{ file_id: 'low_res_1' }, { file_id: 'high_res_2' }],
          caption: 'Продаю этот телефон в Хайфе',
        },
        telegram: {
          getFileLink: jest
            .fn()
            .mockResolvedValue({ href: 'http://telegram.test/file.jpg' }),
        },
        sendChatAction: jest.fn().mockResolvedValue(true),
        reply: jest.fn().mockResolvedValue(true),
      } as any;

      mockAdsService.createSaleRequest.mockResolvedValue({ id: 'req-photo' });
      mockAiService.analyzeItem.mockResolvedValue(mockAnalysisResult);

      await update.onPhoto(mockCtx);

      expect(mockCtx.sendChatAction).toHaveBeenCalledWith('typing');
      expect(adsService.createSaleRequest).toHaveBeenCalledWith(
        '123456789',
        'Продаю этот телефон в Хайфе',
        undefined,
        'Хайфа',
      );
      expect(adsService.attachMedia).toHaveBeenCalledWith(
        'req-photo',
        'IMAGE',
        'high_res_2',
      );
      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('should process voice messages, attach media and analyze', async () => {
      const mockCtx = {
        from: { id: 123456789 },
        message: {
          voice: { file_id: 'voice_123' },
        },
        telegram: {
          getFileLink: jest
            .fn()
            .mockResolvedValue({ href: 'http://telegram.test/voice.ogg' }),
        },
        sendChatAction: jest.fn().mockResolvedValue(true),
        reply: jest.fn().mockResolvedValue(true),
      } as any;

      mockAdsService.createSaleRequest.mockResolvedValue({ id: 'req-voice' });
      mockAiService.analyzeItem.mockResolvedValue(mockAnalysisResult);

      await update.onVoice(mockCtx);

      expect(mockCtx.sendChatAction).toHaveBeenCalledWith('record_voice');
      expect(adsService.createSaleRequest).toHaveBeenCalledWith(
        '123456789',
        'Голосовое описание товара',
      );
      expect(adsService.attachMedia).toHaveBeenCalledWith(
        'req-voice',
        'AUDIO',
        'voice_123',
      );
      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('should handle webview callback query action', async () => {
      const mockCtx = {
        match: ['webview:req-123', 'req-123'],
        answerCbQuery: jest.fn().mockResolvedValue(true),
        reply: jest.fn().mockResolvedValue(true),
      } as any;

      await update.onWebViewAction(mockCtx);

      expect(mockCtx.answerCbQuery).toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('/ads/req-123'),
        expect.objectContaining({ parse_mode: 'HTML' }),
      );
    });

    it('should handle autopublish callback query action', async () => {
      const mockCtx = {
        answerCbQuery: jest.fn().mockResolvedValue(true),
        reply: jest.fn().mockResolvedValue(true),
      } as any;

      await update.onAutoPublishAction(mockCtx);

      expect(mockCtx.answerCbQuery).toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('SH-04'),
      );
    });

    it('should include clickable url button when webBaseUrl is a valid public domain', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'webBaseUrl') return 'https://sellhelper.app';
        return null;
      });

      const mockCtx = {
        from: { id: 123456789 },
        message: { text: 'Стол деревянный' },
        sendChatAction: jest.fn().mockResolvedValue(true),
        reply: jest.fn().mockResolvedValue(true),
      } as any;

      mockAdsService.createSaleRequest.mockResolvedValue({
        id: 'req-public-url',
      });
      mockAiService.analyzeItem.mockResolvedValue(mockAnalysisResult);

      await update.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '🌐 Просмотр Web-версии',
                  url: 'https://sellhelper.app/ads/req-public-url',
                }),
              ]),
            ]),
          }),
        }),
      );

      // Restore mock
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'webBaseUrl') return 'http://localhost:3000';
        return null;
      });
    });

    it('should safely recover and send plain text if keyboard markup fails', async () => {
      const mockCtx = {
        from: { id: 123456789 },
        message: { text: 'Шкаф' },
        sendChatAction: jest.fn().mockResolvedValue(true),
        reply: jest
          .fn()
          .mockRejectedValueOnce(
            new Error('400 Bad Request: inline keyboard error'),
          )
          .mockRejectedValueOnce(
            new Error('400 Bad Request: inline keyboard error'),
          )
          .mockResolvedValueOnce(true),
      } as any;

      mockAdsService.createSaleRequest.mockResolvedValue({
        id: 'req-recovery',
      });
      mockAiService.analyzeItem.mockResolvedValue(mockAnalysisResult);

      await update.onText(mockCtx);

      // Third reply call should be plain text without any keyboard argument
      expect(mockCtx.reply).toHaveBeenCalledTimes(3);
    });
  });
});
