export type TargetPlatform = 'AVITO' | 'KUFAR' | 'FACEBOOK' | 'TELEGRAM';

export interface PlatformAd {
  platform: TargetPlatform;
  title: string;
  content: string;
  recommendedPrice?: number;
}

export interface PriceEstimation {
  min: number;
  max: number;
  recommended: number;
  currency: string;
  reasoning: string;
}

export interface AiAnalysisResult {
  itemTitle: string;
  category: string;
  condition: string;
  isComplete: boolean;
  missingDetails: string[];
  clarifyingQuestions: string[];
  hasPhoto: boolean;
  photoRecommendations?: string;
  suggestedPhotoPrompt?: string;
  priceEstimation: PriceEstimation;
  recommendedPlatforms: TargetPlatform[];
  ads: PlatformAd[];
}

export interface MediaInput {
  base64?: string;
  buffer?: Buffer;
  mimeType: string;
}

export interface AnalyzeItemInput {
  text: string;
  images?: MediaInput[];
  audio?: MediaInput;
  previousContext?: string;
}
