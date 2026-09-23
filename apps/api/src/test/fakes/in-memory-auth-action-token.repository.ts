import {
  AuthActionPurpose,
  IAuthActionTokenRepository,
} from '../../modules/auth/auth.repository.js';

interface StoredActionToken {
  userId: string;
  purpose: AuthActionPurpose;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export class InMemoryAuthActionTokenRepository implements IAuthActionTokenRepository {
  public readonly tokens: StoredActionToken[] = [];

  public async issue(
    userId: string,
    purpose: AuthActionPurpose,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    for (const t of this.tokens) {
      if (t.userId === userId && t.purpose === purpose && !t.usedAt) t.usedAt = new Date();
    }
    this.tokens.push({ userId, purpose, tokenHash, expiresAt, usedAt: null });
  }

  public async consume(tokenHash: string, purpose: AuthActionPurpose): Promise<string | null> {
    const token = this.tokens.find((t) => t.tokenHash === tokenHash && t.purpose === purpose);
    if (!token || token.usedAt || token.expiresAt.getTime() <= Date.now()) return null;
    token.usedAt = new Date();
    return token.userId;
  }
}
