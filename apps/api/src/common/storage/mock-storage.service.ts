import crypto from 'node:crypto';
import {
  IStorageService,
  PresignedUrlResult,
  UploadFileInput,
  UploadFileResult,
} from './storage.interface.js';
import { envConfig } from '../../config/env.config.js';

export class MockStorageService implements IStorageService {
  private readonly files: Map<string, { buffer: Buffer; mimeType: string }> = new Map();

  public async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    const fileExt = input.fileName.includes('.') ? input.fileName.split('.').pop() : 'bin';
    const fileKey = `${input.coachingId}/${input.category}/${crypto.randomUUID()}.${fileExt}`;
    const baseUrl = envConfig.get('API_BASE_URL') || 'http://localhost:4000';
    const fileUrl = `${baseUrl}/api/v1/storage/files/${fileKey}`;

    this.files.set(fileKey, {
      buffer: input.fileBuffer,
      mimeType: input.mimeType,
    });

    return {
      fileUrl,
      fileKey,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.fileBuffer.length,
    };
  }

  public async getPresignedUploadUrl(
    coachingId: string,
    fileName: string,
    _mimeType: string,
    category: string,
  ): Promise<PresignedUrlResult> {
    const fileExt = fileName.includes('.') ? fileName.split('.').pop() : 'bin';
    const fileKey = `${coachingId}/${category}/${crypto.randomUUID()}.${fileExt}`;
    const baseUrl = envConfig.get('API_BASE_URL') || 'http://localhost:4000';

    return {
      uploadUrl: `${baseUrl}/api/v1/storage/upload-direct?key=${encodeURIComponent(fileKey)}`,
      fileUrl: `${baseUrl}/api/v1/storage/files/${fileKey}`,
      fileKey,
      expiresInSeconds: 3600,
    };
  }

  public async deleteFile(fileKey: string): Promise<boolean> {
    return this.files.delete(fileKey);
  }

  public getFile(fileKey: string): { buffer: Buffer; mimeType: string } | undefined {
    return this.files.get(fileKey);
  }
}
