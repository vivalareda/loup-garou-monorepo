import { existsSync } from 'node:fs';
import type { SegmentType } from '@repo/types';
import { Config, Effect, Layer } from 'effect';
import sound from 'sound-play';
import { AudioPlaybackError } from './errors.js';

export class AudioManager extends Effect.Service<AudioManager>()(
  '@app/AudioManager',
  {
    effect: Effect.gen(function* () {
      const assetsPath = yield* Config.string('ASSETS_PATH').pipe(
        Config.withDefault('./assets')
      );

      const playAudio = (file: string) =>
        Effect.tryPromise({
          try: async () => {
            const fullPath = `${assetsPath}/${file}.mp3`;
            if (!existsSync(fullPath)) {
              return;
            }
            await sound.play(fullPath);
          },
          catch: (error) => new AudioPlaybackError({ file, error }),
        });

      return {
        playSegmentStart: (segment: SegmentType) =>
          Effect.gen(function* () {
            const audioFile = getSegmentStartAudio(segment);

            if (segment === 'LOVERS' || segment === 'DAY_VOTE') {
              Effect.runFork(playAudio(audioFile));
              return;
            }

            if (segment === 'DAY') {
              yield* playAudio('Night-end/Wake-up-everyone');
              Effect.runFork(playAudio(audioFile));
              return;
            }

            yield* playAudio(audioFile);
          }),

        playSegmentEnd: (segment: SegmentType) =>
          Effect.gen(function* () {
            switch (segment) {
              case 'CUPID':
                return yield* playAudio('Cupidon/Cupidon-2');
              case 'LOVERS':
              case 'LOVERS_REVEAL':
                return yield* playAudio('Lovers/Lover-3');
              case 'WEREWOLF':
                return yield* playAudio('Werewolves/Werewolves-2');
              case 'WITCH':
              case 'WITCH-POISON':
                return yield* playAudio('Witch/Witch-end');
              case 'DAY':
                return yield* playAudio('Day-vote/Vote-Death');
              case 'DAY_VOTE':
                return yield* playAudio('Day-vote/Vote-Death');
              case 'HUNTER':
                return; // No end audio for hunter
              case 'WITCH-HEAL':
                return; // No end audio for witch heal
              default:
                return; // unknown segment types
            }
          }),

        playWinnerAudio: (winner: 'werewolves' | 'villagers') =>
          playAudio(
            winner === 'werewolves'
              ? 'End-game/Werewolves-won'
              : 'End-game/Villagers-won'
          ),

        playIntro: () => playAudio('Intro'),

        playHunterDeath: () =>
          Effect.gen(function* () {
            yield* playAudio('Night-end/Wake-up-everyone');
            yield* playAudio('Night-end/Deaths');
            yield* playAudio('Hunter/Hunter');
          }),

        playLoverDeath: () => playAudio('Special-death/pre-day-vote-lover-2'),

        playHunterWithLoverDeath: () =>
          playAudio('Special-death/pre-day-vote-hunter-has-lover'),

        playDeathAnnouncement: (hasDeaths: boolean) =>
          playAudio(
            hasDeaths ? 'Night-end/Deaths' : 'Night-end/No-deaths-with-start'
          ),

        playDayVoteHunterHasPartner: () =>
          Effect.gen(function* () {
            yield* playAudio('Day-vote/Vote-Death');
            yield* playAudio('Day-vote/Hunter');
          }),

        playDayVoteAudio: () => playAudio('day-vote-start-universal'),

        playDayVoteLoversDeath: () =>
          Effect.gen(function* () {
            yield* playAudio('Day-vote/Vote-Death');
            yield* playAudio('Day-vote/Lover');
          }),

        playSecondLoverIsHunterAudio: () =>
          playAudio('Pre-day-vote/Second-lover-hunter'),

        playPostHunterAudio: () => playAudio('Hunter/Hunter-start-vote'),

        nightHasEndedAudio: () => playAudio('Night-end/Wake-up-everyone'),

        playHunterIsLoverAudio: () =>
          playAudio('Special-scenarios/hunter-is-lover'),
      };
    }),
    dependencies: [], // No dependencies, self-contained
  }
) {
  static Test = Layer.succeed(
    this,
    new AudioManager({
      playIntro: () => Effect.void,
      playWinnerAudio: () => Effect.void,
      playSegmentEnd: () => Effect.void,
      playSegmentStart: () => Effect.void,
      playHunterDeath: () => Effect.void,
      playLoverDeath: () => Effect.void,
      playHunterWithLoverDeath: () => Effect.void,
      playDeathAnnouncement: () => Effect.void,
      playDayVoteHunterHasPartner: () => Effect.void,
      playDayVoteAudio: () => Effect.void,
      playDayVoteLoversDeath: () => Effect.void,
      playSecondLoverIsHunterAudio: () => Effect.void,
      playPostHunterAudio: () => Effect.void,
      nightHasEndedAudio: () => Effect.void,
      playHunterIsLoverAudio: () => Effect.void,
    })
  );
}

const getSegmentStartAudio = (segment: SegmentType): string => {
  switch (segment) {
    case 'CUPID':
      return 'Cupidon/Cupidon-1';
    case 'LOVERS':
    case 'LOVERS_REVEAL':
      return 'Lovers/combined_lover';
    case 'WEREWOLF':
      return 'Werewolves/Werewolves-1';
    case 'WITCH':
    case 'WITCH-HEAL':
      return 'Witch/Witch-wake-up';
    case 'WITCH-POISON':
      return 'Witch/Witch-poison';
    case 'DAY_VOTE':
      return 'Day-vote/Vote-Start';
    case 'DAY':
      return 'Night-end/Deaths'; // This will be handled specially in playSegmentStart
    case 'HUNTER':
      return 'not implemented yet';
    default:
      return 'problem';
  }
};
