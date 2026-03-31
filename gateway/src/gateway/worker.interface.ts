export interface WorkerStatus {
  status: 'idle' | 'busy';
  queue_length: number;
}

export interface Worker {
  url: string;
  healthy: boolean;
}
