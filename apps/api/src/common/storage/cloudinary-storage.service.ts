import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import {
  IStorageService,
  PresignedUrlResult,
  UploadFileInput,
  UploadFileResult,
} from './storage.interface.js';
import { envConfig } from '../../config/env.config.js';
import { logger } from '../logger/logger.service.js';

export class CloudinaryStorageService implements IStorageService {
  private readonly isConfigured: boolean;
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  public constructor() {
    this.cloudName = (envConfig.get('CLOUDINARY_CLOUD_NAME') as string) || '';
    this.apiKey = (envConfig.get('CLOUDINARY_API_KEY') as string) || '';
    this.apiSecret = (envConfig.get('CLOUDINARY_API_SECRET') as string) || '';

    const cloudinaryUrl = envConfig.get('CLOUDINARY_URL');

    if (cloudinaryUrl) {
      cloudinary.config({ cloudinary_url: cloudinaryUrl });
      this.isConfigured = true;
    } else if (this.cloudName && this.apiKey && this.apiSecret) {
      cloudinary.config({
        cloud_name: this.cloudName,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        secure: true,
      });
      this.isConfigured = true;
    } else {
      this.isConfigured = false;
      logger.warn('[CloudinaryStorageService] Cloudinary credentials not configured');
    }
  }

  public async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured. Please supply CLOUDINARY credentials in .env');
    }

    const folder = `trueco/${input.coachingId}/${input.category}`;
    const cleanFileName = input.fileName.replace(/\.[^/.]+$/, '');

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: `${cleanFileName}_${Date.now()}`,
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true,
        },
        (error: any, result?: UploadApiResponse) => {
          if (error || !result) {
            logger.error('[CloudinaryStorageService] Upload failed', { error });
            return reject(error || new Error('Upload to Cloudinary failed'));
          }

          resolve({
            fileUrl: result.secure_url,
            fileKey: result.public_id,
            fileName: input.fileName,
            mimeType: input.mimeType,
            sizeBytes: result.bytes,
          });
        },
      );

      uploadStream.end(input.fileBuffer);
    });
  }

  public async getPresignedUploadUrl(
    coachingId: string,
    fileName: string,
    _mimeType: string,
    category: string,
  ): Promise<PresignedUrlResult> {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured');
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder = `trueco/${coachingId}/${category}`;
    const cleanFileName = fileName.replace(/\.[^/.]+$/, '');
    const publicId = `${folder}/${cleanFileName}_${Date.now()}`;

    const signature = cloudinary.utils.api_sign_request(
      {
        folder,
        public_id: publicId,
        timestamp,
      },
      this.apiSecret,
    );

    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`;
    const fileUrl = `https://res.cloudinary.com/${this.cloudName}/raw/upload/${publicId}`;

    return {
      uploadUrl: `${uploadUrl}?api_key=${this.apiKey}&timestamp=${timestamp}&signature=${signature}&folder=${folder}&public_id=${publicId}`,
      fileUrl,
      fileKey: publicId,
      expiresInSeconds: 3600,
    };
  }

  public async deleteFile(fileKey: string): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      const res = await cloudinary.uploader.destroy(fileKey, { invalidate: true });
      return res.result === 'ok';
    } catch (err) {
      logger.error('[CloudinaryStorageService] Delete file failed', { err, fileKey });
      return false;
    }
  }
}
