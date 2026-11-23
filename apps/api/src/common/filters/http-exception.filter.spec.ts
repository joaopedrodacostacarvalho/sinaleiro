import { ArgumentsHost, Logger, BadRequestException, ConflictException } from "@nestjs/common";
import { QueryFailedError } from "typeorm";
import { HttpExceptionFilter, ErroPadronizadoResponse } from "./http-exception.filter.js";

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let host: ArgumentsHost;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    filter = new HttpExceptionFilter();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({ method: 'POST', url: '/reportes' }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('padroniza erros de validação do ValidationPipe (array de mensagens)', () => {
    const exception = new BadRequestException([
      'tipo must be a valid enum value',
      'estacao_id must be an integer number',
    ]);

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(400);
    const body = jsonMock.mock.calls[0][0] as ErroPadronizadoResponse;
    expect(body.statusCode).toBe(400);
    expect(body.error).toBe('Bad Request');
    expect(body.message).toEqual([
      'tipo must be a valid enum value',
      'estacao_id must be an integer number',
    ]);
    expect(body.path).toBe('/reportes');
    expect(body.timestamp).toBeDefined();
  });

  it('preserva campos adicionais em details (ex.: reporte existente em 409)', () => {
    const exception = new ConflictException({
      message: 'Reporte duplicado',
      reporte: { id: 'rep-123' },
    });

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'Reporte duplicado',
        details: { reporte: { id: 'rep-123' } },
      }),
    );
  });

  it('converte violação de unicidade do PostgreSQL (23505) em 409 Conflict', () => {
    const driverErr = Object.assign(new Error('duplicate key'), {
      code: '23505',
    });
    const exception = new QueryFailedError('INSERT INTO ...', [], driverErr);

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        error: 'Conflict',
      }),
    );
  });

  it('converte violação de check constraint do PostgreSQL (23514) em 400 Bad Request', () => {
    const driverErr = Object.assign(new Error('check constraint'), {
      code: '23514',
    });
    const exception = new QueryFailedError('INSERT INTO ...', [], driverErr);

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
      }),
    );
  });

  it('oculta stack trace e retorna 500 padronizado para erros inesperados', () => {
    filter.catch(new Error('Falha de conexão interna'), host);

    expect(statusMock).toHaveBeenCalledWith(500);
    const body = jsonMock.mock.calls[0][0] as ErroPadronizadoResponse;
    expect(body).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Erro interno do servidor',
      path: '/reportes',
    });
    expect(JSON.stringify(body)).not.toContain('Falha de conexão interna');
  });
});
