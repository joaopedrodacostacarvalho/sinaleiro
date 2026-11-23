import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateReporteDto } from './dto/create-reporte.dto.js';
import { UpdateReporteDto } from './dto/update-reporte.dto.js';
import { Reporte } from './entities/reporte.entity.js';
import { Repository } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { InjectRepository } from '@nestjs/typeorm';
import { TipoReporte } from '@sinaleiro/types/enums';

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Reporte) private readonly reporteRepo: Repository<Reporte>
  ) { }

  async create(dto: CreateReporteDto, autor: Usuario) {
    this.assertAlvoCoerente(dto);

    const reporte = this.reporteRepo.create({
      tipo: dto.tipo,
      usuario_id: autor.id,
      estacao_id: dto.estacao_id ?? null,
      linha_id: dto.linha_id ?? null,
      trem_id: dto.trem_id ?? null,
      status_estacao: dto.status_estacao ?? null,
      status_linha: dto.status_linha ?? null,
      status_trem: dto.status_trem ?? null,
      data_hora_criacao: new Date(),
      data_hora_expiracao: this.calcularExpiracao(dto.tipo),
      confianca: this.confiancaInicial(autor),
      ativo: true,
    });
    return this.reporteRepo.save(reporte);
  }

  private assertAlvoCoerente(dto: CreateReporteDto): void {
    const preenchidos = {
      estacao_id: dto.estacao_id != null,
      linha_id: dto.linha_id != null,
      trem_id: dto.trem_id != null,
      status_estacao: dto.status_estacao != null,
      status_linha: dto.status_linha != null,
      status_trem: dto.status_trem != null,
    };

    if (dto.tipo === TipoReporte.ESTACAO) {
      if (!preenchidos.estacao_id || !preenchidos.status_estacao) {
        throw new BadRequestException('Reporte de estação exige estacao_id e status_estacao');
      }
      if (preenchidos.linha_id || preenchidos.trem_id || preenchidos.status_linha || preenchidos.status_trem) {
        throw new BadRequestException('Reporte de estação não aceita campos de linha/trem');
      }
    }

    if (dto.tipo === TipoReporte.LINHA) {
      if (!preenchidos.linha_id || !preenchidos.status_linha) {
        throw new BadRequestException('Reporte de linha exige linha_id e status_linha');
      }
      if (preenchidos.estacao_id || preenchidos.trem_id || preenchidos.status_estacao || preenchidos.status_trem) {
        throw new BadRequestException('Reporte de linha não aceita campos de estação/trem');
      }
    }

    if (dto.tipo === TipoReporte.TREM) {
      if (!preenchidos.trem_id || !preenchidos.estacao_id || !preenchidos.status_trem) {
        throw new BadRequestException('Reporte de trem exige trem_id, estacao_id (local do avistamento) e status_trem');
      }
      if (preenchidos.linha_id || preenchidos.status_estacao || preenchidos.status_linha) {
        throw new BadRequestException('Reporte de trem não aceita linha_id/status_estacao/status_linha');
      }
    }
  }

  /* Filtro em leitura (padrão em todas as queries de status):
   * const reportesAtivos = await this.reporteRepo
   *  .createQueryBuilder('r')
   *  .where('r.ativo = :ativo', { ativo: true })
   *  .andWhere('r.data_hora_expiracao > :agora', { agora: new Date() })
   *  .getMany();
  */
  private calcularExpiracao(tipo: TipoReporte): Date {
    const agora = Date.now();
    const minutos = {
      [TipoReporte.ESTACAO]: 30,   // estações mudam devagar
      [TipoReporte.LINHA]: 30,     // linha inteira é estável
      [TipoReporte.TREM]: 10,      // trem se move rápido
    }[tipo];

    return new Date(agora + minutos * 60 * 1000);
  }

  findAll() {
    return `This action returns all reportes`;
  }

  findOne(id: string) {
    return `This action returns a #${id} reporte`;
  }

  update(id: string, updateReporteDto: UpdateReporteDto) {
    return `This action updates a #${id} reporte`;
  }

  remove(id: string) {
    return `This action removes a #${id} reporte`;
  }
}
