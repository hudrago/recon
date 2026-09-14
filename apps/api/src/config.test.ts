import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './config';

describe('validateEnvironment', () => {
  it('uses local defaults outside production', () => {
    expect(validateEnvironment({ NODE_ENV: 'test' })).toMatchObject({
      PORT: 3001,
      WEB_URL: 'http://localhost:3000',
      BETTER_AUTH_URL: 'http://localhost:3001',
    });
  });

  it('rejects production startup when durable infrastructure and secrets are missing', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/);
  });

  it('accepts a complete production configuration', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'production',
        PORT: '3001',
        WEB_URL: 'https://recon.example.com',
        BETTER_AUTH_URL: 'https://api.recon.example.com',
        BETTER_AUTH_SECRET: 'a-secure-auth-secret-with-32-characters',
        DATABASE_URL: 'postgresql://recon:password@db.example.com:5432/recon',
        REDIS_URL: 'rediss://redis.example.com:6379',
        SHOPIFY_ORG_ID: 'org_1',
        SHOPIFY_SHOP_DOMAIN: 'merchant.myshopify.com',
        SHOPIFY_CLIENT_ID: 'client-id',
        SHOPIFY_CLIENT_SECRET: 'client-secret',
      }),
    ).toMatchObject({ NODE_ENV: 'production', SHOPIFY_ORG_ID: 'org_1' });
  });
});