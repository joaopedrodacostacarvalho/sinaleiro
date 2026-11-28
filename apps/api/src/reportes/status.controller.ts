// apps/api/src/reportes/status.controller.ts
import {
  Controller,
  Get,
  MessageEvent,
  Optional,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Sse,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { interval, map, merge, Observable } from 'rxjs';
import type { MapaStreamPayload } from '@sinaleiro/types';
import { StatusService } from './status.service.js';

@ApiTags('status')
@Controller()
export class StatusController {
  constructor(
    private readonly statusService: StatusService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) { }

  @Get('estacoes/:id/status')
  @ApiOperation({ summary: 'Status efetivo da estação' })
  getStatusEstacao(@Param('id', ParseIntPipe) id: number) {
    return this.statusService.getStatusEstacao(id);
  }

  @Get('linhas/:id/status')
  @ApiOperation({ summary: 'Status efetivo da linha' })
  getStatusLinha(@Param('id', ParseIntPipe) id: number) {
    return this.statusService.getStatusLinha(id);
  }

  @Get('trens/:id/status')
  @ApiOperation({ summary: 'Status efetivo do trem' })
  getStatusTrem(@Param('id', ParseUUIDPipe) id: string) {
    return this.statusService.getStatusTrem(id);
  }

  @Get('mapa')
  @ApiOperation({ summary: 'Payload agregado do mapa (linhas, estações e trens)' })
  getMapa() {
    return this.statusService.getMapa();
  }

  @SkipThrottle()
  @Sse('mapa/stream')
  @ApiOperation({ summary: 'Stream SSE em tempo real das atualizações do mapa' })
  streamMapa(): Observable<MessageEvent> {
    const atualizacoes$ = new Observable<MessageEvent>((subscriber) => {
      if (!this.eventEmitter) {
        return;
      }

      const handler = (payload: MapaStreamPayload) => {
        subscriber.next({ data: payload });
      };

      this.eventEmitter.on('mapa.atualizado', handler);

      return () => {
        this.eventEmitter?.off('mapa.atualizado', handler);
      };
    });

    const heartbeat$ = interval(25_000).pipe(
      map(() => ({
        data: {
          tipo: 'ping',
          timestamp: new Date().toISOString(),
        } satisfies MapaStreamPayload,
      })),
    );

    return merge(atualizacoes$, heartbeat$);
  }
}
