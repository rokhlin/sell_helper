import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { PrismaService } from '../database/prisma.service';
import {
  WELCOME_MESSAGE,
  HELP_MESSAGE,
  ADMIN_WELCOME_MESSAGE,
} from './telegram.constants';

describe('TelegramService', () => {
  let service: TelegramService;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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

  it('should return welcome, admin welcome, and help messages', () => {
    expect(service.getWelcomeMessage()).toBe(WELCOME_MESSAGE);
    expect(service.getAdminWelcomeMessage()).toBe(ADMIN_WELCOME_MESSAGE);
    expect(service.getHelpMessage()).toBe(HELP_MESSAGE);
  });

  it('should find admin user or handle error', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: '111', role: 'ADMIN' });
    const admin = await service.findAdmin();
    expect(admin).toEqual({ id: '111', role: 'ADMIN' });

    mockPrisma.user.findFirst.mockRejectedValue(new Error('DB error'));
    const failedAdmin = await service.findAdmin();
    expect(failedAdmin).toBeNull();
  });

  it('should correctly identify if first user', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    expect(await service.isFirstUser()).toBe(true);

    mockPrisma.user.findFirst.mockResolvedValue({ id: '111', role: 'ADMIN' });
    expect(await service.isFirstUser()).toBe(false);
  });

  it('should return null if ctx.from is missing when syncing', async () => {
    const mockCtx = {} as any;
    expect(await service.syncUser(mockCtx)).toBeNull();
  });

  it('should update existing user when syncing', async () => {
    const mockCtx = {
      from: {
        id: 123456789,
        username: 'updated_user',
        first_name: 'First',
        last_name: 'Last',
      },
    } as any;

    mockPrisma.user.findUnique.mockResolvedValue({ id: '123456789' });
    mockPrisma.user.update.mockResolvedValue({
      id: '123456789',
      username: 'updated_user',
    });

    const result = await service.syncUser(mockCtx);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: '123456789' },
      data: {
        username: 'updated_user',
        firstName: 'First',
        lastName: 'Last',
      },
    });
    expect(result?.username).toBe('updated_user');
  });

  it('should register first user as ADMIN with APPROVED status and isAuthorized=true', async () => {
    const mockCtx = {
      from: {
        id: 111,
        username: 'admin_user',
        first_name: 'Admin',
      },
    } as any;

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(null); // No existing admin
    mockPrisma.user.create.mockResolvedValue({
      id: '111',
      role: 'ADMIN',
      status: 'APPROVED',
      isAuthorized: true,
    });

    const result = await service.syncUser(mockCtx);
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        id: '111',
        username: 'admin_user',
        firstName: 'Admin',
        lastName: null,
        role: 'ADMIN',
        status: 'APPROVED',
        isAuthorized: true,
      },
    });
    expect(result?.role).toBe('ADMIN');
    expect(result?.isAuthorized).toBe(true);
  });

  it('should register subsequent user as USER with PENDING status and isAuthorized=false', async () => {
    const mockCtx = {
      from: {
        id: 222,
        username: 'regular_user',
      },
    } as any;

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue({ id: '111', role: 'ADMIN' }); // Admin already exists
    mockPrisma.user.create.mockResolvedValue({
      id: '222',
      role: 'USER',
      status: 'PENDING',
      isAuthorized: false,
    });

    const result = await service.syncUser(mockCtx);
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        id: '222',
        username: 'regular_user',
        firstName: null,
        lastName: null,
        role: 'USER',
        status: 'PENDING',
        isAuthorized: false,
      },
    });
    expect(result?.role).toBe('USER');
    expect(result?.isAuthorized).toBe(false);
  });

  it('should handle database error during sync gracefully', async () => {
    const mockCtx = { from: { id: 123 } } as any;
    mockPrisma.user.findUnique.mockRejectedValue(new Error('DB failure'));

    const result = await service.syncUser(mockCtx);
    expect(result).toBeNull();
  });

  it('should getUser and handle error gracefully', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: '123' });
    expect(await service.getUser('123')).toEqual({ id: '123' });

    mockPrisma.user.findUnique.mockRejectedValue(new Error('DB error'));
    expect(await service.getUser('123')).toBeNull();
  });

  it('should notify admin about new request', async () => {
    const mockCtx = {
      from: {
        id: 222,
        username: 'applicant',
        first_name: 'John',
        last_name: 'Doe',
      },
      telegram: {
        sendMessage: jest.fn().mockResolvedValue(true),
      },
    } as any;

    mockPrisma.user.findFirst.mockResolvedValue({ id: '111', role: 'ADMIN' });

    await service.notifyAdminNewRequest(mockCtx, '222');

    expect(mockCtx.telegram.sendMessage).toHaveBeenCalledWith(
      '111',
      expect.stringContaining('Новый запрос на доступ'),
      expect.objectContaining({ parse_mode: 'Markdown' }),
    );
  });

  it('should handle notifyAdminNewRequest when admin is not found or error occurs', async () => {
    const mockCtx = {
      from: { id: 222 },
      telegram: {
        sendMessage: jest.fn().mockRejectedValue(new Error('Send failed')),
      },
    } as any;

    mockPrisma.user.findFirst.mockResolvedValue(null);
    await service.notifyAdminNewRequest(mockCtx, '222');
    expect(mockCtx.telegram.sendMessage).not.toHaveBeenCalled();

    mockPrisma.user.findFirst.mockResolvedValue({ id: '111', role: 'ADMIN' });
    await expect(
      service.notifyAdminNewRequest(mockCtx, '222'),
    ).resolves.not.toThrow();
  });

  it('should approve user and notify them', async () => {
    const mockCtx = {
      telegram: {
        sendMessage: jest.fn().mockResolvedValue(true),
      },
    } as any;

    mockPrisma.user.update.mockResolvedValue({
      id: '222',
      isAuthorized: true,
      status: 'APPROVED',
    });

    const result = await service.approveUser('222', mockCtx);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: '222' },
      data: { isAuthorized: true, status: 'APPROVED' },
    });
    expect(mockCtx.telegram.sendMessage).toHaveBeenCalledWith(
      '222',
      expect.stringContaining('Доступ подтвержден'),
      expect.objectContaining({ parse_mode: 'Markdown' }),
    );
    expect(result.status).toBe('APPROVED');
  });

  it('should reject user', async () => {
    mockPrisma.user.update.mockResolvedValue({
      id: '222',
      isAuthorized: false,
      status: 'REJECTED',
    });

    const result = await service.rejectUser('222');

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: '222' },
      data: { isAuthorized: false, status: 'REJECTED' },
    });
    expect(result.status).toBe('REJECTED');
  });
});
