import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Worker, WorkerStatus } from '@/gateway/worker.interface';

@Injectable()
export class GatewayService implements OnModuleInit {
  private readonly logger = new Logger(GatewayService.name);
  private workers: Worker[] = [];

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const raw = this.config.get<string>('WORKERS', '');
    this.workers = raw
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
      .map((url) => ({ url, healthy: true }));

    if (this.workers.length === 0) {
      throw new Error('WORKERS env var is required (comma-separated URLs)');
    }

    this.logger.log(`Workers: ${this.workers.map((w) => w.url).join(', ')}`);
  }

  async selectWorkerForSpeech(): Promise<string> {
    const statuses = await this.fetchAllStatuses();
    const healthy = statuses.filter((s) => s.workerStatus !== null);

    if (healthy.length === 0) {
      throw new ServiceUnavailableException('No healthy workers available');
    }

    const idle = healthy.filter((s) => s.workerStatus!.status === 'idle');
    if (idle.length > 0) {
      return idle[0]!.url;
    }

    healthy.sort(
      (a, b) => a.workerStatus!.queue_length - b.workerStatus!.queue_length,
    );
    return healthy[0]!.url;
  }

  async selectWorkerForRead(): Promise<string> {
    const statuses = await this.fetchAllStatuses();
    const healthy = statuses.filter((s) => s.workerStatus !== null);

    if (healthy.length === 0) {
      throw new ServiceUnavailableException('No healthy workers available');
    }

    return healthy[0]!.url;
  }

  async getAggregatedStatus(): Promise<{
    workers: Array<{
      url: string;
      status: 'idle' | 'busy' | 'unhealthy';
      queue_length: number;
    }>;
  }> {
    const statuses = await this.fetchAllStatuses();
    return {
      workers: statuses.map((s) => ({
        url: s.url,
        status: s.workerStatus ? s.workerStatus.status : ('unhealthy' as const),
        queue_length: s.workerStatus?.queue_length ?? 0,
      })),
    };
  }

  async proxyGet(
    workerUrl: string,
    path: string,
  ): Promise<{ status: number; body: unknown }> {
    const res = await fetch(`${workerUrl}${path}`, {
      signal: AbortSignal.timeout(5000),
    });
    return { status: res.status, body: await res.json() };
  }

  async proxyPost(
    workerUrl: string,
    path: string,
    body: unknown,
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    body: Buffer;
  }> {
    const timeoutMs = this.config.get<number>('PROXY_TIMEOUT_MS', 120_000);
    const res = await fetch(`${workerUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const arrayBuffer = await res.arrayBuffer();
    return {
      status: res.status,
      headers: responseHeaders,
      body: Buffer.from(arrayBuffer),
    };
  }

  private async fetchAllStatuses(): Promise<
    Array<{ url: string; workerStatus: WorkerStatus | null }>
  > {
    return Promise.all(
      this.workers.map(async (worker) => {
        try {
          const res = await fetch(`${worker.url}/voicepeak/status`, {
            signal: AbortSignal.timeout(3000),
          });
          if (!res.ok) {
            worker.healthy = false;
            return { url: worker.url, workerStatus: null };
          }
          const workerStatus = (await res.json()) as WorkerStatus;
          worker.healthy = true;
          return { url: worker.url, workerStatus };
        } catch {
          this.logger.warn(`Worker ${worker.url} is unreachable`);
          worker.healthy = false;
          return { url: worker.url, workerStatus: null };
        }
      }),
    );
  }
}
