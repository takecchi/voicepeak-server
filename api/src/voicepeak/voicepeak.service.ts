import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);

const VOICEPEAK_PATH = process.env.VOICEPEAK_PATH || '/opt/voicepeak/voicepeak';
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

  async listNarrators(): Promise<string[]> {
    const { stdout } = await execFileAsync(VOICEPEAK_PATH, ['--list-narrator']);
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  async synthesize(options: SpeechOptions): Promise<Buffer> {
    return this.enqueue(() => this.doSynthesize(options));
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue = this.queue.then(() => fn().then(resolve, reject));
    });
  }

  private async doSynthesize(options: SpeechOptions): Promise<Buffer> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'voicepeak-'));

    try {
      const chunks = this.splitText(options.text);
      const wavFiles: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const outFile = path.join(tmpDir, `chunk_${i}.wav`);
        await this.runVoicepeak(chunks[i], outFile, options);
        wavFiles.push(outFile);
      }

      if (wavFiles.length === 1) {
        return await fs.readFile(wavFiles[0]);
      }

      return await this.concatenateWav(wavFiles);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  private async runVoicepeak(
    text: string,
    outFile: string,
    options: SpeechOptions,
  ): Promise<void> {
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

    this.logger.log(`Running voicepeak: ${args.join(' ')}`);
    const { stderr } = await execFileAsync(VOICEPEAK_PATH, args, {
      timeout: 120_000,
    });
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

  private async concatenateWav(wavFiles: string[]): Promise<Buffer> {
    const buffers: Buffer[] = [];
    let header: Buffer | null = null;
    let totalDataSize = 0;

    for (const file of wavFiles) {
      const buf = await fs.readFile(file);
      const dataOffset = 44;
      if (!header) {
        header = Buffer.from(buf.subarray(0, dataOffset));
      }
      const data = buf.subarray(dataOffset);
      buffers.push(data);
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
    for (const data of buffers) {
      data.copy(result, offset);
      offset += data.length;
    }

    return result;
  }
}
