import configuration from './configuration';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should parse environment variables with defaults', () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.DATABASE_URL;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.AUTHORIZED_USERS;
    delete process.env.GEMINI_API_KEY;

    const config = configuration();

    expect(config.port).toBe(3000);
    expect(config.environment).toBe('development');
    expect(config.databaseUrl).toBe('file:./data/sell_helper.db');
    expect(config.telegram.botToken).toBe('');
    expect(config.telegram.authorizedUsers).toEqual([]);
    expect(config.gemini.apiKey).toBe('');
  });

  it('should correctly parse comma-separated authorized users with whitespace', () => {
    process.env.AUTHORIZED_USERS = ' 123456789 , 987654321, 555666777 , ';
    process.env.TELEGRAM_BOT_TOKEN = 'test_token_123';
    process.env.PORT = '4000';

    const config = configuration();

    expect(config.port).toBe(4000);
    expect(config.telegram.botToken).toBe('test_token_123');
    expect(config.telegram.authorizedUsers).toEqual([
      '123456789',
      '987654321',
      '555666777',
    ]);
  });
});
