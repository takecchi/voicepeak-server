import { Controller, Get, Param, Post, Body, Res } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiProduces,
  ApiParam,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { VoicepeakService } from './voicepeak.service';
import { SynthesizeSpeechRequest } from './dto/synthesize-speech.dto';
import { NarratorList } from './dto/narrator-list.dto';
import { EmotionList } from './dto/emotion-list.dto';
import { Health } from './dto/health.dto';

@ApiTags('voicepeak')
@Controller('voicepeak')
export class VoicepeakController {
  constructor(private readonly voicepeakService: VoicepeakService) {}

  @Get('health')
  @ApiOperation({ operationId: 'getHealth', summary: 'ヘルスチェック' })
  @ApiOkResponse({ type: Health })
  health(): Health {
    return { status: 'ok' };
  }

  @Get('narrators')
  @ApiOperation({
    operationId: 'getNarrators',
    summary: 'ナレーター一覧を取得',
  })
  @ApiOkResponse({ type: NarratorList })
  async listNarrators(): Promise<NarratorList> {
    return { narrators: await this.voicepeakService.listNarrators() };
  }

  @Get('narrators/:narrator_name/emotions')
  @ApiOperation({
    operationId: 'getEmotions',
    summary: '指定ナレーターの感情パラメータ一覧を取得',
  })
  @ApiParam({
    name: 'narrator_name',
    type: String,
    description: 'ナレーター名',
  })
  @ApiOkResponse({ type: EmotionList })
  async listEmotions(
    @Param('narrator_name') narratorName: string,
  ): Promise<EmotionList> {
    return { emotions: await this.voicepeakService.listEmotions(narratorName) };
  }

  @Post('speech')
  @ApiOperation({
    operationId: 'synthesizeSpeech',
    summary: 'テキストから音声を合成',
  })
  @ApiCreatedResponse({ description: '音声合成されたWAVファイル' })
  @ApiBadRequestResponse({ description: '不正なリクエスト' })
  @ApiProduces('audio/wav')
  async synthesize(
    @Body() request: SynthesizeSpeechRequest,
    @Res() res: Response,
  ) {
    const wav = await this.voicepeakService.synthesize({
      text: request.text,
      narrator: request.narrator,
      emotion: request.emotion,
      speed: request.speed,
      pitch: request.pitch,
    });

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': wav.length,
    });
    res.send(wav);
  }
}
