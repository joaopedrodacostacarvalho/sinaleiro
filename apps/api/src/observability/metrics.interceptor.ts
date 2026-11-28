import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;

    if (route === '/metrics' || route.endsWith('/mapa/stream')) {
      return next.handle();
    }

    const endTimer = this.metrics.httpRequestDurationSeconds.startTimer();

    return next.handle().pipe(
      tap({
        next: () => {
          const labels = {
            method: req.method,
            route,
            status_code: String(res.statusCode),
          };
          this.metrics.httpRequestsTotal.inc(labels);
          endTimer(labels);
        },
        error: (err: { status?: number }) => {
          const labels = {
            method: req.method,
            route,
            status_code: String(err?.status ?? 500),
          };
          this.metrics.httpRequestsTotal.inc(labels);
          endTimer(labels);
        },
      }),
    );
  }
}
