import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  // Graceful shutdown — lets TypeORM and other providers clean up on SIGTERM/SIGINT
  app.enableShutdownHooks();

  // Global validation pipe — strip unknown fields and reject non-whitelisted properties
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global exception filter — consistent error responses and 5xx logging
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS — allow origins defined in ALLOWED_ORIGINS env var (comma-separated)
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  const port = parseInt(process.env.PORT ?? '3004', 10);
  await app.listen(port);
}

void bootstrap();
