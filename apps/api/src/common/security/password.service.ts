import * as argon2 from 'argon2';
import { logger } from '../logger/logger.service.js';

export interface IPasswordService {
  hash(password: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export class PasswordService implements IPasswordService {
  private static instance: PasswordService;

  // OWASP Recommended Argon2id parameters
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,       // 3 iterations
    parallelism: 2,    // 2 threads
  };

  public static getInstance(): PasswordService {
    if (!PasswordService.instance) {
      PasswordService.instance = new PasswordService();
    }
    return PasswordService.instance;
  }

  public async hash(password: string): Promise<string> {
    try {
      return await argon2.hash(password, this.options);
    } catch (err) {
      logger.error('Failed to hash password with Argon2id:', err);
      throw new Error('Password hashing failed', { cause: err });
    }
  }

  public async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch (err) {
      logger.warn('Password verification encountered error:', { err });
      return false;
    }
  }
}

export const passwordService = PasswordService.getInstance();
