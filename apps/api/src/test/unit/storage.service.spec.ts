import { describe, it, expect } from 'vitest';
import { MockStorageService } from '../../common/storage/mock-storage.service.js';

describe('Storage Service Unit Tests', () => {
  it('should generate presigned upload and public URLs', async () => {
    const service = new MockStorageService();
    const result = await service.getPresignedUploadUrl(
      'coaching-abc',
      'homework1.pdf',
      'application/pdf',
      'homework',
    );

    expect(result.uploadUrl).toBeDefined();
    expect(result.fileUrl).toContain('.pdf');
    expect(result.fileKey).toContain('coaching-abc/homework/');
    expect(result.expiresInSeconds).toBe(3600);
  });

  it('should store and serve files via direct upload in mock storage', async () => {
    const service = new MockStorageService();
    const buffer = Buffer.from('test content for homework');

    const result = await service.uploadFile({
      coachingId: 'coaching-123',
      fileName: 'test.txt',
      mimeType: 'text/plain',
      category: 'homework',
      fileBuffer: buffer,
    });

    expect(result.fileKey).toBeDefined();
    expect(result.sizeBytes).toBe(buffer.length);

    const retrieved = service.getFile(result.fileKey);
    expect(retrieved).toBeDefined();
    expect(retrieved?.buffer.toString('utf8')).toBe('test content for homework');
  });

  it('should delete files upon request', async () => {
    const service = new MockStorageService();
    const upload = await service.uploadFile({
      coachingId: 'c1',
      fileName: 'delete-me.txt',
      mimeType: 'text/plain',
      category: 'general',
      fileBuffer: Buffer.from('bye'),
    });

    const deleted = await service.deleteFile(upload.fileKey);
    expect(deleted).toBe(true);

    const retrieved = service.getFile(upload.fileKey);
    expect(retrieved).toBeUndefined();
  });
});
