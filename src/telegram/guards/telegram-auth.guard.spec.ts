import { ExecutionContext } from '@nestjs/common';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { TelegramService } from '../telegram.service';
import {
  PENDING_ACCESS_MESSAGE,
  ALREADY_PENDING_MESSAGE,
  REJECTED_ACCESS_MESSAGE,
} from '../telegram.constants';

describe('TelegramAuthGuard', () => {
  let guard: TelegramAuthGuard;
  let telegramService: TelegramService;

  const mockTelegramService = {
    findAdmin: jest.fn(),
    getUser: jest.fn(),
    syncUser: jest.fn(),
    notifyAdminNewRequest: jest.fn(),
  };

  beforeEach(() => {
    telegramService = mockTelegramService as unknown as TelegramService;
    guard = new TelegramAuthGuard(telegramService);
    jest.clearAllMocks();
  });

  const createMockContext = (ctx: any): ExecutionContext => {
    return {
      getType: jest.fn().mockReturnValue('telegraf'),
      switchToHttp: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn().mockReturnValue([ctx]),
      getArgByIndex: jest.fn().mockImplementation((index: number) => {
        if (index === 0) return ctx;
        return undefined;
      }),
    } as unknown as ExecutionContext;
  };

  it('should reject access if from field or userId is missing', async () => {
    const mockCtx = { reply: jest.fn() };
    const context = createMockContext(mockCtx);

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });

  it('should allow callbackQuery if caller is ADMIN', async () => {
    const mockCtx = {
      from: { id: 111 },
      callbackQuery: { id: 'cb1', data: 'approve:222' },
      answerCbQuery: jest.fn(),
    };
    mockTelegramService.getUser.mockResolvedValue({ id: '111', role: 'ADMIN' });
    const context = createMockContext(mockCtx);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockCtx.answerCbQuery).not.toHaveBeenCalled();
  });

  it('should reject callbackQuery if caller is not ADMIN', async () => {
    const mockCtx = {
      from: { id: 222 },
      callbackQuery: { id: 'cb2', data: 'approve:333' },
      answerCbQuery: jest.fn().mockResolvedValue(true),
    };
    mockTelegramService.getUser.mockResolvedValue({ id: '222', role: 'USER' });
    const context = createMockContext(mockCtx);

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
    expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('только администратору'),
      { show_alert: true },
    );
  });

  it('should bootstrap first user as ADMIN and allow access', async () => {
    const mockCtx = {
      from: { id: 111, first_name: 'FirstUser' },
      reply: jest.fn(),
    };
    mockTelegramService.findAdmin.mockResolvedValue(null);
    const context = createMockContext(mockCtx);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockTelegramService.syncUser).toHaveBeenCalledWith(mockCtx);
  });

  it('should allow access if user is authorized', async () => {
    const mockCtx = {
      from: { id: 222 },
      reply: jest.fn(),
    };
    mockTelegramService.findAdmin.mockResolvedValue({
      id: '111',
      role: 'ADMIN',
    });
    mockTelegramService.getUser.mockResolvedValue({
      id: '222',
      isAuthorized: true,
      status: 'APPROVED',
    });
    const context = createMockContext(mockCtx);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockCtx.reply).not.toHaveBeenCalled();
  });

  it('should reject and inform user if status is REJECTED', async () => {
    const mockCtx = {
      from: { id: 333 },
      reply: jest.fn().mockResolvedValue(true),
    };
    mockTelegramService.findAdmin.mockResolvedValue({
      id: '111',
      role: 'ADMIN',
    });
    mockTelegramService.getUser.mockResolvedValue({
      id: '333',
      isAuthorized: false,
      status: 'REJECTED',
    });
    const context = createMockContext(mockCtx);

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
    expect(mockCtx.reply).toHaveBeenCalledWith(REJECTED_ACCESS_MESSAGE, {
      parse_mode: 'Markdown',
    });
  });

  it('should reject and inform user if status is already PENDING', async () => {
    const mockCtx = {
      from: { id: 444 },
      reply: jest.fn().mockResolvedValue(true),
    };
    mockTelegramService.findAdmin.mockResolvedValue({
      id: '111',
      role: 'ADMIN',
    });
    mockTelegramService.getUser.mockResolvedValue({
      id: '444',
      isAuthorized: false,
      status: 'PENDING',
    });
    const context = createMockContext(mockCtx);

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
    expect(mockCtx.reply).toHaveBeenCalledWith(ALREADY_PENDING_MESSAGE, {
      parse_mode: 'Markdown',
    });
  });

  it('should register new user as PENDING, notify applicant, and notify admin', async () => {
    const mockCtx = {
      from: { id: 555, first_name: 'Applicant' },
      reply: jest.fn().mockResolvedValue(true),
    };
    mockTelegramService.findAdmin.mockResolvedValue({
      id: '111',
      role: 'ADMIN',
    });
    mockTelegramService.getUser.mockResolvedValue(null);
    const context = createMockContext(mockCtx);

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
    expect(mockTelegramService.syncUser).toHaveBeenCalledWith(mockCtx);
    expect(mockCtx.reply).toHaveBeenCalledWith(PENDING_ACCESS_MESSAGE, {
      parse_mode: 'Markdown',
    });
    expect(mockTelegramService.notifyAdminNewRequest).toHaveBeenCalledWith(
      mockCtx,
      '555',
    );
  });
});
