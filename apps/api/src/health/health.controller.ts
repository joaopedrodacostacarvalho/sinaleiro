import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';

export interface HealthCheckResponse {
  status: 'ok';
  database: 'up';
  timestamp: string;
}

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) { }

  @Get()
  @ApiOperation({
    summary: 'Verifica a disponibilidade da API e a conexão com o PostgreSQL',
  })
  @ApiResponse({
    status: 200,
    description: 'API operacional e banco de dados respondendo',
  })
  @ApiResponse({
    status: 503,
    description: 'Falha de conexão ou indisponibilidade do PostgreSQL',
  })
  async check(): Promise<HealthCheckResponse> {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        database: 'up',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException('Banco de dados indisponível');
    }
  }
}
