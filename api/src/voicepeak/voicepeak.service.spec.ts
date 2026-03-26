import { VoicepeakService } from './voicepeak.service';

describe('VoicepeakService', () => {
  let service: VoicepeakService;

  beforeEach(() => {
    service = new VoicepeakService();
  });

  describe('splitText', () => {
    it('should return single chunk for short text', () => {
      expect(service.splitText('こんにちは')).toEqual(['こんにちは']);
    });

    it('should return single chunk for exactly 140 chars', () => {
      const text = 'あ'.repeat(140);
      expect(service.splitText(text)).toEqual([text]);
    });

    it('should split at delimiter for long text', () => {
      const text = 'あ'.repeat(100) + '。' + 'い'.repeat(100);
      const chunks = service.splitText(text);
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toBe('あ'.repeat(100) + '。');
      expect(chunks[1]).toBe('い'.repeat(100));
    });

    it('should hard split at 140 chars when no delimiter found', () => {
      const text = 'あ'.repeat(200);
      const chunks = service.splitText(text);
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toBe('あ'.repeat(140));
      expect(chunks[1]).toBe('あ'.repeat(60));
    });

    it('should handle multiple delimiters', () => {
      const part1 = 'あ'.repeat(70) + '。';
      const part2 = 'い'.repeat(70) + '。';
      const part3 = 'う'.repeat(30);
      const text = part1 + part2 + part3;
      const chunks = service.splitText(text);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks.join('')).toBe(text);
    });

    it('should return empty array for empty text', () => {
      expect(service.splitText('')).toEqual(['']);
    });
  });
});
