import { z } from 'zod';

const productionEnvironmentSchema = z.object({
  NODE_ENV: z.literal('production'),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_URL: z.string().url(),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url().refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), 'Must be a PostgreSQL URL'),
  REDIS_URL: z.string().url().refine((value) => value.startsWith('redis://') || value.startsWith('rediss://'), 'Must be a Redis URL'),
  SHOPIFY_ORG_ID: z.string().min(1),
  SHOPIFY_SHOP_DOMAIN: z.string().regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i),
  SHOPIFY_CLIENT_ID: z.string().min(1),
  SHOPIFY_CLIENT_SECRET: z.string().min(1),
});

const developmentEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test']).optional(),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3001'),
});

export function validateEnvironment(environment: NodeJS.ProcessEnv = process.env) {
  const schema = environment.NODE_ENV === 'production' ? productionEnvironmentSchema : developmentEnvironmentSchema;
  const result = schema.safeParse(environment);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return result.data;
}