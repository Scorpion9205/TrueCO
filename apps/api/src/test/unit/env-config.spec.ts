import { describe, it, expect } from 'vitest';
import { parseEnvConfig } from '../../config/env.config.js';

const strong = (label: string) => `${label}-f3a9c2e7b1d84b6fa0c5e9d2b7a14c8e`;

const secureProductionEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://app:pw@db:5432/vargly',
  JWT_ACCESS_SECRET: strong('access'),
  JWT_REFRESH_SECRET: strong('refresh'),
  DATABASE_ENCRYPTION_KEY: strong('dbkey'),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: strong('verify'),
  JWT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\n...',
  JWT_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\\n...',
};

function failingKeys(env: Record<string, string | undefined>): string[] {
  const result = parseEnvConfig(env as NodeJS.ProcessEnv);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
}

describe('environment configuration', () => {
  it('accepts a production config with unique secrets and a JWT keypair', () => {
    expect(parseEnvConfig(secureProductionEnv).success).toBe(true);
  });

  it('rejects built-in default secrets in production', () => {
    const keys = failingKeys({
      ...secureProductionEnv,
      DATABASE_ENCRYPTION_KEY: undefined,
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: undefined,
      JWT_ACCESS_SECRET: 'vargly_dev_access_super_secret_key_change_in_production_32char',
    });
    expect(keys).toEqual(
      expect.arrayContaining(['DATABASE_ENCRYPTION_KEY', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'JWT_ACCESS_SECRET']),
    );
  });

  it('rejects short secrets and a missing JWT keypair in production', () => {
    const keys = failingKeys({
      ...secureProductionEnv,
      JWT_REFRESH_SECRET: 'short-but-16-chars',
      JWT_PRIVATE_KEY: undefined,
      JWT_PUBLIC_KEY: undefined,
    });
    expect(keys).toEqual(expect.arrayContaining(['JWT_REFRESH_SECRET', 'JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY']));
  });

  it('keeps development defaults usable', () => {
    expect(parseEnvConfig({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://localhost/dev' }).success).toBe(true);
  });

  it('parses TRUST_PROXY as boolean, hop count or subnet list', () => {
    const parse = (value: string) => {
      const result = parseEnvConfig({ NODE_ENV: 'development', DATABASE_URL: 'x', TRUST_PROXY: value });
      return result.success ? result.data.TRUST_PROXY : 'invalid';
    };
    expect(parse('false')).toBe(false);
    expect(parse('1')).toBe(1);
    expect(parse('10.0.0.0/8')).toBe('10.0.0.0/8');
  });
});
