import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { VoicepeakService, SpeechOptions } from './voicepeak.service.js';

class SpeechDto {
  text: string;
  narrator?: string;
  emotion?: Record<string, number>;
  speed?: number;
  pitch?: number;
}

@Controller('api')
export class VoicepeakController {
  constructor(private readonly voicepeakService: VoicepeakService) {}

  @Get('narrators')
  async listNarrators() {
    return { narrators: await this.voicepeakService.listNarrators() };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Post('speech')
  async synthesize(@Body() dto: SpeechDto, @Res() res: Response) {
    if (!dto.text || dto.text.trim().length === 0) {
      throw new HttpException('text is required', HttpStatus.BAD_REQUEST);
    }

    const options: SpeechOptions = {
      text: dto.text,
      narrator: dto.narrator,
      emotion: dto.emotion,
      speed: dto.speed,
      pitch: dto.pitch,
    };

    const wav = await this.voicepeakService.synthesize(options);

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': wav.length,
    });
    res.send(wav);
  }
}
