import { describe, expect, it } from '@effect/vitest';
import type { MockScenario } from '@repo/types';
import { Data, Effect, Fiber, Layer } from 'effect';
import { AudioManager } from '../AudioManager.js';
import { DayVote } from '../DayVote.js';
import { DeathManager } from '../DeathManager.js';
import { Game } from '../Game.js';
import { GameFlow } from '../GameFlow.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';
import { type SocketIOInstance, SocketServer } from '../SocketServer.js';

class TestTimeoutError extends Data.TaggedError('TestTimeoutError')<{
  message: string;
}> {}

describe('Hunter audio flow', () => {
  it.effect('plays hunter audio before starting vote', () => {
    const audioCalls: string[] = [];

    const emissions: Array<{ sid: string; event: string; data: unknown }> = [];
    const io = {
      to: (sid: string) => ({
        emit: (event: string, data?: unknown) => {
          emissions.push({ sid, event, data });
        },
      }),
      emit: () => {},
      on: () => {},
    } as unknown as SocketIOInstance;

    const socketLayer = Layer.succeed(SocketServer, io);

    const audioLayer = Layer.succeed(AudioManager, {
      playAudio: (file: string) =>
        Effect.sync(() => {
          audioCalls.push(file);
        }),
      playSegmentStart: () => Effect.void,
      playSegmentEnd: () => Effect.void,
      playWinnerAudio: () => Effect.void,
      playDeathAnnoucementAudio: () => Effect.void,
      playIntro: Effect.void,
      isLoverAudioRunning: () => false,
    });

    const configLayer = LobbyConfig.Live;
    const lobbyLayer = Lobby.DefaultWithoutDependencies.pipe(
      Layer.provide(configLayer)
    );
    const gameLayer = Game.DefaultWithoutDependencies.pipe(
      Layer.provide(lobbyLayer)
    );
    const deathManagerLayer = DeathManager.DefaultWithoutDependencies.pipe(
      Layer.provide(gameLayer)
    );
    const dayVoteLayer = DayVote.DefaultWithoutDependencies.pipe(
      Layer.provide(gameLayer)
    );
    const baseLayer = Layer.mergeAll(
      lobbyLayer,
      gameLayer,
      deathManagerLayer,
      dayVoteLayer,
      socketLayer,
      audioLayer
    );
    const gameFlowLayer = GameFlow.DefaultWithoutDependencies.pipe(
      Layer.provide(baseLayer)
    );
    const testLayer = Layer.mergeAll(baseLayer, gameFlowLayer);

    return Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const gameFlow = yield* GameFlow;

      const scenario: MockScenario = {
        segment: 'DAY_VOTE',
        index: 0,
        players: [
          { role: 'HUNTER' },
          { role: 'VILLAGER' },
          { role: 'VILLAGER' },
          { role: 'VILLAGER' },
          { role: 'WEREWOLF' },
          { role: 'VILLAGER' },
        ],
      };

      for (let i = 0; i < scenario.players.length; i += 1) {
        yield* lobby.addPlayer(`Player${i + 1}`, `socket-${i + 1}`);
      }

      yield* game.setPlayers(scenario);

      const players = yield* game.getPlayers;
      const hunter = players.find((player) => player.getRole() === 'HUNTER');
      const target = players.find((player) => player.getRole() === 'VILLAGER');

      expect(hunter).toBeDefined();
      expect(target).toBeDefined();

      const hunterSid = hunter?.getSocketId() ?? 'missing-hunter';
      const targetSid = target?.getSocketId() ?? 'missing-target';

      const deathFiber = yield* gameFlow
        .confirmAndAlertSingleDeath(hunterSid, 'DAY_VOTE')
        .pipe(Effect.fork);

      yield* waitForHunterPrompt(emissions, hunterSid);
      yield* gameFlow.completeHunterKill(targetSid);
      yield* Fiber.join(deathFiber);

      expect(audioCalls).toEqual(['Day-vote/Vote-Death', 'Day-vote/Hunter']);
    }).pipe(Effect.provide(testLayer));
  });
});

// Helpers
const waitForHunterPrompt = Effect.fn('waitForHunterPrompt')(function* (
  emissions: ReadonlyArray<{ sid: string; event: string }>,
  hunterSid: string,
  maxTurns = 10_000
) {
  for (let turn = 0; turn < maxTurns; turn += 1) {
    if (
      emissions.some(
        (e) => e.sid === hunterSid && e.event === 'hunter:pick-required'
      )
    ) {
      return;
    }
    yield* Effect.yieldNow();
  }

  return yield* new TestTimeoutError({
    message: 'Timed out waiting for hunter:pick-required',
  });
});
