import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Injectable()
export class VoicepeakCli {
  private readonly voicepeakPath: string;

  constructor(configService: ConfigService) {
    this.voicepeakPath = configService.get<string>(
      'VOICEPEAK_PATH',
      '/opt/voicepeak/voicepeak',
    );
  }

  async exec(
    args: string[],
    timeout = 120_000,
  ): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync(this.voicepeakPath, args, { timeout });
  }
}
