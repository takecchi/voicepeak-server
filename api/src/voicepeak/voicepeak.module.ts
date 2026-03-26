import { Module } from '@nestjs/common';
import { VoicepeakController } from './voicepeak.controller';
import { VoicepeakService } from './voicepeak.service';
import { VoicepeakCli } from './voicepeak-cli';

@Module({
  controllers: [VoicepeakController],
  providers: [VoicepeakService, VoicepeakCli],
})
export class VoicepeakModule {}
