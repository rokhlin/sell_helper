export const ACCESS_DENIED_MESSAGE =
  '⛔ Access Denied.\n\nYou are not authorized to use this bot. Please contact the administrator to request access.';

export const WELCOME_MESSAGE =
  '👋 Welcome to *Sell Helper Bot*!\n\n' +
  'I will assist you in pricing and drafting high-converting listings for your used goods across platforms (Avito, Kufar, Facebook Marketplace, Telegram).\n\n' +
  '📸 *How to get started:*\n' +
  '1. Send photos of the item you want to sell.\n' +
  '2. Or send a text/voice description including item name, condition, and any defects.\n\n' +
  'Use /help to see all available commands.';

export const HELP_MESSAGE =
  'ℹ️ *Sell Helper Commands & Workflow*\n\n' +
  '• /start - Restart the bot and show main menu\n' +
  '• /help - Display this help guide\n' +
  '• /new - Start a new item evaluation\n' +
  '• /status - Check pending listing drafts\n\n' +
  '💡 *Tip:* You can send photos or voice messages directly at any time.';

export const ADMIN_WELCOME_MESSAGE =
  '👑 *Вы зарегистрированы как администратор бота!*\n\n' +
  'Вам будут приходить запросы на доступ от новых пользователей с кнопками «Подтвердить» и «Удалить».\n\n' +
  WELCOME_MESSAGE;

export const PENDING_ACCESS_MESSAGE =
  '⏳ *Запрос отправлен администратору*\n\n' +
  'Ваша заявка на использование бота отправлена администратору. Как только доступ будет подтвержден, вы получите уведомление.';

export const ALREADY_PENDING_MESSAGE =
  '⏳ *Заявка на рассмотрении*\n\n' +
  'Ваш запрос на доступ уже находится на рассмотрении у администратора. Пожалуйста, ожидайте подтверждения.';

export const REJECTED_ACCESS_MESSAGE =
  '⛔ *Доступ отклонен*\n\n' +
  'Администратор отклонил ваш запрос на доступ к боту.';

export const ACCESS_APPROVED_NOTIFICATION =
  '🎉 *Доступ подтвержден!*\n\n' +
  'Администратор одобрил вашу заявку. Теперь вам доступны все функции бота.\n\n' +
  WELCOME_MESSAGE;

export const BUTTON_CONFIRM_TEXT = 'Подтвердить';
export const BUTTON_DELETE_TEXT = 'Удалить';
