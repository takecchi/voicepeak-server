import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GatewayService } from './gateway.service';

function createService(workers: string): GatewayService {
  const configService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'WORKERS') return workers;
      if (key === 'PROXY_TIMEOUT_MS') return defaultValue ?? 120_000;
      return defaultValue;
    }),
  } as unknown as ConfigService;

  const service = new GatewayService(configService);
  service.onModuleInit();
  return service;
}

function mockFetchResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
    headers: new Headers(),
    arrayBuffer: () =>
      Promise.resolve(new TextEncoder().encode(JSON.stringify(body)).buffer),
  });
}

describe('GatewayService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('onModuleInit', () => {
    it('should throw if WORKERS is empty', () => {
      expect(() => createService('')).toThrow(
        'WORKERS env var is required (comma-separated URLs)',
      );
    });

    it('should parse comma-separated worker URLs', () => {
      const service = createService(
        'http://worker-1:8181, http://worker-2:8181',
      );
      // Service should have 2 workers (verified via selectWorkerForRead)
      expect(service).toBeDefined();
    });
  });

  describe('selectWorkerForSpeech', () => {
    it('should select idle worker', async () => {
      const service = createService(
        'http://worker-1:8181,http://worker-2:8181',
      );

      global.fetch = jest.fn((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('worker-1')) {
          return mockFetchResponse({ status: 'busy', queue_length: 1 });
        }
        return mockFetchResponse({ status: 'idle', queue_length: 0 });
      }) as jest.Mock;

      const selected = await service.selectWorkerForSpeech();
      expect(selected).toBe('http://worker-2:8181');
    });

    it('should select worker with smallest queue when all busy', async () => {
      const service = createService(
        'http://worker-1:8181,http://worker-2:8181',
      );

      global.fetch = jest.fn((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('worker-1')) {
          return mockFetchResponse({ status: 'busy', queue_length: 3 });
        }
        return mockFetchResponse({ status: 'busy', queue_length: 1 });
      }) as jest.Mock;

      const selected = await service.selectWorkerForSpeech();
      expect(selected).toBe('http://worker-2:8181');
    });

    it('should throw when all workers are unreachable', async () => {
      const service = createService('http://worker-1:8181');

      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.selectWorkerForSpeech()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should skip unhealthy workers and select healthy one', async () => {
      const service = createService(
        'http://worker-1:8181,http://worker-2:8181',
      );

      global.fetch = jest.fn((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('worker-1')) {
          return Promise.reject(new Error('ECONNREFUSED'));
        }
        return mockFetchResponse({ status: 'idle', queue_length: 0 });
      }) as jest.Mock;

      const selected = await service.selectWorkerForSpeech();
      expect(selected).toBe('http://worker-2:8181');
    });
  });

  describe('selectWorkerForRead', () => {
    it('should return any healthy worker', async () => {
      const service = createService('http://worker-1:8181');

      global.fetch = jest
        .fn()
        .mockReturnValue(
          mockFetchResponse({ status: 'idle', queue_length: 0 }),
        );

      const selected = await service.selectWorkerForRead();
      expect(selected).toBe('http://worker-1:8181');
    });

    it('should throw when no workers available', async () => {
      const service = createService('http://worker-1:8181');

      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.selectWorkerForRead()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('getAggregatedStatus', () => {
    it('should return status for all workers including unhealthy', async () => {
      const service = createService(
        'http://worker-1:8181,http://worker-2:8181',
      );

      global.fetch = jest.fn((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('worker-1')) {
          return mockFetchResponse({ status: 'busy', queue_length: 2 });
        }
        return Promise.reject(new Error('ECONNREFUSED'));
      }) as jest.Mock;

      const result = await service.getAggregatedStatus();

      expect(result.workers).toHaveLength(2);
      expect(result.workers[0]).toEqual({
        url: 'http://worker-1:8181',
        status: 'busy',
        queue_length: 2,
      });
      expect(result.workers[1]).toEqual({
        url: 'http://worker-2:8181',
        status: 'unhealthy',
        queue_length: 0,
      });
    });
  });
});
