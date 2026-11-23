import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LinhasService } from './linhas.service.js';
import { mockRepo } from '../../test/fixtures.js';

describe('LinhasService', () => {
  let service: LinhasService;
  let linhaRepo: ReturnType<typeof mockRepo>;

  beforeEach(() => {
    linhaRepo = mockRepo();
    service = new LinhasService(linhaRepo);
  });

  it('lista todas as linhas ordenadas por ID', async () => {
    const linhas = [
      { id: 1, nome: 'Linha Centro', cor: '#E53935' },
      { id: 2, nome: 'Linha Sul', cor: '#1E88E5' },
    ];
    linhaRepo.find.mockResolvedValue(linhas);

    const resultado = await service.findAll();

    expect(linhaRepo.find).toHaveBeenCalledWith({ order: { id: 'ASC' } });
    expect(resultado).toEqual(linhas);
  });

  it('retorna linha existente em findOne', async () => {
    const linha = { id: 1, nome: 'Linha Centro', cor: '#E53935' };
    linhaRepo.findOne.mockResolvedValue(linha);

    await expect(service.findOne(1)).resolves.toEqual(linha);
  });

  it('lança NotFoundException quando a linha não existe', async () => {
    linhaRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('cria e salva nova linha', async () => {
    const dto = { nome: 'Linha VLT', cor: '#43A047' };
    linhaRepo.save.mockResolvedValue({ id: 3, ...dto });

    const criada = await service.create(dto as any);

    expect(linhaRepo.create).toHaveBeenCalledWith(dto);
    expect(criada).toEqual({ id: 3, ...dto });
  });

  it('atualiza e remove linha existente', async () => {
    const existente = { id: 1, nome: 'Linha Centro', cor: '#E53935' };
    linhaRepo.findOne.mockResolvedValue(existente);
    linhaRepo.save.mockImplementation(async (e: unknown) => e);
    linhaRepo.remove = vi.fn().mockResolvedValue(existente);

    const atualizada = await service.update(1, { nome: 'Centro' } as any);
    expect(atualizada.nome).toBe('Centro');

    await service.remove(1);
    expect(linhaRepo.remove).toHaveBeenCalledWith(existente);
  });
});
