import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Res,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { GatewayService } from '@/gateway/gateway.service';

@Controller('voicepeak')
export class GatewayController {
  private readonly logger = new Logger(GatewayController.name);

  constructor(private readonly gatewayService: GatewayService) {}

  @Get('health')
  async health(@Res() res: Response) {
    const workerUrl = await this.gatewayService.selectWorkerForRead();
    const result = await this.gatewayService.proxyGet(
      workerUrl,
      '/voicepeak/health',
    );
    res.status(result.status).json(result.body);
  }

  @Get('status')
  async status() {
    return this.gatewayService.getAggregatedStatus();
  }

  @Get('narrators')
  async listNarrators(@Res() res: Response) {
    const workerUrl = await this.gatewayService.selectWorkerForRead();
    const result = await this.gatewayService.proxyGet(
      workerUrl,
      '/voicepeak/narrators',
    );
    res.status(result.status).json(result.body);
  }

  @Get('narrators/:narrator_name/emotions')
  async listEmotions(
    @Param('narrator_name') narratorName: string,
    @Res() res: Response,
  ) {
    const workerUrl = await this.gatewayService.selectWorkerForRead();
    const result = await this.gatewayService.proxyGet(
      workerUrl,
      `/voicepeak/narrators/${encodeURIComponent(narratorName)}/emotions`,
    );
    res.status(result.status).json(result.body);
  }

  @Post('speech')
  async synthesize(@Body() body: unknown, @Res() res: Response) {
    const workerUrl = await this.gatewayService.selectWorkerForSpeech();
    this.logger.log(`Routing speech request to ${workerUrl}`);

    const result = await this.gatewayService.proxyPost(
      workerUrl,
      '/voicepeak/speech',
      body,
    );

    for (const [key, value] of Object.entries(result.headers)) {
      if (key.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(key, value);
      }
    }
    res.status(result.status).send(result.body);
  }
}
