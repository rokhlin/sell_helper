import { Test, TestingModule } from '@nestjs/testing';
import { TelegramUpdate } from './telegram.update';
import { TelegramService } from './telegram.service';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';

describe('TelegramUpdate', () => {
  let update: TelegramUpdate;
  let telegramService: TelegramService;

  const mockTelegramService = {
    syncUser: jest.fn(),
    getWelcomeMessage: jest.fn().mockReturnValue('Welcome text'),
    getAdminWelcomeMessage: jest.fn().mockReturnValue('Admin welcome text'),
    getHelpMessage: jest.fn().mockReturnValue('Help text'),
    approveUser: jest.fn(),
    rejectUser: jest.fn(),
    findAdmin: jest.fn(),
    getUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramUpdate,
        {
          provide: TelegramService,
          useValue: mockTelegramService,
        },
        TelegramAuthGuard,
      ],
    }).compile();

    update = module.get<TelegramUpdate>(TelegramUpdate);
    telegramService = module.get<TelegramService>(TelegramService);
    jest.clearAllMocks();
  });

  it('should handle /start for regular user by sending standard welcome', async () => {
    const mockCtx = {
      from: { id: 123456789 },
      reply: jest.fn().mockResolvedValue(true),
    } as any;

    mockTelegramService.syncUser.mockResolvedValue({
      id: '123456789',
      role: 'USER',
    });

    await update.onStart(mockCtx);

    expect(telegramService.syncUser).toHaveBeenCalledWith(mockCtx);
    expect(telegramService.getWelcomeMessage).toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith('Welcome text', {
      parse_mode: 'Markdown',
    });
  });

  it('should handle /start for admin user by sending admin welcome', async () => {
    const mockCtx = {
      from: { id: 111 },
      reply: jest.fn().mockResolvedValue(true),
    } as any;

    mockTelegramService.syncUser.mockResolvedValue({
      id: '111',
      role: 'ADMIN',
    });

    await update.onStart(mockCtx);

    expect(telegramService.getAdminWelcomeMessage).toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalledWith('Admin welcome text', {
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

  it('should handle approve action when match is present', async () => {
    const mockCtx = {
      match: ['approve:222', '222'],
      answerCbQuery: jest.fn().mockResolvedValue(true),
      editMessageText: jest.fn().mockResolvedValue(true),
    } as any;

    mockTelegramService.approveUser.mockResolvedValue({ id: '222' });

    await update.onApproveUser(mockCtx);

    expect(telegramService.approveUser).toHaveBeenCalledWith('222', mockCtx);
    expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('подтвержден'),
    );
    expect(mockCtx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('предоставлен полный доступ'),
      { parse_mode: 'Markdown' },
    );
  });

  it('should handle approve action when match is missing', async () => {
    const mockCtx = {
      match: null,
      answerCbQuery: jest.fn().mockResolvedValue(true),
    } as any;

    await update.onApproveUser(mockCtx);

    expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('Ошибка'),
    );
    expect(telegramService.approveUser).not.toHaveBeenCalled();
  });

  it('should handle reject action when match is present', async () => {
    const mockCtx = {
      match: ['reject:333', '333'],
      answerCbQuery: jest.fn().mockResolvedValue(true),
      editMessageText: jest.fn().mockResolvedValue(true),
    } as any;

    mockTelegramService.rejectUser.mockResolvedValue({ id: '333' });

    await update.onRejectUser(mockCtx);

    expect(telegramService.rejectUser).toHaveBeenCalledWith('333');
    expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('отклонен'),
    );
    expect(mockCtx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('доступ к боту не предоставлен'),
      { parse_mode: 'Markdown' },
    );
  });

  it('should handle reject action when match is missing', async () => {
    const mockCtx = {
      match: null,
      answerCbQuery: jest.fn().mockResolvedValue(true),
    } as any;

    await update.onRejectUser(mockCtx);

    expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('Ошибка'),
    );
    expect(telegramService.rejectUser).not.toHaveBeenCalled();
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
