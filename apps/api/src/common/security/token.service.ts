import crypto from 'node:crypto';
import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { envConfig } from '../../config/env.config.js';
import { RoleType } from '@trueco/types';
import { logger } from '../logger/logger.service.js';

export interface TokenPayload {
  readonly sub: string; // userId
  readonly coachingId?: string;
  readonly email: string;
  readonly roles: RoleType[];
  readonly permissions: string[];
}

export interface ITokenService {
  generateAccessToken(payload: TokenPayload): string;
  verifyAccessToken(token: string): TokenPayload;
  generateRefreshToken(): { rawToken: string; hashedToken: string; family: string };
  hashToken(token: string): string;
}

export class TokenService implements ITokenService {
  private static instance: TokenService;
  private readonly privateKey: string;
  private readonly publicKey: string;

  private constructor() {
    // Generate an RSA 2048-bit key pair for asymmetric RS256 token signing
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    logger.info('[TokenService] Initialized RS256 asymmetric cryptographic keys');
  }

  public static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  public getPublicKey(): string {
    return this.publicKey;
  }

  public generateAccessToken(payload: TokenPayload): string {
    const options: SignOptions = {
      algorithm: 'RS256',
      expiresIn: envConfig.get('JWT_ACCESS_EXPIRES_IN') as any,
      issuer: 'trueco-auth-service',
      audience: 'trueco-clients',
    };

    return jwt.sign(payload, this.privateKey, options);
  }

  public verifyAccessToken(token: string): TokenPayload {
    const options: VerifyOptions = {
      algorithms: ['RS256'],
      issuer: 'trueco-auth-service',
      audience: 'trueco-clients',
    };

    const decoded = jwt.verify(token, this.publicKey, options) as jwt.JwtPayload;
    return {
      sub: decoded.sub as string,
      coachingId: decoded.coachingId as string | undefined,
      email: decoded.email as string,
      roles: (decoded.roles || []) as RoleType[],
      permissions: (decoded.permissions || []) as string[],
    };
  }

  public generateRefreshToken(): { rawToken: string; hashedToken: string; family: string } {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const family = crypto.randomUUID();
    const hashedToken = this.hashToken(rawToken);

    return { rawToken, hashedToken, family };
  }

  public hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

export const tokenService = TokenService.getInstance();
