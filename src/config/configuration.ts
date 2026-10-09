export interface AppConfig {
  port: number;
  environment: string;
  databaseUrl: string;
  webBaseUrl: string;
  telegram: {
    botToken: string;
    authorizedUsers: string[];
  };
  gemini: {
    apiKey: string;
  };
}

export default (): AppConfig => {
  const rawAuthorizedUsers = process.env.AUTHORIZED_USERS || '';
  const authorizedUsers = rawAuthorizedUsers
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  const port = parseInt(process.env.PORT || '3000', 10);

  return {
    port,
    environment: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL || 'file:./data/sell_helper.db',
    webBaseUrl: process.env.WEB_BASE_URL?.trim()
      ? process.env.WEB_BASE_URL.trim().replace(/\/+$/, '')
      : `http://localhost:${port}`,
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      authorizedUsers,
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
    },
  };
};
