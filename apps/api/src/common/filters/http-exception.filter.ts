import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

export interface ErroPadronizadoResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
  details?: Record<string, unknown>;
}

interface PostgresDriverError {
  code?: string;
  detail?: string;
  constraint?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, error, message, details } =
      this.extrairDadosErro(exception);

    const payload: ErroPadronizadoResponse = {
      statusCode,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(details ? { details } : {}),
    };

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      const resumo = Array.isArray(message) ? message.join('; ') : message;
      this.logger.warn(`${request.method} ${request.url} -> ${statusCode}: ${resumo}`);
    }

    response.status(statusCode).json(payload);
  }

  private extrairDadosErro(exception: unknown): {
    statusCode: number;
    error: string;
    message: string | string[];
    details?: Record<string, unknown>;
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        return {
          statusCode,
          error: HttpStatus[statusCode] ?? 'HttpException',
          message: res,
        };
      }

      if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, unknown>;
        const rawMessage = body.message;
        const message =
          typeof rawMessage === 'string' || Array.isArray(rawMessage)
            ? (rawMessage as string | string[])
            : exception.message;

        const error =
          typeof body.error === 'string'
            ? body.error
            : (HttpStatus[statusCode] ?? 'HttpException');

        const extras: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(body)) {
          if (key !== 'message' && key !== 'error' && key !== 'statusCode') {
            extras[key] = val;
          }
        }

        return {
          statusCode,
          error,
          message,
          ...(Object.keys(extras).length > 0 ? { details: extras } : {}),
        };
      }
    }

    if (exception instanceof QueryFailedError) {
      return this.mapearErroPostgres(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Erro interno do servidor',
    };
  }

  private mapearErroPostgres(exception: QueryFailedError): {
    statusCode: number;
    error: string;
    message: string;
  } {
    const driverError = exception.driverError as
      | PostgresDriverError
      | undefined;

    switch (driverError?.code) {
      case '23505':
        return {
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'Conflito de dados: registro duplicado',
        };
      case '23503':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Referência inválida para registro relacionado',
        };
      case '23514':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Dados violam restrição de integridade do banco',
        };
      case '22P02':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Formato de identificador ou parâmetro inválido',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: 'Erro de persistência no banco de dados',
        };
    }
  }
}
