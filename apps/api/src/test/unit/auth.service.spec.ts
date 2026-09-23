import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../../modules/auth/auth.service.js';
import { IAuthUserRepository, IRefreshTokenRepository, StoredRefreshToken } from '../../modules/auth/auth.repository.js';
import { UserAggregate } from '../../modules/auth/auth.mapper.js';
import { IPasswordService } from '../../common/security/password.service.js';
import { ITokenService, TokenPayload } from '../../common/security/token.service.js';
import { IAccountLockoutService } from '../../common/security/account-lockout.service.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { RoleType } from '@trueco/types';

// ==========================================
// In-Memory Test Doubles (Clean Architecture)
// ==========================================
class InMemoryAuthUserRepository implements IAuthUserRepository {
  public users: Map<string, UserAggregate> = new Map();

  public async findByEmail(email: string): Promise<UserAggregate | null> {
    for (const u of this.users.values()) {
      if (u.email === email) return u;
    }
    return null;
  }

  public async findById(id: string): Promise<UserAggregate | null> {
    return this.users.get(id) || null;
  }

  public async updateLastLogin(_userId: string): Promise<void> {}

  public async markEmailVerified(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) (user as any).emailVerifiedAt = new Date();
  }

  public async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.passwordHash = passwordHash;
    }
  }
}

class InMemoryRefreshTokenRepository implements IRefreshTokenRepository {
  public tokens: Map<string, StoredRefreshToken> = new Map();

  public async create(data: any): Promise<StoredRefreshToken> {
    const record: StoredRefreshToken = {
      id: `token-${Date.now()}-${Math.random()}`,
      userId: data.userId,
      tokenHash: data.tokenHash,
      family: data.family,
      isRevoked: false,
      expiresAt: data.expiresAt,
    };
    this.tokens.set(record.tokenHash, record);
    return record;
  }

  public async findByTokenHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    return this.tokens.get(tokenHash) || null;
  }

  public async revoke(id: string): Promise<void> {
    for (const t of this.tokens.values()) {
      if (t.id === id) t.isRevoked = true;
    }
  }

  public async revokeFamily(family: string): Promise<void> {
    for (const t of this.tokens.values()) {
      if (t.family === family) t.isRevoked = true;
    }
  }

  public async revokeAllForUser(userId: string): Promise<void> {
    for (const t of this.tokens.values()) {
      if (t.userId === userId) t.isRevoked = true;
    }
  }
}

describe('AuthService (Phase 1 Domain Unit Tests)', () => {
  let authService: AuthService;
  let userRepo: InMemoryAuthUserRepository;
  let tokenRepo: InMemoryRefreshTokenRepository;
  let mockPasswordService: IPasswordService;
  let mockTokenService: ITokenService;
  let mockLockoutService: IAccountLockoutService;
  let mockEventBus: IEventBus;

  beforeEach(() => {
    userRepo = new InMemoryAuthUserRepository();
    tokenRepo = new InMemoryRefreshTokenRepository();

    mockPasswordService = {
      hash: vi.fn().mockResolvedValue('hashed_pw'),
      verify: vi.fn().mockImplementation((_hash, plain) => Promise.resolve(plain === 'correct_pw')),
    };

    mockTokenService = {
      generateAccessToken: vi.fn().mockReturnValue('mock_access_jwt'),
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'user-1',
        coachingId: 'coaching-1',
        email: 'owner@test.com',
        roles: [RoleType.OWNER],
        permissions: ['attendance:mark'],
      } as TokenPayload),
      generateRefreshToken: vi.fn().mockReturnValue({
        rawToken: 'mock_raw_refresh_token',
        hashedToken: 'mock_hashed_refresh_token',
        family: 'family-1',
      }),
      hashToken: vi.fn().mockImplementation((raw) => `hash_${raw}`),
    };

    mockLockoutService = {
      isLocked: vi.fn().mockResolvedValue({ locked: false }),
      recordFailedAttempt: vi.fn().mockResolvedValue({ locked: false, attempts: 1 }),
      resetAttempts: vi.fn().mockResolvedValue(undefined),
    };

    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };

    authService = new AuthService(
      userRepo,
      tokenRepo,
      mockPasswordService,
      mockTokenService,
      mockLockoutService,
      mockEventBus,
    );
  });

  it('should authenticate valid credentials and issue tokens', async () => {
    userRepo.users.set('u1', {
      id: 'u1',
      coachingId: 'c1',
      name: 'Owner Alice',
      email: 'alice@coaching.com',
      phone: '9876543210',
      passwordHash: 'hashed_pw',
      isActive: true,
      userRoles: [
        {
          role: {
            code: RoleType.OWNER,
            rolePermissions: [{ permission: { code: 'attendance:mark' } }],
          },
        },
      ],
    });

    const result = await authService.login({
      email: 'alice@coaching.com',
      password: 'correct_pw',
    });

    expect(result.tokens.accessToken).toBe('mock_access_jwt');
    expect(result.tokens.refreshToken).toBe('mock_raw_refresh_token');
    expect(result.user.email).toBe('alice@coaching.com');
    expect(result.user.roles).toContain(RoleType.OWNER);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('should reject invalid password and record failed lockout attempt', async () => {
    userRepo.users.set('u1', {
      id: 'u1',
      coachingId: 'c1',
      name: 'Owner Alice',
      email: 'alice@coaching.com',
      phone: '9876543210',
      passwordHash: 'hashed_pw',
      isActive: true,
      userRoles: [],
    });

    await expect(
      authService.login({
        email: 'alice@coaching.com',
        password: 'wrong_password',
      }),
    ).rejects.toThrow('Invalid email or password');

    expect(mockLockoutService.recordFailedAttempt).toHaveBeenCalledTimes(1);
  });

  it('should reject login if account is locked out', async () => {
    mockLockoutService.isLocked = vi.fn().mockResolvedValue({ locked: true, remainingSeconds: 600 });

    await expect(
      authService.login({
        email: 'alice@coaching.com',
        password: 'any',
      }),
    ).rejects.toThrow(/temporarily locked/);
  });

  it('should detect refresh token reuse and revoke the entire token family', async () => {
    const familyId = 'family-stolen';
    const stolenRaw = 'stolen_token';
    const hashed = `hash_${stolenRaw}`;

    tokenRepo.tokens.set(hashed, {
      id: 'tok-1',
      userId: 'u1',
      tokenHash: hashed,
      family: familyId,
      isRevoked: true, // Already used and revoked!
      expiresAt: new Date(Date.now() + 100000),
    });

    const revokeFamilySpy = vi.spyOn(tokenRepo, 'revokeFamily');

    await expect(authService.refresh(stolenRaw)).rejects.toThrow(/Token reuse detected/);
    expect(revokeFamilySpy).toHaveBeenCalledWith(familyId);
  });
});
