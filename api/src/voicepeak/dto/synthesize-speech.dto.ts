import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { NullToUndefined } from '@/shared/decorators/NullToUndefined';

export class SynthesizeSpeechRequest {
  @ApiProperty({
    type: String,
    description: '読み上げるテキスト (140文字超は自動分割)',
  })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ type: String, required: false, description: 'ナレーター名' })
  @NullToUndefined()
  @IsOptional()
  @IsString()
  narrator?: string;

  @ApiProperty({
    type: Object,
    required: false,
    description: '感情パラメータ (例: {"happy": 50, "sad": 25})',
  })
  @NullToUndefined()
  @IsOptional()
  @IsObject()
  emotion?: Record<string, number>;

  @ApiProperty({ type: Number, required: false, description: '速度 (50-200)' })
  @NullToUndefined()
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(200)
  speed?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: 'ピッチ (-300 to 300)',
  })
  @NullToUndefined()
  @IsOptional()
  @IsNumber()
  @Min(-300)
  @Max(300)
  pitch?: number;
}
