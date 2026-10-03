import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { PrismaService } from '../database/prisma.service';
import { WELCOME_MESSAGE, HELP_MESSAGE } from './telegram.constants';

describe('TelegramService', () => {
  let service: TelegramService;

  const mockPrisma = {
    user: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return welcome message', () => {
    expect(service.getWelcomeMessage()).toBe(WELCOME_MESSAGE);
  });

  it('should return help message', () => {
    expect(service.getHelpMessage()).toBe(HELP_MESSAGE);
  });

  it('should sync user when ctx.from is present', async () => {
    const mockCtx = {
      from: {
        id: 123456789,
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
      },
    } as any;

    const mockSavedUser = {
      id: '123456789',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      isAuthorized: true,
    };

    mockPrisma.user.upsert.mockResolvedValue(mockSavedUser);

    const result = await service.syncUser(mockCtx);

    expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
      where: { id: '123456789' },
      update: {
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        isAuthorized: true,
      },
      create: {
        id: '123456789',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        isAuthorized: true,
      },
    });
    expect(result).toEqual(mockSavedUser);
  });

  it('should return null if ctx.from is missing', async () => {
    const mockCtx = {} as any;
    const result = await service.syncUser(mockCtx);

    expect(result).toBeNull();
    expect(mockPrisma.user.upsert).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully and return null', async () => {
    const mockCtx = {
      from: { id: 123456789 },
    } as any;

    mockPrisma.user.upsert.mockRejectedValue(new Error('DB connection failed'));

    const result = await service.syncUser(mockCtx);

    expect(result).toBeNull();
  });
});
