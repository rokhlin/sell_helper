import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { PromptRegistryService } from './prompt-registry.service';
import {
  AiAnalysisResult,
  AnalyzeItemInput,
  FacebookChannelRecommendation,
  FacebookCommunityType,
  TargetPlatform,
} from './ai.types';
import { getRecommendedFacebookChannels } from './community-catalog';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: GoogleGenAI | null = null;
  private readonly primaryModel = 'gemini-3.8-flash';
  private readonly fallbackModels = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly promptRegistry: PromptRegistryService,
  ) {
    const apiKey = this.configService.get<string>('gemini.apiKey');
    if (apiKey && apiKey.trim().length > 0) {
      try {
        this.client = new GoogleGenAI({ apiKey });
        this.logger.log('GoogleGenAI client initialized successfully.');
      } catch (error) {
        this.logger.error(
          `Failed to initialize GoogleGenAI client: ${(error as Error).message}`,
        );
      }
    } else {
      this.logger.warn(
        'GEMINI_API_KEY is not configured. Running in simulated fallback mode.',
      );
    }
  }

  async analyzeItem(input: AnalyzeItemInput): Promise<AiAnalysisResult> {
    const startTime = Date.now();
    this.logger.log(
      `Starting item analysis. Input length: ${input.text?.length || 0} chars, Images: ${input.images?.length || 0}, Audio: ${input.audio ? 1 : 0}`,
    );

    if (!this.client) {
      this.logger.warn(
        'No Gemini client available. Returning mock analysis result.',
      );
      return this.createMockAnalysisResult(input);
    }

    const hasPhoto = Boolean(input.images && input.images.length > 0);
    const hasAudio = Boolean(input.audio);

    const userPrompt = this.promptRegistry.buildUserPrompt({
      text: input.text,
      city: input.city,
      hasPhoto,
      hasAudio,
      previousContext: input.previousContext,
    });

    const parts: any[] = [];

    // Attach images
    if (input.images && input.images.length > 0) {
      for (const img of input.images) {
        const base64Data = img.base64 || img.buffer?.toString('base64');
        if (base64Data) {
          parts.push({
            inlineData: {
              mimeType: img.mimeType || 'image/jpeg',
              data: base64Data,
            },
          });
        }
      }
    }

    // Attach audio (e.g. voice message)
    if (input.audio) {
      const audioBase64 =
        input.audio.base64 || input.audio.buffer?.toString('base64');
      if (audioBase64) {
        parts.push({
          inlineData: {
            mimeType: input.audio.mimeType || 'audio/ogg',
            data: audioBase64,
          },
        });
      }
    }

    // Attach prompt text
    parts.push(userPrompt);

    const systemInstruction = this.promptRegistry.getSystemInstruction();

    // Try primary model, fallback on error through resilient cascade
    const modelsToTry = [this.primaryModel, ...this.fallbackModels];
    let rawResponseText = '';
    let lastError: Error | null = null;

    for (const modelName of modelsToTry) {
      try {
        this.logger.log(`Attempting Gemini model: ${modelName}`);
        const response = await this.client.models.generateContent({
          model: modelName,
          contents: parts,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
          },
        });

        rawResponseText = response.text || '';
        if (rawResponseText.trim().length > 0) {
          this.logger.log(
            `Received Gemini response in ${Date.now() - startTime}ms from ${modelName}`,
          );
          break;
        }
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Model ${modelName} call failed: ${lastError.message}`,
        );
      }
    }

    if (!rawResponseText) {
      this.logger.error(
        `All Gemini models failed. Last error: ${lastError?.message}. Falling back to default parser.`,
      );
      return this.createMockAnalysisResult(input);
    }

    try {
      const parsed = this.parseAndSanitizeJson(rawResponseText);
      return this.normalizeAnalysisResult(parsed, hasPhoto);
    } catch (parseError) {
      this.logger.error(
        `Failed to parse Gemini JSON output: ${(parseError as Error).message}. Raw: ${rawResponseText.substring(0, 200)}`,
      );
      return this.createMockAnalysisResult(input);
    }
  }

  private parseAndSanitizeJson(raw: string): any {
    let clean = raw.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return JSON.parse(clean);
  }

  private normalizeAnalysisResult(
    data: any,
    hasPhotoProvided: boolean,
  ): AiAnalysisResult {
    const validPlatforms: TargetPlatform[] = ['YAD2', 'FACEBOOK', 'TELEGRAM'];
    const validLanguages: ('HE' | 'RU' | 'EN')[] = ['HE', 'RU', 'EN'];
    const platforms: TargetPlatform[] = Array.isArray(data.recommendedPlatforms)
      ? data.recommendedPlatforms.filter((p: any) => validPlatforms.includes(p))
      : ['YAD2', 'FACEBOOK', 'TELEGRAM'];

    const ads = Array.isArray(data.ads)
      ? data.ads.map((ad: any) => ({
          platform: validPlatforms.includes(ad.platform) ? ad.platform : 'YAD2',
          language: validLanguages.includes(ad.language)
            ? ad.language
            : ad.platform === 'YAD2'
              ? 'HE'
              : 'RU',
          title: String(ad.title || data.itemTitle || 'Товар на продажу'),
          content: String(ad.content || ''),
          recommendedPrice: Number(
            ad.recommendedPrice || data.priceEstimation?.recommended || 0,
          ),
        }))
      : [];

    const validCommunityTypes: FacebookCommunityType[] = [
      'MARKETPLACE',
      'CITY_COMMUNITY',
      'GENERAL_RESALE',
      'CATEGORY_NICHE',
    ];

    let facebookChannels: FacebookChannelRecommendation[] = [];
    if (Array.isArray(data.facebookChannels)) {
      facebookChannels = data.facebookChannels
        .filter(
          (ch: any) =>
            ch &&
            typeof ch.name === 'string' &&
            typeof ch.url === 'string' &&
            ch.name.trim().length > 0 &&
            ch.url.trim().length > 0,
        )
        .map((ch: any) => ({
          name: String(ch.name),
          url: String(ch.url),
          language: validLanguages.includes(ch.language) ? ch.language : 'RU',
          type: validCommunityTypes.includes(ch.type)
            ? ch.type
            : 'GENERAL_RESALE',
          description: String(ch.description || ''),
        }));
    }

    if (facebookChannels.length === 0) {
      facebookChannels = getRecommendedFacebookChannels(
        data.category,
        data.city,
      );
    }

    return {
      itemTitle: String(data.itemTitle || 'Товар без названия'),
      category: String(data.category || 'Другое'),
      condition: String(data.condition || 'Б/У в хорошем состоянии'),
      city: data.city ? String(data.city) : undefined,
      isComplete: Boolean(data.isComplete),
      missingDetails: Array.isArray(data.missingDetails)
        ? data.missingDetails
        : [],
      clarifyingQuestions: Array.isArray(data.clarifyingQuestions)
        ? data.clarifyingQuestions
        : [],
      hasPhoto: hasPhotoProvided || Boolean(data.hasPhoto),
      photoRecommendations:
        data.photoRecommendations ||
        'Сделайте четкие фото при дневном свете со всех сторон.',
      suggestedPhotoPrompt:
        data.suggestedPhotoPrompt ||
        `High-quality commercial product photo of ${data.itemTitle || 'item'}, clean neutral background, studio lighting`,
      priceEstimation: {
        min: Number(data.priceEstimation?.min || 0),
        max: Number(data.priceEstimation?.max || 0),
        recommended: Number(data.priceEstimation?.recommended || 0),
        currency: String(data.priceEstimation?.currency || 'ILS'),
        reasoning: String(
          data.priceEstimation?.reasoning ||
            'Оценка на основе аналогичных предложений вторичного рынка Израиля.',
        ),
      },
      recommendedPlatforms:
        platforms.length > 0 ? platforms : ['YAD2', 'FACEBOOK', 'TELEGRAM'],
      ads:
        ads.length > 0
          ? ads
          : [
              {
                platform: 'YAD2',
                language: 'HE',
                title: String(data.itemTitle || 'מוצר למכירה'),
                content: `למכירה ${data.itemTitle || 'מוצר'}. מצב: ${data.condition || 'מצוין'}.`,
                recommendedPrice: Number(
                  data.priceEstimation?.recommended || 0,
                ),
              },
            ],
      facebookChannels,
    };
  }

  private createMockAnalysisResult(input: AnalyzeItemInput): AiAnalysisResult {
    const title = input.text
      ? input.text.split('\n')[0].substring(0, 40)
      : 'Товар';
    const city = input.city || 'Тель-Авив';
    return {
      itemTitle: title,
      category: 'Электроника / Товары для дома',
      condition: 'Б/У в хорошем состоянии',
      city,
      isComplete: true,
      missingDetails: [],
      clarifyingQuestions: [],
      hasPhoto: Boolean(input.images && input.images.length > 0),
      photoRecommendations:
        'Сделайте 3-4 фото: общий вид спереди, сзади, шильдик/серийный номер и дефекты при их наличии.',
      suggestedPhotoPrompt: `High-quality photo of ${title}, neutral background, bright natural lighting`,
      priceEstimation: {
        min: 150,
        max: 250,
        recommended: 200,
        currency: 'ILS',
        reasoning:
          'Среднерыночная стоимость на основе аналогичных предложений в Израиле (секонд-хенд).',
      },
      recommendedPlatforms: ['YAD2', 'FACEBOOK', 'TELEGRAM'],
      ads: [
        {
          platform: 'YAD2',
          language: 'HE',
          title: `למכירה ${title}`,
          content: `למכירה ${title} במצב מצוין.\nמיקום: ${city}.\nמחיר: 200 ₪. איסוף עצמי.`,
          recommendedPrice: 200,
        },
        {
          platform: 'FACEBOOK',
          language: 'HE',
          title: `למכירה ${title}`,
          content: `למכירה ${title} במצב מצוין!\nעיר: ${city}.\nמחיר מומלץ: 200 ₪. פרטים בפרטי.`,
          recommendedPrice: 200,
        },
        {
          platform: 'FACEBOOK',
          language: 'RU',
          title: `Продам ${title}`,
          content: `Продам ${title}.\nСостояние отличное, полностью работоспособен.\nЛокация: ${city}.\nЦена: 200 ₪. Самовывоз.`,
          recommendedPrice: 200,
        },
        {
          platform: 'FACEBOOK',
          language: 'EN',
          title: `For sale: ${title}`,
          content: `Selling ${title} in great condition.\nLocation: ${city}, Israel.\nPrice: 200 ILS.\nDM for details.`,
          recommendedPrice: 200,
        },
        {
          platform: 'TELEGRAM',
          language: 'RU',
          title: `🔥 ${title}`,
          content: `Продается ${title}!\nГород: ${city}.\nЦена: 200 ₪.\nПишите в лс для связи.`,
          recommendedPrice: 200,
        },
      ],
      facebookChannels: getRecommendedFacebookChannels('Электроника', city),
    };
  }
}
