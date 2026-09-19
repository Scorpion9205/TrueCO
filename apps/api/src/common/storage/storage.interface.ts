export interface UploadFileInput {
  readonly coachingId: string;
  readonly fileBuffer: Buffer;
  readonly fileName: string;
  readonly mimeType: string;
  readonly category: 'homework' | 'test' | 'receipt' | 'report' | 'avatar' | 'logo' | 'general';
}

export interface UploadFileResult {
  readonly fileUrl: string;
  readonly fileKey: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface PresignedUrlResult {
  readonly uploadUrl: string;
  readonly fileUrl: string;
  readonly fileKey: string;
  readonly expiresInSeconds: number;
}

export interface IStorageService {
  uploadFile(input: UploadFileInput): Promise<UploadFileResult>;
  getPresignedUploadUrl(
    coachingId: string,
    fileName: string,
    mimeType: string,
    category: string,
  ): Promise<PresignedUrlResult>;
  deleteFile(fileKey: string): Promise<boolean>;
}
