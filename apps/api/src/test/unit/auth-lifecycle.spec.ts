import { describe, it, expect } from 'vitest';
import { AuthService } from '../../modules/auth/auth.service.js';
import { TokenService } from '../../common/security/token.service.js';
import { PasswordService } from '../../common/security/password.service.js';

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
    updatePassword: async () => {},
  };

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

  it('resetPassword should reject invalid or expired tokens', async () => {
    await expect(authService.resetPassword('invalid.token.here', 'newPassword123')).rejects.toThrow(
      'Password reset token is invalid or has expired',
    );
  });
});
