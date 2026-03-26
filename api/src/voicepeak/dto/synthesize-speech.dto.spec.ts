import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '@/shared/utils/app.utils';
import { SynthesizeSpeechRequest } from './synthesize-speech.dto';

describe('SynthesizeSpeechRequest', () => {
  const pipe = createValidationPipe();
  const meta = { type: 'body' as const, metatype: SynthesizeSpeechRequest };

  const transform = (input: Record<string, unknown>) =>
    pipe.transform(input, meta);

  it('should pass with valid text only', async () => {
    const result = await transform({ text: 'こんにちは' });
    expect(result.text).toBe('こんにちは');
  });

  it('should pass with all parameters', async () => {
    const result = await transform({
      text: 'テスト',
      narrator: 'Japanese Male Child',
      emotion: { happy: 50 },
      speed: 100,
      pitch: 0,
    });
    expect(result.text).toBe('テスト');
    expect(result.narrator).toBe('Japanese Male Child');
    expect(result.emotion).toEqual({ happy: 50 });
    expect(result.speed).toBe(100);
    expect(result.pitch).toBe(0);
  });

  it('should reject when text is missing', async () => {
    await expect(transform({})).rejects.toThrow(BadRequestException);
  });

  it('should reject when text is empty', async () => {
    await expect(transform({ text: '' })).rejects.toThrow(BadRequestException);
  });

  it('should coerce non-string text via implicit conversion', async () => {
    // enableImplicitConversion: true により数値は文字列に変換される
    const result = await transform({ text: 123 });
    expect(result.text).toBe('123');
  });

  it('should reject when speed is below 50', async () => {
    await expect(transform({ text: 'テスト', speed: 10 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject when speed is above 200', async () => {
    await expect(transform({ text: 'テスト', speed: 300 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject when pitch is below -300', async () => {
    await expect(transform({ text: 'テスト', pitch: -500 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject when pitch is above 300', async () => {
    await expect(transform({ text: 'テスト', pitch: 500 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should convert null optional fields to undefined', async () => {
    const result = await transform({
      text: 'テスト',
      narrator: null,
      speed: null,
      pitch: null,
    });
    expect(result.narrator).toBeUndefined();
    expect(result.speed).toBeUndefined();
    expect(result.pitch).toBeUndefined();
  });

  it('should reject unknown properties', async () => {
    await expect(
      transform({ text: 'テスト', unknown_field: 'value' }),
    ).rejects.toThrow(BadRequestException);
  });
});
