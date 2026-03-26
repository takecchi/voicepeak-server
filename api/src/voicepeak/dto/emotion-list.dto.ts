import { ApiProperty } from '@nestjs/swagger';

export class EmotionList {
  @ApiProperty({
    type: [String],
    description: '指定ナレーターの感情パラメータ一覧',
  })
  emotions: string[];
}
