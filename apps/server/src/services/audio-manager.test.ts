import { describe, expect, vi, beforeEach } from '@effect/vitest';
import { Effect } from 'effect';
import { AudioManager } from './AudioManager';

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

vi.mock('sound-play', () => ({
  default: { play: vi.fn().mockResolvedValue(undefined) },
}));

const getMockSoundPlay = () => {
  const soundPlay = await import('sound-play');
  return soundPlay.default.play;
};

const getMockExistsSync = () => {
  const fs = await import('node:fs');
  return fs.existsSync;
};

describe('AudioManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMockExistsSync().mockReturnValue(true);
    getMockSoundPlay().mockResolvedValue(undefined);
  });

  describe('playSegmentStart', () => {
    it.effect('should play CUPID start audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentStart('CUPID');
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Cupidon/Cupidon-1.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );

    it.effect('should play LOVERS start audio in background', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentStart('LOVERS');
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Lovers/combined_lover.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );

    it.effect('should play WEREWOLF start audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentStart('WEREWOLF');
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Werewolves/Werewolves-1.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );

    it.effect('should play WITCH-HEAL start audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentStart('WITCH-HEAL');
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Witch/Witch-wake-up.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );

    it.effect('should play WITCH-POISON start audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentStart('WITCH-POISON');
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Witch/Witch-poison.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );

    it.effect('should play DAY start audio in background', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentStart('DAY');
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Night-end/Wake-up-everyone.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );
  });

  describe('playSegmentEnd', () => {
    it.effect('should play CUPID end audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentEnd('CUPID');
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Cupidon/Cupidon-2.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );

    it.effect('should play LOVERS end audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentEnd('LOVERS');
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Lovers/Lover-3.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );

    it.effect('should play WEREWOLF end audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentEnd('WEREWOLF');
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Werewolves/Werewolves-2.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );

    it.effect('should not play WITCH-HEAL end audio (null)', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentEnd('WITCH-HEAL');
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).not.toHaveBeenCalled();
      }).pipe(Effect.provide(AudioManager.Default))
    );

    it.effect('should play WITCH-POISON end audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentEnd('WITCH-POISON');
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Witch/Witch-end.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );

    it.effect('should play DAY end audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentEnd('DAY');
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Day-vote/Vote-Death.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );

    it.effect('should not play HUNTER end audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentEnd('HUNTER');
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).not.toHaveBeenCalled();
      }).pipe(Effect.provide(AudioManager.Default))
    );
  });

  describe('playSegmentAudio', () => {
    it.effect('should play segment start when isStarting is true', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentAudio('CUPID', true);
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Cupidon/Cupidon-1.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );

    it.effect('should play segment end when isStarting is false', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentAudio('CUPID', false);
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Cupidon/Cupidon-2.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );

    it.effect('should not play HUNTER segment end', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentAudio('HUNTER', false);
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).not.toHaveBeenCalled();
      }).pipe(Effect.provide(AudioManager.Default))
    );

    it.effect('should not play WITCH-HEAL segment end', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSegmentAudio('WITCH-HEAL', false);
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).not.toHaveBeenCalled();
      }).pipe(Effect.provide(AudioManager.Default))
    );
  });

  describe('playWinnerAudio', () => {
    it.effect('should play werewolves win audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playWinnerAudio('werewolves');
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/End-game/Werewolves-won.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );

    it.effect('should play villagers win audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playWinnerAudio('villagers');
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/End-game/Villagers-won.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );
  });

  describe('playVillagersWonAudio', () => {
    it.effect('should play villagers win audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playVillagersWonAudio;
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/End-game/Villagers-won.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );
  });

  describe('playWerewolvesWonAudio', () => {
    it.effect('should play werewolves win audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playWerewolvesWonAudio;
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/End-game/Werewolves-won.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );
  });

  describe('nightHasEndedAudio', () => {
    it.effect('should play night ended audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.nightHasEndedAudio;
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Night/night-has-ended.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );
  });

  describe('playLoverAudio', () => {
    it.effect('should play lover audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playLoverAudio;
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Lovers/combined_lover.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );
  });

  describe('playSecondLoverIsHunterAudio', () => {
    it.effect('should play second lover is hunter audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playSecondLoverIsHunterAudio;
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Hunter/second-lover-is-hunter.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );
  });

  describe('playHunterIsLoverAudio', () => {
    it.effect('should play hunter is lover audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playHunterIsLoverAudio;
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Hunter/hunter-is-lover.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );
  });

  describe('playHunterAudio', () => {
    it.effect('should play hunter audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playHunterAudio;
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Hunter/hunter.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );
  });

  describe('playPostHunterAudio', () => {
    it.effect('should play post hunter audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playPostHunterAudio;
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Hunter/Hunter-start-vote.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );
  });

  describe('playDayEndAudio', () => {
    it.effect('should play day end audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playDayEndAudio;
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/Day-vote/Vote-Death.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );
  });

  describe('playDayVoteAudio', () => {
    it.effect('should play day vote audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        yield* audioManager.playDayVoteAudio;
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledWith('./assets/day-vote-start-universal.mp3');
      }).pipe(Effect.provide(AudioManager.Default))
    );
  });

  describe('Edge Cases', () => {
    it.effect('should handle all segment types for start audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        const segments = ['CUPID', 'LOVERS', 'WEREWOLF', 'WITCH-HEAL', 'WITCH-POISON', 'DAY'];
        for (const segment of segments) {
          yield* audioManager.playSegmentStart(segment as never);
        }
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledTimes(6);
      }).pipe(Effect.provide(AudioManager.Default))
    );

    it.effect('should handle all segment types for end audio', () =>
      Effect.gen(function* () {
        const audioManager = yield* AudioManager;
        const segments = ['CUPID', 'LOVERS', 'WEREWOLF', 'WITCH-HEAL', 'WITCH-POISON', 'DAY', 'HUNTER'];
        for (const segment of segments) {
          yield* audioManager.playSegmentEnd(segment as never);
        }
        const mockPlay = getMockSoundPlay();
        expect(mockPlay).toHaveBeenCalledTimes(5);
      }).pipe(Effect.provide(AudioManager.Default))
    );
  });
});
