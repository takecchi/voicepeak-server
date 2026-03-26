import { Module } from '@nestjs/common';
import { SharedModule } from '@/shared/shared.module';
import { VoicepeakModule } from '@/voicepeak/voicepeak.module';

@Module({
  imports: [SharedModule, VoicepeakModule],
})
export class AppModule {}
