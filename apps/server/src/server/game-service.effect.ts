import { Context, Effect, Layer, Ref } from 'effect';
import type { Game } from '@/core/game';
import type { SegmentsManager } from '@/segments/segments-manager';
import type { EventsActions } from '@/server/events-actions';
import type { DeathManager } from '@/core/death-manager';
import type { AudioManager } from '@/segments/audio-manager';
import type { SpecialScenarios } from '@/core/special-scenarios';

/**
 * Game state service - manages all game-related state
 */
export class GameState extends Context.Tag('GameState')<
  GameState,
  {
    readonly game: Game;
    readonly deathManager: DeathManager;
    readonly audioManager: AudioManager;
    readonly specialScenarios: SpecialScenarios;
    readonly segmentsManager: SegmentsManager;
    readonly eventsActions: EventsActions;
    readonly loversAlertCount: Ref.Ref<number>;
  }
>() {}

/**
 * Creates a new game state with all dependencies
 */
export const makeGameState = (
  game: Game,
  deathManager: DeathManager,
  audioManager: AudioManager,
  specialScenarios: SpecialScenarios,
  segmentsManager: SegmentsManager,
  eventsActions: EventsActions
) =>
  Effect.gen(function* () {
    const loversAlertCount = yield* Ref.make(0);

    return {
      game,
      deathManager,
      audioManager,
      specialScenarios,
      segmentsManager,
      eventsActions,
      loversAlertCount,
    };
  });

/**
 * Game State layer - wraps existing game instances
 */
export const makeGameStateLayer = (
  game: Game,
  deathManager: DeathManager,
  audioManager: AudioManager,
  specialScenarios: SpecialScenarios,
  segmentsManager: SegmentsManager,
  eventsActions: EventsActions
) =>
  Layer.effect(
    GameState,
    makeGameState(
      game,
      deathManager,
      audioManager,
      specialScenarios,
      segmentsManager,
      eventsActions
    )
  );

/**
 * Reset lovers alert count
 */
export const resetLoversAlertCount = Effect.gen(function* () {
  const { loversAlertCount } = yield* GameState;
  yield* Ref.set(loversAlertCount, 0);
});

/**
 * Increment lovers alert count and return the new value
 */
export const incrementLoversAlertCount = Effect.gen(function* () {
  const { loversAlertCount } = yield* GameState;
  yield* Ref.update(loversAlertCount, (n) => n + 1);
  return yield* Ref.get(loversAlertCount);
});

/**
 * Get current lovers alert count
 */
export const getLoversAlertCount = Effect.gen(function* () {
  const { loversAlertCount } = yield* GameState;
  return yield* Ref.get(loversAlertCount);
});
