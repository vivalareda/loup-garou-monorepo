/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: <mock file> */
import { existsSync } from 'node:fs';
import sound from 'sound-play';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockedFunction,
  test,
  vi,
} from 'vitest';
import type { Game } from '@/core/game';
import { SegmentsManager } from '@/segments/segments-manager';
import type { SocketType } from '@/server/sockets';

vi.mock('sound-play');
vi.mock('node:fs');

describe('SegmentsManager', () => {
  let segmentsManager: SegmentsManager;
  let mockIo: SocketType;
  let mockSoundPlay: ReturnType<typeof vi.mocked>;
  let mockFs: MockedFunction<typeof vi.mocked>;
  let mockGame: Game;

  beforeEach(() => {
    mockGame = {
      getWerewolfList: vi.fn().mockReturnValue(['werewolf1', 'werewolf2']),
    } as unknown as Game;
    mockSoundPlay = vi.mocked(sound.play);
    mockFs = vi.mocked(existsSync);

    mockFs.mockReturnValue(true);

    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketType;

    segmentsManager = new SegmentsManager(mockGame, mockIo);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should play correct Cupid audio files in sequence', async () => {
    segmentsManager.currentSegment = 0;

    await segmentsManager.finishSegment();

    expect(mockSoundPlay).toHaveBeenCalledWith(
      './assets/Cupidon/Cupidon-2.mp3'
    );
  });

  test('should play Werewolf first audio file after lovers segment', async () => {
    vi.spyOn(segmentsManager, 'playSegment').mockImplementation(async () => {});

    segmentsManager.currentSegment = 2;
    await segmentsManager.finishSegment();

    expect(mockSoundPlay).toHaveBeenCalledWith(
      './assets/Werewolves/Werewolf-2.mp3'
    );
  });
});
