import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateEstacaoDto } from './dto/create-estacao.dto.js';
import { UpdateEstacaoDto } from './dto/update-estacao.dto.js';
import { Estacao } from './entities/estacao.entity.js';
import { haversineMetros } from '../common/geo/haversine.js';

const RAIO_NA_ESTACAO_METROS = 300;
const RAIO_ALCANCE_MAXIMO_METROS = 1_500;

export interface EstacaoProximaResultado {
  estacao: Estacao;
  distancia_metros: number;
  na_estacao: boolean;
  fora_de_alcance: boolean;
}

@Injectable()
export class EstacoesService {
  private estacoesCache: Estacao[] | null = null;

  constructor(
    @InjectRepository(Estacao)
    private readonly estacaoRepo: Repository<Estacao>,
  ) { }

  async getProximas(
    lat: number,
    lng: number,
    limite = 3,
  ): Promise<EstacaoProximaResultado[]> {
    const estacoes = await this.listarEmMemoria();

    const ordenadas = estacoes
      .map((estacao) => {
        const distancia_metros = Math.round(
          haversineMetros(
            { lat, lng },
            { lat: Number(estacao.latitude), lng: Number(estacao.longitude) },
          ),
        );

        return {
          estacao,
          distancia_metros,
          na_estacao: distancia_metros <= RAIO_NA_ESTACAO_METROS,
          fora_de_alcance: distancia_metros > RAIO_ALCANCE_MAXIMO_METROS,
        };
      })
      .sort((a, b) => a.distancia_metros - b.distancia_metros);

    return ordenadas.slice(0, Math.max(1, limite));
  }

  async create(createEstacaoDto: CreateEstacaoDto): Promise<Estacao> {
    const estacao = this.estacaoRepo.create(createEstacaoDto);
    const salva = await this.estacaoRepo.save(estacao);
    this.estacoesCache = null;
    return salva;
  }

  async findAll(): Promise<Estacao[]> {
    return this.listarEmMemoria();
  }

  async findOne(id: number): Promise<Estacao> {
    const estacao = await this.estacaoRepo.findOne({
      where: { id },
      relations: { linha: true },
    });
    if (!estacao) {
      throw new NotFoundException(`Estação #${id} não encontrada`);
    }
    return estacao;
  }

  async update(
    id: number,
    updateEstacaoDto: UpdateEstacaoDto,
  ): Promise<Estacao> {
    const estacao = await this.findOne(id);
    Object.assign(estacao, updateEstacaoDto);
    const salva = await this.estacaoRepo.save(estacao);
    this.estacoesCache = null;
    return salva;
  }

  async remove(id: number): Promise<void> {
    const estacao = await this.findOne(id);
    await this.estacaoRepo.remove(estacao);
    this.estacoesCache = null;
  }

  private async listarEmMemoria(): Promise<Estacao[]> {
    if (!this.estacoesCache) {
      this.estacoesCache = await this.estacaoRepo.find();
    }
    return this.estacoesCache;
  }
}
