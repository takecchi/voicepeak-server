import { Module } from '@nestjs/common';
import { GatewayController } from '@/gateway/gateway.controller';
import { GatewayService } from '@/gateway/gateway.service';

@Module({
  controllers: [GatewayController],
  providers: [GatewayService],
})
export class GatewayModule {}
