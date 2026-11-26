import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('retorna status ok quando SELECT 1 responde com sucesso', async () => {
    const queryMock = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    const controller = new HealthController({
      query: queryMock,
    } as unknown as DataSource);

    const resultado = await controller.check();

    expect(queryMock).toHaveBeenCalledWith('SELECT 1');
    expect(resultado.status).toBe('ok');
    expect(resultado.database).toBe('up');
    expect(Number.isNaN(Date.parse(resultado.timestamp))).toBe(false);
  });

  it('lança ServiceUnavailableException (503) quando a consulta ao PostgreSQL falha', async () => {
    const queryMock = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const controller = new HealthController({
      query: queryMock,
    } as unknown as DataSource);

    await expect(controller.check()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
