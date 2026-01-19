import { Context, Effect, Layer, Ref } from 'effect';
import type { AudioError } from '@/Domain/audio-error';
import { AudioManagerTag } from '@/segments/audio-manager-effect';

export class SpecialScenariosService extends Context.Tag(
  'SpecialScenariosService'
)<
  SpecialScenariosService,
  {
    readonly partnerIsHunter: Effect.Effect<void, AudioError>;
    readonly hunterIsLover: Effect.Effect<void, AudioError>;
    readonly getHunterDiedFirst: Effect.Effect<boolean>;
    readonly resetHunterDiedFirst: Effect.Effect<void>;
  }
>() {}

export const SpecialScenariosLive = Layer.effect(
  SpecialScenariosService,
  Effect.gen(function* (_) {
    const audioManager = yield* _(AudioManagerTag);
    const hunterDiedFirstRef = yield* _(Ref.make(false));

    const partnerIsHunter = Effect.gen(function* ($) {
      yield* $(Ref.set(hunterDiedFirstRef, true));
      yield* $(audioManager.nightHasEndedAudio());
      yield* $(audioManager.playLoverAudio());
      yield* $(audioManager.playSecondLoverIsHunterAudio());
    });

    const hunterIsLover = Effect.gen(function* ($) {
      yield* $(audioManager.nightHasEndedAudio());
      yield* $(audioManager.playHunterIsLoverAudio());
    });

    const getHunterDiedFirst = Ref.get(hunterDiedFirstRef);

    const resetHunterDiedFirst = Ref.set(hunterDiedFirstRef, false);

    return {
      partnerIsHunter,
      hunterIsLover,
      getHunterDiedFirst,
      resetHunterDiedFirst,
    };
  })
);
