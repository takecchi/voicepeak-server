import { VoicepeakService } from './voicepeak.service';
import { VoicepeakCli } from './voicepeak-cli';

function createMockCli(overrides: Partial<VoicepeakCli> = {}): VoicepeakCli {
  return {
    exec: jest.fn().mockResolvedValue({ stdout: '', stderr: '' }),
    ...overrides,
  } as unknown as VoicepeakCli;
}

describe('VoicepeakService', () => {
  describe('parseLines', () => {
    let service: VoicepeakService;

    beforeEach(() => {
      service = new VoicepeakService(createMockCli());
    });

    it('should parse single narrator output', () => {
      // 実際のCLI出力: ナレーターが1つだけの場合
      const stdout = 'Kasane Teto\n';
      expect(service.parseLines(stdout)).toEqual(['Kasane Teto']);
    });

    it('should parse multiple narrator output', () => {
      const stdout = 'Kasane Teto\nJapanese Male Child\nJapanese Female 1\n';
      expect(service.parseLines(stdout)).toEqual([
        'Kasane Teto',
        'Japanese Male Child',
        'Japanese Female 1',
      ]);
    });

    it('should parse emotion list output', () => {
      // 実際のCLI出力: --list-emotion "Kasane Teto"
      const stdout =
        'teto-overactive\nteto-low-key\nteto-whisper\nteto-powerful\nteto-sweet\n';
      expect(service.parseLines(stdout)).toEqual([
        'teto-overactive',
        'teto-low-key',
        'teto-whisper',
        'teto-powerful',
        'teto-sweet',
      ]);
    });

    it('should handle trailing newlines and whitespace', () => {
      const stdout = '  teto-overactive  \n  teto-low-key  \n\n';
      expect(service.parseLines(stdout)).toEqual([
        'teto-overactive',
        'teto-low-key',
      ]);
    });

    it('should return empty array for empty output', () => {
      expect(service.parseLines('')).toEqual([]);
      expect(service.parseLines('\n')).toEqual([]);
      expect(service.parseLines('\n\n\n')).toEqual([]);
    });
  });

  describe('listNarrators', () => {
    it('should call CLI with --list-narrator and parse output', async () => {
      // 実際のCLI: stdoutにナレーター名、stderrにデバッグ情報
      const mockExec = jest.fn().mockResolvedValue({
        stdout: 'Kasane Teto\n',
        stderr:
          '[debug][1774487583][voicepeak.GeneralDebug] UserApplication Folder: /opt/voicepeak/usersettings\niconv_open is not supported\n',
      });
      const service = new VoicepeakService(createMockCli({ exec: mockExec }));

      const result = await service.listNarrators();

      expect(mockExec).toHaveBeenCalledWith(['--list-narrator']);
      expect(result).toEqual(['Kasane Teto']);
    });
  });

  describe('listEmotions', () => {
    it('should call CLI with --list-emotion and narrator name', async () => {
      // 実際のCLI: --list-emotion "Kasane Teto" の出力
      const mockExec = jest.fn().mockResolvedValue({
        stdout:
          'teto-overactive\nteto-low-key\nteto-whisper\nteto-powerful\nteto-sweet\n',
        stderr:
          '[debug][1774487586][voicepeak.GeneralDebug] UserApplication Folder: /opt/voicepeak/usersettings\niconv_open is not supported\n',
      });
      const service = new VoicepeakService(createMockCli({ exec: mockExec }));

      const result = await service.listEmotions('Kasane Teto');

      expect(mockExec).toHaveBeenCalledWith(['--list-emotion', 'Kasane Teto']);
      expect(result).toEqual([
        'teto-overactive',
        'teto-low-key',
        'teto-whisper',
        'teto-powerful',
        'teto-sweet',
      ]);
    });
  });

  describe('buildArgs', () => {
    let service: VoicepeakService;

    beforeEach(() => {
      service = new VoicepeakService(createMockCli());
    });

    it('should build minimal args with text and output', () => {
      const args = service.buildArgs('hello', '/tmp/out.wav', {
        text: 'hello',
      });
      expect(args).toEqual(['-s', 'hello', '-o', '/tmp/out.wav']);
    });

    it('should include narrator when specified', () => {
      const args = service.buildArgs('hello', '/tmp/out.wav', {
        text: 'hello',
        narrator: 'Kasane Teto',
      });
      expect(args).toContain('-n');
      expect(args).toContain('Kasane Teto');
    });

    it('should format emotion as key=value pairs', () => {
      // 実際の感情名: teto-overactive, teto-low-key など
      const args = service.buildArgs('hello', '/tmp/out.wav', {
        text: 'hello',
        emotion: { 'teto-overactive': 50, 'teto-sweet': 25 },
      });
      expect(args).toContain('-e');
      expect(args).toContain('teto-overactive=50,teto-sweet=25');
    });

    it('should include speed and pitch', () => {
      const args = service.buildArgs('hello', '/tmp/out.wav', {
        text: 'hello',
        speed: 150,
        pitch: -100,
      });
      expect(args).toContain('--speed');
      expect(args).toContain('150');
      expect(args).toContain('--pitch');
      expect(args).toContain('-100');
    });

    it('should include all options together', () => {
      const args = service.buildArgs('テスト', '/tmp/out.wav', {
        text: 'テスト',
        narrator: 'Kasane Teto',
        emotion: { 'teto-overactive': 100 },
        speed: 80,
        pitch: 200,
      });
      expect(args).toEqual([
        '-s',
        'テスト',
        '-o',
        '/tmp/out.wav',
        '-n',
        'Kasane Teto',
        '-e',
        'teto-overactive=100',
        '--speed',
        '80',
        '--pitch',
        '200',
      ]);
    });
  });

  describe('splitText', () => {
    let service: VoicepeakService;

    beforeEach(() => {
      service = new VoicepeakService(createMockCli());
    });

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

  describe('concatenateWav', () => {
    let service: VoicepeakService;

    beforeEach(() => {
      service = new VoicepeakService(createMockCli());
    });

    function createWav(dataSize: number, fillValue = 0xaa): Buffer {
      const buf = Buffer.alloc(44 + dataSize);
      // RIFF header
      buf.write('RIFF', 0);
      buf.writeUInt32LE(36 + dataSize, 4);
      buf.write('WAVE', 8);
      buf.write('fmt ', 12);
      buf.writeUInt32LE(16, 16); // fmt chunk size
      buf.writeUInt16LE(1, 20); // PCM
      buf.writeUInt16LE(1, 22); // mono
      buf.writeUInt32LE(44100, 24); // sample rate
      buf.writeUInt32LE(88200, 28); // byte rate
      buf.writeUInt16LE(2, 32); // block align
      buf.writeUInt16LE(16, 34); // bits per sample
      buf.write('data', 36);
      buf.writeUInt32LE(dataSize, 40);
      buf.fill(fillValue, 44);
      return buf;
    }

    it('should concatenate two WAV files with correct headers', () => {
      const wav1 = createWav(100, 0xaa);
      const wav2 = createWav(50, 0xbb);

      const result = service.concatenateWav([wav1, wav2]);

      // Total size: 44 header + 150 data
      expect(result.length).toBe(44 + 150);
      // RIFF chunk size
      expect(result.readUInt32LE(4)).toBe(36 + 150);
      // data chunk size
      expect(result.readUInt32LE(40)).toBe(150);
      // Verify data content
      expect(result[44]).toBe(0xaa);
      expect(result[144]).toBe(0xbb);
    });

    it('should throw on empty input', () => {
      expect(() => service.concatenateWav([])).toThrow(
        'No WAV files to concatenate',
      );
    });

    it('should handle single WAV file', () => {
      const wav = createWav(100);
      const result = service.concatenateWav([wav]);
      expect(result.length).toBe(144);
      expect(result.readUInt32LE(40)).toBe(100);
    });
  });
});
