import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDurationSeconds: Histogram<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'sinaleiro_' });

    this.httpRequestsTotal = new Counter({
      name: 'sinaleiro_http_requests_total',
      help: 'Total de requisições HTTP processadas',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'sinaleiro_http_request_duration_seconds',
      help: 'Latência das requisições HTTP em segundos (RED Duration)',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });
  }
}
