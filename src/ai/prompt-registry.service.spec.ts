import { PromptRegistryService } from './prompt-registry.service';

describe('PromptRegistryService', () => {
  let service: PromptRegistryService;

  beforeEach(() => {
    service = new PromptRegistryService();
  });

  it('should return system instruction with JSON schema specification', () => {
    const instruction = service.getSystemInstruction();
    expect(instruction).toContain('You are an expert resale appraiser');
    expect(instruction).toContain('"itemTitle"');
    expect(instruction).toContain('"priceEstimation"');
    expect(instruction).toContain('"ads"');
  });

  it('should build user prompt with photo guidance when no photo is provided', () => {
    const prompt = service.buildUserPrompt({
      text: 'Продаю старый велосипед',
      hasPhoto: false,
      hasAudio: false,
    });
    expect(prompt).toContain('Продаю старый велосипед');
    expect(prompt).toContain('Photos: NO');
    expect(prompt).toContain('NOT provided a photo yet');
  });

  it('should build user prompt indicating attached media and context', () => {
    const prompt = service.buildUserPrompt({
      text: 'iPhone 13',
      hasPhoto: true,
      hasAudio: true,
      previousContext: 'User previously asked about phones',
    });
    expect(prompt).toContain('iPhone 13');
    expect(prompt).toContain('Photos: YES');
    expect(prompt).toContain('Audio/Voice: YES');
    expect(prompt).toContain('User previously asked about phones');
  });
});
