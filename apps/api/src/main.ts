import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { buildCorsOptions } from './common/config/cors.config.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const isProd = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: isProd ? undefined : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: isProd ? undefined : false,
      hsts: isProd ? undefined : false,
    }),
  );

  app.enableCors(buildCorsOptions());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Sinaleiro API")
    .setDescription("API do Sinaleiro, um app para um Metrorec Colaborativo. \
      Reporte e consulte em tempo real o status das linhas, estações \
      e trens do Metrô do Recife.")
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'ID Token emitido pelo Firebase Authentication',
      },
      'firebase-auth',
    )
    .addTag('auth', 'Autenticação e identidade')
    .addTag('usuarios', 'Perfis e reputação dos usuários')
    .addTag('linhas', 'Linhas e sentidos do Metrorec')
    .addTag('estacoes', 'Estações e suas localizações')
    .addTag('trens', 'Trens em circulação')
    .addTag('reportes', 'Reportes colaborativos e confirmações')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Sinaleiro API Docs'
  });

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
await bootstrap();
