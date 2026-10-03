import { Test, TestingModule } from '@nestjs/testing';
import { TelegramUpdate } from './telegram.update';
import { TelegramService } from './telegram.service';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
import { ConfigService } from '@nestjs/config';

describe('TelegramUpdate', () => {
  let update: TelegramUpdate;
  let telegramService: TelegramService;

  const mockTelegramService = {
    syncUser: jest.fn(),
    getWelcomeMessage: jest.fn().mockReturnValue('Welcome text'),
    getHelpMessage: jest.fn().mockReturnValue('Help text'),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(['123456789']),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramUpdate,
        {
          provide: TelegramService,
          useValue: mockTelegramService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        TelegramAuthGuard,
      ],
    }).compile();

    update = module.get<TelegramUpdate>(TelegramUpdate);
    telegramService = module.get<TelegramService>(TelegramService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle /start command by syncing user and sending welcome message', async () => {
    const mockCtx = {
      from: { id: 123456789 },
      reply: jest.fn().mockResolvedValue(true),
    } as any;

    await update.onStart(mockCtx);

    expect(telegramService.syncUser).toHaveBeenCalledWith(mockCtx);
    expect(telegramService.getWelcomeMessage).toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith('Welcome text', {
      parse_mode: 'Markdown',
    });
  });

  it('should handle /help command by sending help message', async () => {
    const mockCtx = {
      reply: jest.fn().mockResolvedValue(true),
    } as any;

    await update.onHelp(mockCtx);

    expect(telegramService.getHelpMessage).toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith('Help text', {
      parse_mode: 'Markdown',
    });
  });

  it('should handle incoming text messages', async () => {
    const mockCtx = {
      reply: jest.fn().mockResolvedValue(true),
    } as any;

    await update.onText(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Item description received'),
    );
  });

  it('should handle incoming photo messages', async () => {
    const mockCtx = {
      reply: jest.fn().mockResolvedValue(true),
    } as any;

    await update.onPhoto(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Photo received'),
    );
  });

  it('should handle incoming voice messages', async () => {
    const mockCtx = {
      reply: jest.fn().mockResolvedValue(true),
    } as any;

    await update.onVoice(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Voice message received'),
    );
  });
});
