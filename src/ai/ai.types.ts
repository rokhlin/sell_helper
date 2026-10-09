export type TargetPlatform = 'FACEBOOK' | 'TELEGRAM' | 'YAD2';
export type AdLanguage = 'HE' | 'RU' | 'EN';

export interface PlatformAd {
  platform: TargetPlatform;
  language?: AdLanguage;
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

export type FacebookCommunityType =
  'MARKETPLACE' | 'CITY_COMMUNITY' | 'GENERAL_RESALE' | 'CATEGORY_NICHE';

export interface FacebookChannelRecommendation {
  name: string;
  url: string;
  language: AdLanguage;
  type: FacebookCommunityType;
  description: string;
}

export interface AiAnalysisResult {
  itemTitle: string;
  category: string;
  condition: string;
  city?: string;
  isComplete: boolean;
  missingDetails: string[];
  clarifyingQuestions: string[];
  hasPhoto: boolean;
  photoRecommendations?: string;
  suggestedPhotoPrompt?: string;
  priceEstimation: PriceEstimation;
  recommendedPlatforms: TargetPlatform[];
  ads: PlatformAd[];
  facebookChannels?: FacebookChannelRecommendation[];
}

export interface MediaInput {
  base64?: string;
  buffer?: Buffer;
  mimeType: string;
}

export interface AnalyzeItemInput {
  text: string;
  city?: string;
  images?: MediaInput[];
  audio?: MediaInput;
  previousContext?: string;
}
