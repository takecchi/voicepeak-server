import { Module } from '@nestjs/common';
import { VoicepeakController } from './voicepeak.controller.js';
import { VoicepeakService } from './voicepeak.service.js';

@Module({
  controllers: [VoicepeakController],
  providers: [VoicepeakService],
})
export class VoicepeakModule {}
