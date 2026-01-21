import { Effect } from 'effect';
import { AudioManager } from './AudioManager.js';

export class SpecialScenarios extends Effect.Service<SpecialScenarios>()(
  '@app/SpecialScenarios',
  {
    effect: Effect.gen(function* () {
      const audioManager = yield* AudioManager;

      let hunterDiedFirst = false;

      return {
        partnerIsHunter: Effect.gen(function* () {
          hunterDiedFirst = true;
          yield* audioManager.nightHasEndedAudio;
          yield* audioManager.playLoverAudio;
          yield* audioManager.playSecondLoverIsHunterAudio;
        }),

        hunterIsLover: Effect.gen(function* () {
          yield* audioManager.nightHasEndedAudio;
          yield* audioManager.playHunterIsLoverAudio;
        }),

        getHunterDiedFirst: Effect.sync(() => hunterDiedFirst),
      };
    }),
    dependencies: [AudioManager.Default],
  }
) {}
