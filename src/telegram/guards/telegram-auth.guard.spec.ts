import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { ACCESS_DENIED_MESSAGE } from '../telegram.constants';

describe('TelegramAuthGuard', () => {
  let guard: TelegramAuthGuard;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'telegram.authorizedUsers') {
          return ['123456789', '987654321'];
        }
        return null;
      }),
    } as unknown as ConfigService;

    guard = new TelegramAuthGuard(configService);
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

  it('should allow access for authorized user ID', async () => {
    const mockCtx = {
      from: { id: 123456789, first_name: 'Authorized' },
      reply: jest.fn(),
    };
    const context = createMockContext(mockCtx);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockCtx.reply).not.toHaveBeenCalled();
  });

  it('should reject access and reply with access denied for unauthorized user ID', async () => {
    const mockCtx = {
      from: { id: 999999999, first_name: 'Stranger' },
      reply: jest.fn().mockResolvedValue(true),
    };
    const context = createMockContext(mockCtx);

    const result = await guard.canActivate(context);

    expect(result).toBe(false);
    expect(mockCtx.reply).toHaveBeenCalledWith(ACCESS_DENIED_MESSAGE);
  });

  it('should reject access if from field is missing', async () => {
    const mockCtx = {
      reply: jest.fn().mockResolvedValue(true),
    };
    const context = createMockContext(mockCtx);

    const result = await guard.canActivate(context);

    expect(result).toBe(false);
    expect(mockCtx.reply).toHaveBeenCalledWith(ACCESS_DENIED_MESSAGE);
  });

  it('should handle ctx without reply method gracefully when rejecting', async () => {
    const mockCtx = {
      from: { id: 999999999 },
    };
    const context = createMockContext(mockCtx);

    const result = await guard.canActivate(context);

    expect(result).toBe(false);
  });
});
