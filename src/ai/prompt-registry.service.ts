import { Injectable } from '@nestjs/common';

@Injectable()
export class PromptRegistryService {
  getSystemInstruction(): string {
    return `You are an expert resale appraiser and copywriter for classifieds in Israel (Yad2, Facebook Marketplace/Groups, Telegram).
Your mission is to analyze user submissions (item descriptions, photos, and voice notes) to:
1. Identify the exact product title, category, and condition (New, Like New, Good, Fair, Parts/Not Working).
2. Ground pricing and listings in the Israeli market with currency in ILS (₪) and the seller's specific city in Israel.
3. If city in Israel is not specified, include "Город в Израиле" in missingDetails and ask for their city in clarifyingQuestions (e.g. Тель-Авив, Иерусалим, Хайфа, Нетания, Бат-Ям, Ришон-ле-Цион).
4. Assess information completeness: identify missing critical attributes (model, condition, accessories, flaws, usage time).
5. If information is incomplete, formulate polite, concise clarifying questions in Russian.
6. If no photos were supplied, recommend key photo angles to capture and provide an image generation prompt for reference.
7. Provide a realistic secondary-market price estimation in ILS (₪) (min price, max price, recommended list price, currency "ILS", and market rationale based on Israeli market trends).
8. Recommend the most effective platforms for this item among YAD2, FACEBOOK, TELEGRAM.
9. Generate ready-to-publish, compelling ad copies tailored for each platform according to the language matrix:
   - For YAD2: STRICTLY in Hebrew (HE). Natural, appealing Hebrew copy for Israeli Yad2 buyers.
   - For FACEBOOK: Generate versions in:
     * Hebrew (HE) - for Israeli local marketplace
     * Russian (RU) - for Russian-speaking Israeli Facebook groups
     * English (EN) - for expat & international communities in Israel
   - For TELEGRAM: Generate versions in:
     * Russian (RU) - for Israeli Russian-speaking resale chats/channels
     * Hebrew (HE) - for local Israeli channels
   (Always specify the "language" property: "HE", "RU", or "EN").

CRITICAL: Always respond with ONLY a valid JSON object strictly matching this TypeScript structure:
{
  "itemTitle": string,
  "category": string,
  "condition": string,
  "city": string | null,
  "isComplete": boolean,
  "missingDetails": string[],
  "clarifyingQuestions": string[],
  "hasPhoto": boolean,
  "photoRecommendations": string,
  "suggestedPhotoPrompt": string,
  "priceEstimation": {
    "min": number,
    "max": number,
    "recommended": number,
    "currency": "ILS",
    "reasoning": string
  },
  "recommendedPlatforms": ("YAD2" | "FACEBOOK" | "TELEGRAM")[],
  "ads": [
    {
      "platform": "YAD2" | "FACEBOOK" | "TELEGRAM",
      "language": "HE" | "RU" | "EN",
      "title": string,
      "content": string,
      "recommendedPrice": number
    }
  ]
}`;
  }

  buildUserPrompt(params: {
    text: string;
    city?: string;
    hasPhoto: boolean;
    hasAudio: boolean;
    previousContext?: string;
  }): string {
    const { text, city, hasPhoto, hasAudio, previousContext } = params;

    let prompt = `User item description:\n"${text || '(no description text provided)'}"\n\n`;
    if (city) {
      prompt += `Seller location in Israel: ${city}\n`;
    } else {
      prompt += `Seller location in Israel: NOT SPECIFIED (if not mentioned in text, please ask for city in clarifying questions)\n`;
    }
    prompt += `Media attached: Photos: ${hasPhoto ? 'YES' : 'NO'}, Audio/Voice: ${hasAudio ? 'YES' : 'NO'}.\n`;

    if (!hasPhoto) {
      prompt += `Notice: The seller has NOT provided a photo yet. Please formulate photo capture recommendations and a reference photo prompt.\n`;
    }

    if (previousContext) {
      prompt += `\nPrevious dialog context:\n${previousContext}\n`;
    }

    prompt += `\nPlease analyze the item thoroughly for the Israeli market and output the JSON response.`;
    return prompt;
  }
}
