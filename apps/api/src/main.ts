import 'dotenv/config';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AUTH_SESSION_PROVIDER, type AuthSessionProvider } from './auth/auth.types';
import { rawJsonBodyParser } from './common/rawJsonBody';
import { validateEnvironment } from './config';

async function bootstrap() {
  const config = validateEnvironment();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableCors({ origin: config.WEB_URL, credentials: true });

  const sessions = app.get<AuthSessionProvider>(AUTH_SESSION_PROVIDER);
  if (sessions.handler) {
    app.getHttpAdapter().getInstance().all('/api/auth/*', sessions.handler);
  }
  app.use(rawJsonBodyParser);

  await app.listen(config.PORT);
  Logger.log(`Persistence: ${process.env.DATABASE_URL ? 'Postgres (Prisma)' : 'in-memory (no DATABASE_URL set)'}`, 'Bootstrap');
}

bootstrap();
