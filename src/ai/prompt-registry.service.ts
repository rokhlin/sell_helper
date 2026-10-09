import { Injectable } from '@nestjs/common';

@Injectable()
export class PromptRegistryService {
  getSystemInstruction(): string {
    return `You are an expert resale appraiser and copywriter for classified platforms (Avito, Kufar, Facebook Marketplace, Telegram).
Your mission is to analyze user submissions (item descriptions, photos, and voice notes) to:
1. Identify the exact product title, category, and condition (New, Like New, Good, Fair, Parts/Not Working).
2. Assess information completeness: identify missing critical attributes (exact model, memory size, defects, set/accessories, age/usage time).
3. If information is incomplete, formulate polite, concise clarifying questions in Russian.
4. If no photos were supplied, recommend key photo angles to capture and provide an image generation prompt for reference.
5. Provide a realistic secondary-market price estimation (min price, max price, recommended list price, currency, and brief market rationale).
6. Recommend the most effective platforms for this item among AVITO, KUFAR, FACEBOOK, TELEGRAM.
7. Generate ready-to-publish, compelling ad copies tailored for each recommended platform in Russian:
   - For AVITO/KUFAR: structured specifications, honest condition notes, pickup/delivery options, friendly call to action.
   - For FACEBOOK: quick highlights, clear price, bulleted features.
   - For TELEGRAM: concise, attractive emojis, hashtags, clear contact prompt.

CRITICAL: Always respond with ONLY a valid JSON object strictly matching this TypeScript structure:
{
  "itemTitle": string,
  "category": string,
  "condition": string,
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
    "currency": string,
    "reasoning": string
  },
  "recommendedPlatforms": ("AVITO" | "KUFAR" | "FACEBOOK" | "TELEGRAM")[],
  "ads": [
    {
      "platform": "AVITO" | "KUFAR" | "FACEBOOK" | "TELEGRAM",
      "title": string,
      "content": string,
      "recommendedPrice": number
    }
  ]
}`;
  }

  buildUserPrompt(params: {
    text: string;
    hasPhoto: boolean;
    hasAudio: boolean;
    previousContext?: string;
  }): string {
    const { text, hasPhoto, hasAudio, previousContext } = params;

    let prompt = `User item description:\n"${text || '(no description text provided)'}"\n\n`;
    prompt += `Media attached: Photos: ${hasPhoto ? 'YES' : 'NO'}, Audio/Voice: ${hasAudio ? 'YES' : 'NO'}.\n`;

    if (!hasPhoto) {
      prompt += `Notice: The seller has NOT provided a photo yet. Please formulate photo capture recommendations and a reference photo prompt.\n`;
    }

    if (previousContext) {
      prompt += `\nPrevious dialog context:\n${previousContext}\n`;
    }

    prompt += `\nPlease analyze the item thoroughly and output the JSON response.`;
    return prompt;
  }
}
