import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import type { MapaStreamPayload } from '@sinaleiro/types';

import { Reporte } from './entities/reporte.entity.js';
import { StatusService } from './status.service.js';

const INTERVALO_EXPIRACAO_MS = 30_000;

@Injectable()
export class ReportesExpiracaoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportesExpiracaoService.name);
  private timer: NodeJS.Timeout | null = null;
  private executando = false;

  constructor(
    @InjectRepository(Reporte)
    private readonly reporteRepo: Repository<Reporte>,
    @Optional()
    private readonly statusService?: StatusService,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
  ) { }

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;

    this.timer = setInterval(() => {
      void this.encerrarExpirados();
    }, INTERVALO_EXPIRACAO_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async encerrarExpirados(agora: Date = new Date()): Promise<number> {
    if (this.executando) return 0;
    this.executando = true;

    try {
      const vencidos = await this.reporteRepo.find({
        where: {
          ativo: true,
          data_hora_expiracao: LessThanOrEqual(agora),
        },
        select: {
          id: true,
          tipo: true,
          estacao_id: true,
          linha_id: true,
          trem_id: true,
        },
      });

      if (vencidos.length === 0) {
        return 0;
      }

      // Altera APENAS `ativo = false`, mantendo `confianca` > 0
      // para não acionar o cooldown de 15 min de refutação.
      await this.reporteRepo.update(
        { id: In(vencidos.map((r) => r.id)), ativo: true },
        { ativo: false },
      );

      for (const reporte of vencidos) {
        await this.statusService?.invalidarAlvo(reporte);
      }

      this.eventEmitter?.emit('mapa.atualizado', {
        tipo: 'mapa_atualizado',
        timestamp: agora.toISOString(),
      } satisfies MapaStreamPayload);

      return vencidos.length;
    } catch (erro) {
      this.logger.error('Falha ao encerrar reportes expirados', erro);
      return 0;
    } finally {
      this.executando = false;
    }
  }
}
