import { ApiProperty } from '@nestjs/swagger';

export class NarratorList {
  @ApiProperty({ type: [String], description: '利用可能なナレーター名の一覧' })
  narrators: string[];
}
