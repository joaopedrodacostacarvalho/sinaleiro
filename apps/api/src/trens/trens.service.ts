import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { Sentido, TipoReporte } from '@sinaleiro/types/enums';

import { CreateTremDto } from './dto/create-trem.dto.js';
import { UpdateTremDto } from './dto/update-trem.dto.js';
import { Trem } from './entities/trem.entity.js';
import { Reporte } from '../reportes/entities/reporte.entity.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';

const REPUTACAO_MINIMA_CRIAR_TREM = 10;
const JANELA_TREM_ATIVO_MS = 20 * 60_000;

export interface TremAtivoResumo {
  trem_id: string;
  ultimo_reporte: Date;
  trem: Trem | null;
}

@Injectable()
export class TrensService {
  constructor(
    @InjectRepository(Trem)
    private readonly tremRepo: Repository<Trem>,
    @InjectRepository(Reporte)
    private readonly reporteRepo: Repository<Reporte>,
  ) { }

  async resolverTrem(
    linhaId: number,
    sentido: Sentido,
    idVagao: string | null | undefined,
    autor: Pick<Usuario, 'reputacao'>,
  ): Promise<Trem> {
    const vagaoNormalizado = idVagao?.trim() || null;

    // Regra 7.1.3 — Match exato por id_vagao tem prioridade
    if (vagaoNormalizado) {
      const porVagao = await this.tremRepo.findOne({
        where: {
          linha_id: linhaId,
          sentido,
          id_vagao: vagaoNormalizado,
        },
      });
      if (porVagao) {
        return porVagao;
      }

      // Se informou um vagão inédito, cria (respeitando Regra 7.2.2)
      return this.criarTremSeAutorizado(
        linhaId,
        sentido,
        vagaoNormalizado,
        autor,
      );
    }

    // Regra 7.1.1 — Busca candidatos na linha e sentido
    const candidatos = await this.tremRepo.find({
      where: { linha_id: linhaId, sentido },
    });

    if (candidatos.length === 1) {
      return candidatos[0];
    }

    if (candidatos.length > 1) {
      // Round-robin implícito: escolhe o trem cujo último reporte é o mais antigo
      let escolhido = candidatos[0];
      let maisAntigoMs = Number.POSITIVE_INFINITY;

      for (const candidato of candidatos) {
        const reportes = await this.reporteRepo.find({
          where: { trem_id: candidato.id },
          order: { data_hora_criacao: 'DESC' },
          take: 1,
        });

        const ultimoMs =
          reportes.length === 0
            ? 0
            : Math.max(
              ...reportes.map((r) =>
                new Date(r.data_hora_criacao).getTime(),
              ),
            );

        if (ultimoMs < maisAntigoMs) {
          maisAntigoMs = ultimoMs;
          escolhido = candidato;
        }
      }

      return escolhido;
    }

    // Nenhum candidato encontrado: cria um novo trem se reputação >= 10
    return this.criarTremSeAutorizado(linhaId, sentido, null, autor);
  }

  async listarAtivos(): Promise<TremAtivoResumo[]> {
    const limite = new Date(Date.now() - JANELA_TREM_ATIVO_MS);

    const reportesRecentes = await this.reporteRepo.find({
      where: {
        tipo: TipoReporte.TREM,
        data_hora_criacao: MoreThan(limite),
      },
      order: { data_hora_criacao: 'DESC' },
    });

    const porTrem = new Map<string, Date>();
    for (const r of reportesRecentes) {
      if (!r.trem_id) continue;
      const criadoEm = new Date(r.data_hora_criacao);
      if (criadoEm.getTime() <= limite.getTime()) continue;

      const atual = porTrem.get(r.trem_id);
      if (!atual || criadoEm.getTime() > atual.getTime()) {
        porTrem.set(r.trem_id, criadoEm);
      }
    }

    if (porTrem.size === 0) {
      return [];
    }

    const trens = await this.tremRepo.find({ where: { id: In(Array.from(porTrem.keys())) } })
    const trensPorId = new Map(trens.map((t) => [t.id, t]));

    return Array.from(porTrem.entries()).map(([trem_id, ultimo_reporte]) => ({
      trem_id,
      ultimo_reporte,
      trem: trensPorId.get(trem_id) ?? null,
    }));
  }

  async create(createTremDto: CreateTremDto): Promise<Trem> {
    const trem = this.tremRepo.create({
      linha_id: createTremDto.linha_id,
      sentido: createTremDto.sentido,
      id_vagao: createTremDto.id_vagao?.trim() || null,
    });
    return this.tremRepo.save(trem);
  }

  async findAll(): Promise<Trem[]> {
    return this.tremRepo.find({ relations: { linha: true } });
  }

  async findOne(id: string): Promise<Trem> {
    const trem = await this.tremRepo.findOne({
      where: { id },
      relations: { linha: true },
    });
    if (!trem) {
      throw new NotFoundException(`Trem #${id} não encontrado`);
    }
    return trem;
  }

  async update(id: string, updateTremDto: UpdateTremDto): Promise<Trem> {
    const trem = await this.findOne(id);
    Object.assign(trem, updateTremDto);
    return this.tremRepo.save(trem);
  }

  async remove(id: string): Promise<void> {
    const trem = await this.findOne(id);
    await this.tremRepo.remove(trem);
  }

  private async criarTremSeAutorizado(
    linhaId: number,
    sentido: Sentido,
    idVagao: string | null,
    autor: Pick<Usuario, 'reputacao'>,
  ): Promise<Trem> {
    // Regra 7.2.2 — Criar trem exige reputação >= 10
    if (autor.reputacao < REPUTACAO_MINIMA_CRIAR_TREM) {
      throw new ForbiddenException(
        'Reputação mínima de 10 é necessária para registrar um novo trem',
      );
    }

    const novo = this.tremRepo.create({
      linha_id: linhaId,
      sentido,
      id_vagao: idVagao,
    });
    return this.tremRepo.save(novo);
  }
}
