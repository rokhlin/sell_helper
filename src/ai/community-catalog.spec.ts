import {
  getRecommendedFacebookChannels,
  buildFacebookSearchUrl,
} from './community-catalog';

describe('CommunityCatalog', () => {
  it('should build valid Facebook search url', () => {
    const url = buildFacebookSearchUrl('iphone tel aviv');
    expect(url).toBe(
      'https://www.facebook.com/groups/search/groups/?q=iphone%20tel%20aviv',
    );
  });

  it('should return top-5 communities including marketplace and city match for Tel Aviv', () => {
    const channels = getRecommendedFacebookChannels('Электроника', 'Тель-Авив');
    expect(channels.length).toBeLessThanOrEqual(5);
    expect(channels.length).toBeGreaterThan(0);

    // Marketplace is present
    expect(channels.some((c) => c.type === 'MARKETPLACE')).toBe(true);

    // Tel Aviv specific community or Secret Tel Aviv is present
    expect(
      channels.some(
        (c) =>
          c.name.includes('Tel Aviv') ||
          c.name.includes('תל אביב') ||
          c.description.includes('Тель-Авив'),
      ),
    ).toBe(true);
  });

  it('should match furniture niche for sofa', () => {
    const channels = getRecommendedFacebookChannels('Диван кожаный', 'Хайфа');
    expect(channels.length).toBeLessThanOrEqual(5);

    // Should include furniture niche or Haifa community
    expect(
      channels.some(
        (c) =>
          c.type === 'CATEGORY_NICHE' ||
          c.name.includes('Хайфа') ||
          c.name.includes('חיפה'),
      ),
    ).toBe(true);
  });

  it('should provide default communities when no category or city specified', () => {
    const channels = getRecommendedFacebookChannels();
    expect(channels.length).toBe(5);
    expect(channels[0].name).toBe('Facebook Marketplace Israel');
  });
});
