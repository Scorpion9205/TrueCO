import { Router } from 'express';
import { IStorageService } from '../../common/storage/storage.interface.js';
import { MockStorageService } from '../../common/storage/mock-storage.service.js';
import { CloudinaryStorageService } from '../../common/storage/cloudinary-storage.service.js';
import { envConfig } from '../../config/env.config.js';
import { StorageController } from './storage.controller.js';
import { createStorageRoutes } from './storage.routes.js';

export class StorageModule {
  public static init(customStorageService?: IStorageService): {
    router: Router;
    storageService: IStorageService;
  } {
    let storageService = customStorageService;

    if (!storageService) {
      const hasCloudinary = Boolean(
        envConfig.get('CLOUDINARY_URL') ||
          (envConfig.get('CLOUDINARY_CLOUD_NAME') &&
            envConfig.get('CLOUDINARY_API_KEY') &&
            envConfig.get('CLOUDINARY_API_SECRET')),
      );

      if (hasCloudinary) {
        storageService = new CloudinaryStorageService();
      } else {
        storageService = new MockStorageService();
      }
    }

    const controller = new StorageController(storageService);
    const router = createStorageRoutes(controller);

    return { router, storageService };
  }
}
