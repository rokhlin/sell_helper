import { PromptRegistryService } from './prompt-registry.service';

describe('PromptRegistryService', () => {
  let service: PromptRegistryService;

  beforeEach(() => {
    service = new PromptRegistryService();
  });

  it('should return system instruction with JSON schema specification for Israel market', () => {
    const instruction = service.getSystemInstruction();
    expect(instruction).toContain(
      'You are an expert resale appraiser and copywriter for classifieds in Israel',
    );
    expect(instruction).toContain('Yad2');
    expect(instruction).toContain('ILS');
    expect(instruction).toContain('"city"');
    expect(instruction).toContain('"YAD2"');
    expect(instruction).toContain('"FACEBOOK"');
    expect(instruction).toContain('"TELEGRAM"');
    expect(instruction).toContain('"itemTitle"');
    expect(instruction).toContain('"priceEstimation"');
    expect(instruction).toContain('"ads"');
  });

  it('should build user prompt with photo guidance and city when provided', () => {
    const prompt = service.buildUserPrompt({
      text: 'Продаю старый велосипед',
      city: 'Тель-Авив',
      hasPhoto: false,
      hasAudio: false,
    });
    expect(prompt).toContain('Продаю старый велосипед');
    expect(prompt).toContain('Seller location in Israel: Тель-Авив');
    expect(prompt).toContain('Photos: NO');
    expect(prompt).toContain('NOT provided a photo yet');
  });

  it('should build user prompt indicating attached media, unspecified city and context', () => {
    const prompt = service.buildUserPrompt({
      text: 'iPhone 13',
      hasPhoto: true,
      hasAudio: true,
      previousContext: 'User previously asked about phones',
    });
    expect(prompt).toContain('iPhone 13');
    expect(prompt).toContain('Seller location in Israel: NOT SPECIFIED');
    expect(prompt).toContain('Photos: YES');
    expect(prompt).toContain('Audio/Voice: YES');
    expect(prompt).toContain('User previously asked about phones');
  });
});
