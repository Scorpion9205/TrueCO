import { describe, it, expect } from 'vitest';
import { RecipientResolverService } from '../../modules/notifications/services/recipient-resolver.service.js';

describe('RecipientResolverService Unit Tests', () => {
  it('should resolve direct phone numbers directly', async () => {
    const resolver = new RecipientResolverService({} as any);
    const result = await resolver.resolveRecipients('+919876543210', 'test-coaching-id');

    expect(result).toHaveLength(1);
    expect(result[0].phone).toBe('+919876543210');
    expect(result[0].recipientType).toBe('PARENT');
  });

  it('should resolve direct emails directly', async () => {
    const resolver = new RecipientResolverService({} as any);
    const result = await resolver.resolveRecipients('parent@example.com', 'test-coaching-id');

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('parent@example.com');
  });

  it('should resolve student parent contact from database', async () => {
    const mockPrisma = {
      student: {
        findFirst: async () => ({
          id: 'student-123',
          firstName: 'Aarav',
          lastName: 'Sharma',
          studentParents: [
            {
              isPrimary: true,
              parent: {
                id: 'parent-456',
                firstName: 'Rajesh',
                lastName: 'Sharma',
                phone: '+919876500001',
                email: 'rajesh@example.com',
              },
            },
          ],
        }),
      },
    };

    const resolver = new RecipientResolverService(mockPrisma as any);
    const result = await resolver.resolveRecipients('student:student-123:parent', 'test-coaching-id');

    expect(result).toHaveLength(1);
    expect(result[0].phone).toBe('+919876500001');
    expect(result[0].email).toBe('rajesh@example.com');
    expect(result[0].name).toBe('Rajesh Sharma');
  });

  it('should resolve batch students for group fanning out', async () => {
    const mockPrisma = {
      batchStudent: {
        findMany: async () => [
          {
            student: {
              id: 's1',
              firstName: 'Aarav',
              lastName: 'Sharma',
              phone: '+919876500001',
            },
          },
          {
            student: {
              id: 's2',
              firstName: 'Priya',
              lastName: 'Verma',
              phone: '+919876500002',
            },
          },
        ],
      },
    };

    const resolver = new RecipientResolverService(mockPrisma as any);
    const result = await resolver.resolveRecipients('batch:batch-999:students', 'test-coaching-id');

    expect(result).toHaveLength(2);
    expect(result[0].phone).toBe('+919876500001');
    expect(result[1].phone).toBe('+919876500002');
  });
});
