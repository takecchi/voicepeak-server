import { DocumentBuilder } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IncomingMessage } from 'node:http';
import express from 'express';
import { LoggingService } from '@/shared/logging.service';
import { GlobalExceptionFilter } from '@/global-exception.filter';

export const createConfig = () => {
  return new DocumentBuilder()
    .setTitle('VOICEPEAK API')
    .setDescription('The VOICEPEAK API description')
    .setVersion(process.env.npm_package_version ?? '0.0.1')
    .build();
};

export const createApp = async () => {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new LoggingService(),
    rawBody: true,
  });
  app.use(
    express.json({
      type: ['application/json'],
      limit: '10mb',
      verify(req: { rawBody?: Buffer | string } & IncomingMessage, _, buf, __) {
        req.rawBody = buf;
      },
    }),
  );
  app.enableCors({
    credentials: true,
    origin: (origin, callback) => {
      // 環境関係なく全部許可する
      callback(null, true);
    },
    exposedHeaders: ['X-Session-Id', 'Content-Disposition'],
  });
  app.useGlobalFilters(new GlobalExceptionFilter());
  return app;
};
