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
        isComplete: true,
        missingDetails: [],
        clarifyingQuestions: [],
        hasPhoto: true,
        photoRecommendations: 'Фото со всех сторон',
        suggestedPhotoPrompt: 'PS5 console on table',
        priceEstimation: {
          min: 400,
          max: 450,
          recommended: 430,
          currency: 'USD',
          reasoning: 'Хороший спрос на вторичке',
        },
        recommendedPlatforms: ['AVITO', 'KUFAR'],
        ads: [
          {
            platform: 'AVITO',
            title: 'Sony PlayStation 5 в отличном состоянии',
            content: 'Продам PS5, полный комплект.',
            recommendedPrice: 430,
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
        images: [{ base64: 'abc', mimeType: 'image/jpeg' }],
      });

      expect(result.itemTitle).toBe('Sony PlayStation 5');
      expect(result.isComplete).toBe(true);
      expect(result.priceEstimation.recommended).toBe(430);
      expect(result.ads).toHaveLength(1);
      expect(result.ads[0].platform).toBe('AVITO');
    });

    it('should handle markdown-wrapped json codeblocks from Gemini', async () => {
      const markdownWrapped = `\`\`\`json
{
  "itemTitle": "Ноутбук Lenovo ThinkPad",
  "category": "Компьютеры",
  "condition": "Хорошее",
  "isComplete": false,
  "missingDetails": ["Объем SSD", "Количество RAM"],
  "clarifyingQuestions": ["Сколько оперативной памяти установлено?"],
  "hasPhoto": false,
  "photoRecommendations": "Сделайте фото экрана и клавиатуры",
  "suggestedPhotoPrompt": "Lenovo ThinkPad laptop",
  "priceEstimation": {
    "min": 300,
    "max": 350,
    "recommended": 330,
    "currency": "USD",
    "reasoning": "Популярная бизнес-модель"
  },
  "recommendedPlatforms": ["AVITO", "TELEGRAM"],
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
      expect(result.priceEstimation.recommended).toBe(65);
    });
  });
});
