import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { VoicepeakCli } from './voicepeak-cli';
import { WorkerStatus } from './dto/status.dto';

const MAX_TEXT_LENGTH = 140;

export interface SpeechOptions {
  text: string;
  narrator?: string;
  emotion?: Record<string, number>;
  speed?: number;
  pitch?: number;
}

@Injectable()
export class VoicepeakService {
  private readonly logger = new Logger(VoicepeakService.name);
  private queue: Promise<void> = Promise.resolve();
  private pendingCount = 0;

  constructor(private readonly cli: VoicepeakCli) {}

  getStatus(): WorkerStatus {
    return {
      status: this.pendingCount > 0 ? 'busy' : 'idle',
      queue_length: this.pendingCount,
    };
  }

  async listNarrators(): Promise<string[]> {
    const { stdout } = await this.cli.exec(['--list-narrator']);
    return this.parseLines(stdout);
  }

  async listEmotions(narrator: string): Promise<string[]> {
    const { stdout } = await this.cli.exec(['--list-emotion', narrator]);
    return this.parseLines(stdout);
  }

  parseLines(stdout: string): string[] {
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  async synthesize(options: SpeechOptions): Promise<Buffer> {
    return this.enqueue(() => this.doSynthesize(options));
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    this.pendingCount++;
    return new Promise<T>((resolve, reject) => {
      this.queue = this.queue.then(() =>
        fn().then(resolve, reject).finally(() => this.pendingCount--),
      );
    });
  }

  private async doSynthesize(options: SpeechOptions): Promise<Buffer> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'voicepeak-'));

    try {
      const chunks = this.splitText(options.text);
      const wavBuffers: Buffer[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const outFile = path.join(tmpDir, `chunk_${i}.wav`);
        await this.runVoicepeak(chunks[i], outFile, options);
        wavBuffers.push(await fs.readFile(outFile));
      }

      if (wavBuffers.length === 1) {
        return wavBuffers[0];
      }

      return this.concatenateWav(wavBuffers);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  buildArgs(text: string, outFile: string, options: SpeechOptions): string[] {
    const args = ['-s', text, '-o', outFile];

    if (options.narrator) {
      args.push('-n', options.narrator);
    }
    if (options.emotion) {
      const expr = Object.entries(options.emotion)
        .map(([k, v]) => `${k}=${v}`)
        .join(',');
      args.push('-e', expr);
    }
    if (options.speed !== undefined) {
      args.push('--speed', String(options.speed));
    }
    if (options.pitch !== undefined) {
      args.push('--pitch', String(options.pitch));
    }

    return args;
  }

  private async runVoicepeak(
    text: string,
    outFile: string,
    options: SpeechOptions,
  ): Promise<void> {
    const args = this.buildArgs(text, outFile, options);

    this.logger.log(`Running voicepeak: ${args.join(' ')}`);
    const { stderr } = await this.cli.exec(args);
    if (stderr) {
      this.logger.warn(`voicepeak stderr: ${stderr}`);
    }
  }

  splitText(text: string): string[] {
    if (text.length <= MAX_TEXT_LENGTH) {
      return [text];
    }

    const chunks: string[] = [];
    const delimiters = ['。', '！', '？', '!', '?', '、', ',', '\n'];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= MAX_TEXT_LENGTH) {
        chunks.push(remaining);
        break;
      }

      let splitAt = -1;
      for (const delim of delimiters) {
        const idx = remaining.lastIndexOf(delim, MAX_TEXT_LENGTH - 1);
        if (idx > 0 && idx > splitAt) {
          splitAt = idx + delim.length;
          break;
        }
      }

      if (splitAt <= 0) {
        splitAt = MAX_TEXT_LENGTH;
      }

      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt);
    }

    return chunks;
  }

  concatenateWav(wavFiles: Buffer[]): Buffer {
    let header: Buffer | null = null;
    let totalDataSize = 0;
    const dataBuffers: Buffer[] = [];

    for (const buf of wavFiles) {
      const dataOffset = 44;
      if (!header) {
        header = Buffer.from(buf.subarray(0, dataOffset));
      }
      const data = buf.subarray(dataOffset);
      dataBuffers.push(data);
      totalDataSize += data.length;
    }

    if (!header) {
      throw new Error('No WAV files to concatenate');
    }

    const result = Buffer.alloc(44 + totalDataSize);
    header.copy(result, 0);

    // Update RIFF chunk size
    result.writeUInt32LE(36 + totalDataSize, 4);
    // Update data chunk size
    result.writeUInt32LE(totalDataSize, 40);

    let offset = 44;
    for (const data of dataBuffers) {
      data.copy(result, offset);
      offset += data.length;
    }

    return result;
  }
}
