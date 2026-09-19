import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { IStorageService } from '../../common/storage/storage.interface.js';
import { MockStorageService } from '../../common/storage/mock-storage.service.js';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { z } from 'zod';

const presignedUrlSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  category: z.enum(['homework', 'test', 'receipt', 'report', 'avatar', 'logo', 'general']).default('general'),
});

const directUploadSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  category: z.enum(['homework', 'test', 'receipt', 'report', 'avatar', 'logo', 'general']).default('general'),
  fileBase64: z.string().min(1),
});

export class StorageController {
  public constructor(private readonly storageService: IStorageService) {}

  public getPresignedUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getRequiredCoachingId();
      const body = presignedUrlSchema.parse(req.body);

      const result = await this.storageService.getPresignedUploadUrl(
        coachingId,
        body.fileName,
        body.mimeType,
        body.category,
      );

      res.status(StatusCodes.OK).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  public directUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coachingId = RequestContextService.getRequiredCoachingId();
      const body = directUploadSchema.parse(req.body);

      const buffer = Buffer.from(body.fileBase64, 'base64');
      const result = await this.storageService.uploadFile({
        coachingId,
        fileName: body.fileName,
        mimeType: body.mimeType,
        category: body.category,
        fileBuffer: buffer,
      });

      res.status(StatusCodes.CREATED).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  public serveFile = async (req: Request, res: Response): Promise<void> => {
    const fileKey = req.params[0];
    if (!fileKey) {
      res.status(StatusCodes.NOT_FOUND).send('Not Found');
      return;
    }

    if (this.storageService instanceof MockStorageService) {
      const file = this.storageService.getFile(fileKey);
      if (!file) {
        res.status(StatusCodes.NOT_FOUND).send('File Not Found');
        return;
      }
      res.setHeader('Content-Type', file.mimeType);
      res.status(StatusCodes.OK).send(file.buffer);
      return;
    }

    res.status(StatusCodes.NOT_IMPLEMENTED).send('External Cloudinary file serving handled via CDN/Presigned URL');
  };
}
