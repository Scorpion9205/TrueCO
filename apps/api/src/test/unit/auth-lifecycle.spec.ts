import { describe, it, expect } from 'vitest';
import { AuthService } from '../../modules/auth/auth.service.js';
import { TokenService } from '../../common/security/token.service.js';
import { PasswordService } from '../../common/security/password.service.js';
import { InMemoryAuthActionTokenRepository } from '../fakes/in-memory-auth-action-token.repository.js';

describe('Auth Lifecycle Unit Tests (Forgot/Reset Password, GetMe, Verification)', () => {
  const mockUserRepo = {
    findByEmail: async (email: string) => {
      if (email === 'user@example.com') {
        return {
          id: 'u1',
          name: 'Teacher John',
          email: 'user@example.com',
          phone: '+919876543210',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummy',
          isActive: true,
          coachingId: 'c1',
          userRoles: [{ role: { code: 'TEACHER', rolePermissions: [] } }],
        };
      }
      return null;
    },
    findById: async (id: string) => {
      if (id === 'u1') {
        return {
          id: 'u1',
          name: 'Teacher John',
          email: 'user@example.com',
          phone: '+919876543210',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummy',
          isActive: true,
          coachingId: 'c1',
          userRoles: [{ role: { code: 'TEACHER', rolePermissions: [] } }],
        };
      }
      return null;
    },
    updateLastLogin: async () => {},
    updatePassword: async (userId: string, hash: string) => {
      passwordUpdates.push({ userId, hash });
    },
    markEmailVerified: async (userId: string) => {
      verifiedUsers.push(userId);
    },
  };
  const passwordUpdates: Array<{ userId: string; hash: string }> = [];
  const verifiedUsers: string[] = [];
  const actionTokens = new InMemoryAuthActionTokenRepository();
  const tokenService = TokenService.getInstance();

  const mockRefreshRepo = {
    create: async () => ({} as any),
    findByTokenHash: async () => null,
    revoke: async () => {},
    revokeFamily: async () => {},
    revokeAllForUser: async () => {},
  };

  const mockLockoutService = {
    isLocked: async () => ({ locked: false }),
    recordFailedAttempt: async () => ({ locked: false, remainingAttempts: 4 }),
    reset: async () => {},
  };

  const mockEventBus = {
    publish: async () => {},
    subscribe: () => {},
  };

  const authService = new AuthService(
    mockUserRepo as any,
    mockRefreshRepo as any,
    new PasswordService(),
    TokenService.getInstance(),
    mockLockoutService as any,
    mockEventBus as any,
    undefined,
    actionTokens,
  );

  it('getMe should retrieve profile for valid user', async () => {
    const user = await authService.getMe('u1');
    expect(user.id).toBe('u1');
    expect(user.name).toBe('Teacher John');
    expect(user.roles).toContain('TEACHER');
  });

  it('forgotPassword should return generic message for any email', async () => {
    const resExisting = await authService.forgotPassword('user@example.com');
    expect(resExisting.message).toContain('password reset link has been dispatched');

    const resNonExisting = await authService.forgotPassword('nonexistent@example.com');
    expect(resNonExisting.message).toContain('password reset link has been dispatched');
  });

  it('resetPassword should reject unknown tokens', async () => {
    await expect(authService.resetPassword('invalid.token.here', 'newPassword123')).rejects.toThrow(
      'invalid, expired or already used',
    );
  });

  it('forgotPassword issues a single live reset token and retires earlier ones', async () => {
    await authService.forgotPassword('user@example.com');
    await authService.forgotPassword('user@example.com');

    const resets = actionTokens.tokens.filter((t) => t.userId === 'u1' && t.purpose === 'PASSWORD_RESET');
    expect(resets.length).toBeGreaterThanOrEqual(2);
    expect(resets.filter((t) => !t.usedAt)).toHaveLength(1);
    // Only the hash is stored, never the raw token
    expect(resets.every((t) => /^[0-9a-f]{64}$/.test(t.tokenHash))).toBe(true);
  });

  it('resetPassword works once; replaying the same link fails', async () => {
    const raw = 'known-reset-token-0123456789';
    await actionTokens.issue('u1', 'PASSWORD_RESET', tokenService.hashToken(raw), new Date(Date.now() + 60_000));

    await expect(authService.resetPassword(raw, 'NewPassw0rd!')).resolves.toMatchObject({
      message: expect.stringContaining('reset successfully'),
    });
    expect(passwordUpdates.at(-1)?.userId).toBe('u1');

    await expect(authService.resetPassword(raw, 'AnotherPassw0rd!')).rejects.toThrow('already used');
  });

  it('resetPassword rejects an expired token', async () => {
    const raw = 'expired-reset-token-0123456789';
    await actionTokens.issue('u1', 'PASSWORD_RESET', tokenService.hashToken(raw), new Date(Date.now() - 1));
    await expect(authService.resetPassword(raw, 'NewPassw0rd!')).rejects.toThrow('expired');
  });

  it('verifyEmail marks the user verified once and rejects reuse or wrong-purpose tokens', async () => {
    const raw = await authService.issueEmailVerification('u1', 'user@example.com');

    // A verification token cannot be used as a password reset token
    await expect(authService.resetPassword(raw, 'NewPassw0rd!')).rejects.toThrow();

    await expect(authService.verifyEmail(raw)).resolves.toEqual({ message: 'Email verified successfully.' });
    expect(verifiedUsers).toContain('u1');
    await expect(authService.verifyEmail(raw)).rejects.toThrow('already used');
  });
});
