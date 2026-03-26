import { SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { createApp, createConfig } from '@/app';
import { createValidationPipe } from '@/shared/utils/app.utils';

export const globalValidationPipe = createValidationPipe();

async function bootstrap() {
  const app = await createApp();
  const configService = app.get(ConfigService);
  // 本番環境だった場合、Swagger不要
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = createConfig();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }
  app.useGlobalPipes(globalValidationPipe);
  await app.listen(configService.get<number>('PORT', 8181));
}

void (async () => await bootstrap())();
