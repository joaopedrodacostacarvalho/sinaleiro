import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { LinhasModule } from './linhas/linhas.module.js';
import { EstacoesModule } from './estacoes/estacoes.module.js';
import { TrensModule } from './trens/trens.module.js';
import { ReportesModule } from './reportes/reportes.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'sinaleiro',
      password: process.env.DB_PASSWORD || 'sinaleiro_dev',
      database: process.env.DB_NAME || 'sinaleiro_db',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    AuthModule,
    UsuariosModule,
    LinhasModule,
    EstacoesModule,
    TrensModule,
    ReportesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
