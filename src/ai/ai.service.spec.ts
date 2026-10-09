import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { PromptRegistryService } from './prompt-registry.service';

describe('AiService', () => {
  let service: AiService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'gemini.apiKey') return 'mock-gemini-key';
      return null;
    }),
  };

  const mockPromptRegistry = {
    getSystemInstruction: jest.fn().mockReturnValue('System prompt'),
    buildUserPrompt: jest.fn().mockReturnValue('User prompt'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PromptRegistryService, useValue: mockPromptRegistry },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeItem', () => {
    it('should return mock result when no client is configured', async () => {
      // Create service without API key
      const noKeyConfig = {
        get: jest.fn().mockReturnValue(''),
      };
      const unconfiguredService = new AiService(
        noKeyConfig as any,
        mockPromptRegistry as any,
      );

      const result = await unconfiguredService.analyzeItem({
        text: 'Продаю старый стул',
      });

      expect(result).toBeDefined();
      expect(result.itemTitle).toContain('Продаю старый стул');
      expect(result.priceEstimation.recommended).toBeGreaterThan(0);
      expect(result.ads.length).toBeGreaterThan(0);
    });

    it('should successfully parse valid JSON response from Gemini', async () => {
      const mockResultJson = JSON.stringify({
        itemTitle: 'Sony PlayStation 5',
        category: 'Игровые приставки',
        condition: 'Отличное',
        city: 'Тель-Авив',
        isComplete: true,
        missingDetails: [],
        clarifyingQuestions: [],
        hasPhoto: true,
        photoRecommendations: 'Фото со всех сторон',
        suggestedPhotoPrompt: 'PS5 console on table',
        priceEstimation: {
          min: 1400,
          max: 1600,
          recommended: 1500,
          currency: 'ILS',
          reasoning: 'Хороший спрос на вторичке в Израиле',
        },
        recommendedPlatforms: ['YAD2', 'FACEBOOK'],
        ads: [
          {
            platform: 'YAD2',
            language: 'HE',
            title: 'Sony PlayStation 5 במצב מעולה',
            content: 'למכירה PS5, כולל שלטים.',
            recommendedPrice: 1500,
          },
        ],
      });

      // Mock the internal client generateContent
      (service as any).client = {
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: mockResultJson,
          }),
        },
      };

      const result = await service.analyzeItem({
        text: 'Продам Sony PlayStation 5 в отличном состоянии',
        city: 'Тель-Авив',
        images: [{ base64: 'abc', mimeType: 'image/jpeg' }],
      });

      expect(result.itemTitle).toBe('Sony PlayStation 5');
      expect(result.isComplete).toBe(true);
      expect(result.priceEstimation.recommended).toBe(1500);
      expect(result.ads).toHaveLength(1);
      expect(result.ads[0].platform).toBe('YAD2');
      expect(result.ads[0].language).toBe('HE');
    });

    it('should handle markdown-wrapped json codeblocks from Gemini', async () => {
      const markdownWrapped = `\`\`\`json
{
  "itemTitle": "Ноутбук Lenovo ThinkPad",
  "category": "Компьютеры",
  "condition": "Хорошее",
  "city": "Хайфа",
  "isComplete": false,
  "missingDetails": ["Объем SSD", "Количество RAM"],
  "clarifyingQuestions": ["Сколько оперативной памяти установлено?"],
  "hasPhoto": false,
  "photoRecommendations": "Сделайте фото экрана и клавиатуры",
  "suggestedPhotoPrompt": "Lenovo ThinkPad laptop",
  "priceEstimation": {
    "min": 1000,
    "max": 1200,
    "recommended": 1100,
    "currency": "ILS",
    "reasoning": "Популярная бизнес-модель"
  },
  "recommendedPlatforms": ["YAD2", "TELEGRAM"],
  "ads": []
}
\`\`\``;

      (service as any).client = {
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: markdownWrapped,
          }),
        },
      };

      const result = await service.analyzeItem({
        text: 'Ноутбук Lenovo ThinkPad',
      });

      expect(result.itemTitle).toBe('Ноутбук Lenovo ThinkPad');
      expect(result.isComplete).toBe(false);
      expect(result.clarifyingQuestions).toHaveLength(1);
      expect(result.clarifyingQuestions[0]).toContain(
        'Сколько оперативной памяти',
      );
    });

    it('should fallback to mock result on API failure', async () => {
      (service as any).client = {
        models: {
          generateContent: jest
            .fn()
            .mockRejectedValue(new Error('Network error')),
        },
      };

      const result = await service.analyzeItem({
        text: 'Велосипед горный',
      });

      expect(result).toBeDefined();
      expect(result.itemTitle).toBe('Велосипед горный');
      expect(result.priceEstimation.recommended).toBe(200);
      expect(result.priceEstimation.currency).toBe('ILS');
      expect(result.city).toBe('Тель-Авив');
    });

    it('should successfully fallback to secondary model when primary model fails', async () => {
      const mockSuccessJson = JSON.stringify({
        itemTitle: 'Самокат Xiaomi Pro 2',
        category: 'Транспорт',
        condition: 'Хорошее',
        city: 'Хайфа',
        isComplete: true,
        missingDetails: [],
        clarifyingQuestions: [],
        hasPhoto: false,
        photoRecommendations: 'Фото колес и дисплея',
        suggestedPhotoPrompt: 'Xiaomi Pro 2 scooter',
        priceEstimation: {
          min: 800,
          max: 1000,
          recommended: 900,
          currency: 'ILS',
          reasoning: 'Спрос на самокаты в Хайфе стабильный',
        },
        recommendedPlatforms: ['YAD2'],
        ads: [],
      });

      const generateContentMock = jest
        .fn()
        .mockRejectedValueOnce(
          new Error('503 This model is currently experiencing high demand'),
        )
        .mockResolvedValueOnce({
          text: mockSuccessJson,
        });

      (service as any).client = {
        models: {
          generateContent: generateContentMock,
        },
      };

      const result = await service.analyzeItem({
        text: 'Продам электросамокат Xiaomi в Хайфе',
      });

      expect(generateContentMock).toHaveBeenCalledTimes(2);
      expect(generateContentMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ model: 'gemini-3.8-flash' }),
      );
      expect(generateContentMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ model: 'gemini-3.5-flash' }),
      );
      expect(result.itemTitle).toBe('Самокат Xiaomi Pro 2');
      expect(result.priceEstimation.recommended).toBe(900);
    });
  });
});
