import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RbacService } from '../../modules/rbac/rbac.service.js';
import { IRbacRepository } from '../../modules/rbac/rbac.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { RoleType } from '@vargly/types';

class InMemoryRbacRepository implements IRbacRepository {
  public roles: Map<string, any> = new Map();
  public userRoles: Map<string, any> = new Map();

  public async findRoles(_coachingId?: string): Promise<any[]> {
    return Array.from(this.roles.values());
  }

  public async findRoleByCode(code: string, _coachingId?: string): Promise<any | null> {
    for (const r of this.roles.values()) {
      if (r.code === code) return r;
    }
    return null;
  }

  public async findPermissions(): Promise<any[]> {
    return [];
  }

  public async assignRole(userId: string, roleId: string, coachingId: string): Promise<any> {
    const record = {
      userId,
      roleId,
      coachingId,
      createdAt: new Date(),
    };
    this.userRoles.set(`${userId}:${roleId}`, record);
    return record;
  }

  public async findUserRoles(userId: string, _coachingId: string): Promise<any[]> {
    const matches: any[] = [];
    for (const ur of this.userRoles.values()) {
      if (ur.userId === userId) matches.push(ur);
    }
    return matches;
  }
}

describe('RbacService (Phase 1 Domain Unit Tests)', () => {
  let rbacService: RbacService;
  let rbacRepo: InMemoryRbacRepository;
  let mockEventBus: IEventBus;

  beforeEach(() => {
    rbacRepo = new InMemoryRbacRepository();

    rbacRepo.roles.set('r1', {
      id: 'role-teacher',
      code: RoleType.TEACHER,
      name: 'Teacher',
      rolePermissions: [{ permission: { code: 'attendance:mark' } }],
    });

    rbacRepo.roles.set('r2', {
      id: 'role-superadmin',
      code: RoleType.SUPER_ADMIN,
      name: 'Super Admin',
      rolePermissions: [{ permission: { code: '*' } }],
    });

    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };

    rbacService = new RbacService(rbacRepo, mockEventBus);
  });

  it('should allow an Owner to assign the Teacher role to a user', async () => {
    const result = await rbacService.assignRoleToUser(
      'user-target',
      RoleType.TEACHER,
      'coaching-1',
      'owner-caller',
      [RoleType.OWNER],
    );

    expect(result.userId).toBe('user-target');
    expect(result.roleCode).toBe(RoleType.TEACHER);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('should forbid an Owner from assigning the SUPER_ADMIN role', async () => {
    await expect(
      rbacService.assignRoleToUser(
        'user-target',
        RoleType.SUPER_ADMIN,
        'coaching-1',
        'owner-caller',
        [RoleType.OWNER], // Owner lacks privilege to create superadmins
      ),
    ).rejects.toThrow(/not authorized to assign role 'SUPER_ADMIN'/);
  });
});
