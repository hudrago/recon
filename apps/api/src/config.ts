import { z } from 'zod';

const productionEnvironmentSchema = z
  .object({
    NODE_ENV: z.literal("production"),
    PORT: z.coerce.number().int().positive().default(3001),
    WEB_URL: z.string().url(),
    BETTER_AUTH_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) =>
          value.startsWith("postgresql://") || value.startsWith("postgres://"),
        "Must be a PostgreSQL URL",
      ),
    REDIS_URL: z
      .string()
      .url()
      .refine(
        (value) =>
          value.startsWith("redis://") || value.startsWith("rediss://"),
        "Must be a Redis URL",
      ),
    SHOPIFY_ORG_ID: z.string().min(1),
    SHOPIFY_SHOP_DOMAIN: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i),
    SHOPIFY_CLIENT_ID: z.string().min(1),
    SHOPIFY_CLIENT_SECRET: z.string().min(1),
    BILLING_ENABLED: z.coerce.boolean().default(false),
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    STRIPE_PRICE_STARTER: z.string().min(1).optional(),
    STRIPE_PRICE_GROWTH: z.string().min(1).optional(),
    STRIPE_PRICE_PRO: z.string().min(1).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    AI_ENABLED: z.coerce.boolean().default(false),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_MODEL: z.string().min(1).optional(),
    OPENAI_BASE_URL: z.string().url().default("https://eu.api.openai.com/v1"),
  })
  .refine(
    (value) =>
      !value.BILLING_ENABLED ||
      Boolean(
        value.STRIPE_SECRET_KEY &&
        value.STRIPE_WEBHOOK_SECRET &&
        value.STRIPE_PRICE_STARTER &&
        value.STRIPE_PRICE_GROWTH &&
        value.STRIPE_PRICE_PRO,
      ),
    {
      message:
        "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and every STRIPE_PRICE_* variable are required when BILLING_ENABLED is true",
    },
  )
  .refine(
    (value) => Boolean(value.RESEND_API_KEY) === Boolean(value.EMAIL_FROM),
    { message: "RESEND_API_KEY and EMAIL_FROM must be provided together" },
  )
  .refine(
    (value) =>
      !value.AI_ENABLED || Boolean(value.OPENAI_API_KEY && value.OPENAI_MODEL),
    {
      message:
        "OPENAI_API_KEY and OPENAI_MODEL are required when AI_ENABLED is true",
    },
  )
  .refine(
    // GDPR/EU-residency guardrail: production must never be able to silently call OpenAI's
    // global endpoint, even via a fat-fingered env override. See docs/architecture ADR 0002.
    (value) => value.OPENAI_BASE_URL.startsWith("https://eu.api.openai.com"),
    {
      message:
        "OPENAI_BASE_URL must be the EU regional endpoint (https://eu.api.openai.com) in production",
    },
  );

const developmentEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test"]).optional(),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3001"),
  BILLING_ENABLED: z.coerce.boolean().default(false),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_STARTER: z.string().min(1).optional(),
  STRIPE_PRICE_GROWTH: z.string().min(1).optional(),
  STRIPE_PRICE_PRO: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  AI_ENABLED: z.coerce.boolean().default(false),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  OPENAI_BASE_URL: z.string().url().default("https://eu.api.openai.com/v1"),
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