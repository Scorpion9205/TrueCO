import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TeacherService } from '../../modules/teachers/teacher.service.js';
import {
  CreateTeacherTransactionInput,
  ITeacherRepository,
  PrismaTeacherRepository,
} from '../../modules/teachers/teacher.repository.js';
import {
  createTeacherSchema,
  updateTeacherSchema,
} from '../../modules/teachers/validators/teacher.validator.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { IPasswordService } from '../../common/security/password.service.js';

class InMemoryTeacherRepository implements ITeacherRepository {
  public teachers = new Map<string, any>();
  public emails = new Set<string>(['owner@sharma.in']);
  public created?: CreateTeacherTransactionInput;

  public async createWithUser(input: CreateTeacherTransactionInput): Promise<any> {
    this.created = input;
    const teacher = { id: 't1', userId: 'u1', isActive: true, teacherBatches: [], ...input };
    this.teachers.set(teacher.id, teacher);
    return teacher;
  }
  public async findById(id: string) {
    return this.teachers.get(id) ?? null;
  }
  public async findByUserId() {
    return null;
  }
  public async findByPhone() {
    return null;
  }
  public async findMany() {
    return [...this.teachers.values()];
  }
  public async emailInUse(email: string) {
    return this.emails.has(email);
  }
  public async update(id: string, data: any) {
    const teacher = { ...this.teachers.get(id), ...data };
    this.teachers.set(id, teacher);
    return teacher;
  }
}

describe('TeacherService', () => {
  let repository: InMemoryTeacherRepository;
  let service: TeacherService;
  const passwords: IPasswordService = {
    hash: vi.fn(async (value: string) => `hashed:${value}`),
    compare: vi.fn(),
  } as unknown as IPasswordService;
  const eventBus = { publish: vi.fn(), subscribe: vi.fn() } as unknown as IEventBus;
  const invalidator = { invalidate: vi.fn() };

  const input = {
    name: 'Anita Rao',
    phone: '9876500001',
    email: 'anita@sharma.in',
    password: 'Welcome@123',
  };

  beforeEach(() => {
    repository = new InMemoryTeacherRepository();
    service = new TeacherService(repository, passwords, eventBus, invalidator);
    vi.clearAllMocks();
  });

  it('creates the teacher with the password the owner chose', async () => {
    const teacher = await service.createTeacher({ ...input, monthlySalary: 0 }, 'c1');
    expect(repository.created?.passwordHash).toBe('hashed:Welcome@123');
    // A zero salary is a real value, not "not set"
    expect(teacher.monthlySalary).toBe(0);
  });

  it('refuses an email someone in the coaching already signs in with', async () => {
    await expect(
      service.createTeacher({ ...input, email: 'owner@sharma.in' }, 'c1'),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN', statusCode: 409 });
    expect(repository.created).toBeUndefined();
  });

  it('clears the subject and salary', async () => {
    await service.createTeacher({ ...input, specialization: 'Maths', monthlySalary: 20000 }, 'c1');
    const updated = await service.updateTeacher('t1', {
      specialization: null,
      monthlySalary: null,
    });
    expect(updated.specialization).toBeNull();
    expect(updated.monthlySalary).toBeNull();
    expect(invalidator.invalidate).not.toHaveBeenCalled();
  });

  it('applies deactivation to the teacher’s next request', async () => {
    await service.createTeacher(input, 'c1');
    await service.updateTeacher('t1', { isActive: false });
    expect(invalidator.invalidate).toHaveBeenCalledWith('u1');
  });

  it('reports a missing teacher', async () => {
    await expect(service.updateTeacher('nope', { name: 'X Y' })).rejects.toMatchObject({
      code: 'TEACHER_NOT_FOUND',
    });
  });
});

describe('teacher validation', () => {
  const base = { name: 'Anita Rao', phone: '9876500001', email: 'anita@sharma.in' };

  it('requires a password of at least 8 characters (the phone is no longer the default)', () => {
    expect(createTeacherSchema.safeParse(base).success).toBe(false);
    expect(createTeacherSchema.safeParse({ ...base, password: 'short' }).success).toBe(false);
    expect(createTeacherSchema.safeParse({ ...base, password: 'Welcome@123' }).success).toBe(true);
  });

  it('accepts null to clear optional fields on update', () => {
    expect(
      updateTeacherSchema.safeParse({ specialization: null, monthlySalary: null }).success,
    ).toBe(true);
  });
});

describe('PrismaTeacherRepository.update', () => {
  function fakePrisma() {
    const calls: Record<string, any[]> = { teacher: [], user: [] };
    const tx = {
      teacher: {
        update: vi.fn(async (args: any) => {
          calls.teacher.push(args);
          return { id: 't1', userId: 'u1', ...args.data };
        }),
      },
      user: {
        update: vi.fn(async (args: any) => {
          calls.user.push(args);
          return {};
        }),
      },
    };
    const prisma = { $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
    return { prisma, calls };
  }

  it('keeps the login account’s name and phone in step', async () => {
    const { prisma, calls } = fakePrisma();
    await new PrismaTeacherRepository(prisma as any).update('t1', {
      name: 'Anita R',
      monthlySalary: 21000,
    });
    expect(calls.user).toEqual([{ where: { id: 'u1' }, data: { name: 'Anita R' } }]);
  });

  it('leaves the account alone when only profile fields change', async () => {
    const { prisma, calls } = fakePrisma();
    await new PrismaTeacherRepository(prisma as any).update('t1', { monthlySalary: 21000 });
    expect(calls.user).toEqual([]);
  });
});
