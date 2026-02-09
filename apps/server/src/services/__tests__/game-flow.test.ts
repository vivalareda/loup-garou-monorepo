import { describe, expect, it } from '@effect/vitest';
import type { MockScenario } from '@repo/types';
import { Data, Duration, Effect, Fiber, Layer, TestClock } from 'effect';
import { AudioManager } from '../AudioManager.js';
import { DayVote } from '../DayVote.js';
import { DeathManager } from '../DeathManager.js';
import { Game } from '../Game.js';
import { GameFlow } from '../GameFlow.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';
import { SocketAction } from '../SocketAction.js';
import { type SocketIOInstance, SocketServer } from '../SocketServer.js';
import { WerewolvesVote } from '../WerewolvesVote.js';

type Emission =
  | { kind: 'to'; sid: string; event: string; data: unknown }
  | { kind: 'broadcast'; event: string; data: unknown };

const isToEmission = (e: Emission): e is Extract<Emission, { kind: 'to' }> =>
  e.kind === 'to';

type AudioMock = ReturnType<typeof makeAudioCapture>['audio'];

class TestTimeoutError extends Data.TaggedError('TestTimeoutError')<{
  message: string;
}> {}

describe('GameFlow', () => {
  it.effect(
    'should run a day-vote tie-break end-to-end and proceed to next night',
    () => {
      // Arrange
      const { io, emissions } = makeIoCapture();
      const cursor = { current: 0 };
      const { audio, playAudioCalls } = makeAudioCapture();
      const testLayer = makeFullGameFlowTestLayer(io, audio);

      // Act + Assert
      return Effect.gen(function* () {
        const lobby = yield* Lobby;
        const gameFlow = yield* GameFlow;
        const socketAction = yield* SocketAction;

        yield* addSixPlayers(lobby.addPlayer);

        const scenarioFiber = yield* gameFlow
          .loadMockScenario('DAY_VOTE')
          .pipe(Effect.fork);

        // Wait for village voting phase to start
        yield* waitFor(
          emissions,
          cursor,
          (e) => e.kind === 'broadcast' && e.event === 'day:voting-phase-start'
        );

        // Cast votes to produce a 2-2-1-1 tie among top victims [socket-5, socket-6]
        // Sheriff is deterministic: slot 0 -> socket-1
        yield* socketAction.handleDayVote('socket-2', 'socket-5');
        yield* socketAction.handleDayVote('socket-3', 'socket-5');
        yield* socketAction.handleDayVote('socket-5', 'socket-6');
        yield* socketAction.handleDayVote('socket-6', 'socket-6');
        yield* socketAction.handleDayVote('socket-4', 'socket-3');

        // The final vote triggers tie handling and will block awaiting sheriff pick,
        // so fork it and drive the tie-break via GameFlow.
        const lastVoteFiber = yield* socketAction
          .handleDayVote('socket-1', 'socket-2')
          .pipe(Effect.fork);

        const sheriffPrompt = (yield* waitFor(
          emissions,
          cursor,
          (e) =>
            e.kind === 'to' &&
            e.sid === 'socket-1' &&
            e.event === 'day:sheriff-vote'
        )) as Extract<Emission, { kind: 'to' }>;
        expect(sheriffPrompt.data).toEqual(['socket-5', 'socket-6']);

        // Sheriff chooses one of the tied victims (both are lovers in this scenario)
        yield* gameFlow.completeDayVoteTie('socket-5');
        yield* Fiber.join(lastVoteFiber);

        // Validate the key audio beats are present and ordered.
        const idxTie = playAudioCalls.indexOf('Day-vote/Day-vote-tie');
        const idxVoteDeath = playAudioCalls.indexOf('Day-vote/Vote-Death');
        const idxLover = playAudioCalls.indexOf('Day-vote/Lover');
        const idxSleep = playAudioCalls.indexOf(
          'Day-vote/Village-go-back-sleep'
        );

        expect(idxTie).toBeGreaterThanOrEqual(0);
        expect(idxVoteDeath).toBeGreaterThanOrEqual(0);
        expect(idxLover).toBeGreaterThanOrEqual(0);
        expect(idxSleep).toBeGreaterThanOrEqual(0);
        expect(idxTie).toBeLessThan(idxVoteDeath);
        expect(idxVoteDeath).toBeLessThan(idxLover);
        expect(idxLover).toBeLessThan(idxSleep);

        // Ensure we actually progress to the next night (werewolves are prompted again)
        yield* waitForCount(
          emissions,
          (e) => e.kind === 'to' && e.event === 'werewolf:pick-required',
          2
        );

        // Cleanup
        yield* Fiber.interrupt(lastVoteFiber);
        yield* Fiber.interrupt(scenarioFiber);
      }).pipe(Effect.provide(testLayer));
    }
  );

  it.effect('should prompt sheriff on tie and play tie audio', () => {
    // Arrange
    const { io, emissions } = makeIoCapture();
    const cursor = { current: 0 };
    const { audio, playAudioCalls } = makeAudioCapture();
    const testLayer = makeGameFlowTestLayer(io, audio);

    // Act + Assert
    return Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const gameFlow = yield* GameFlow;

      yield* addSixPlayers(lobby.addPlayer);

      // Ensure sheriff is deterministic (slot 0 -> socket-1)
      const scenario: MockScenario = {
        segment: 'DAY_VOTE',
        index: 0,
        sheriffPlayerSlot: 0,
        players: [
          { role: 'VILLAGER' },
          { role: 'VILLAGER' },
          { role: 'VILLAGER' },
          { role: 'WITCH' },
          { role: 'WEREWOLF' },
          { role: 'VILLAGER' },
        ],
      };
      yield* game.setPlayers(scenario);

      const tieFiber = yield* gameFlow
        .runDayVoteTie(['socket-5', 'socket-6'])
        .pipe(Effect.fork);

      const prompt = (yield* waitFor(
        emissions,
        cursor,
        (e) =>
          e.kind === 'to' &&
          e.sid === 'socket-1' &&
          e.event === 'day:sheriff-vote'
      )) as Extract<Emission, { kind: 'to' }>;

      expect(prompt.data).toEqual(['socket-5', 'socket-6']);
      expect(playAudioCalls).toContain('Day-vote/Day-vote-tie');

      yield* gameFlow.completeDayVoteTie('socket-5');
      const chosen = yield* Fiber.join(tieFiber);
      expect(chosen).toBe('socket-5');
    }).pipe(Effect.provide(testLayer));
  });

  it.effect(
    'should play lover-partner-hunter audio and sheriff sleep audio (no hunter-start-vote)',
    () => {
      // Arrange
      const { io, emissions } = makeIoCapture();
      const cursor = { current: 0 };
      const { audio, playAudioCalls } = makeAudioCapture();
      const testLayer = makeGameFlowTestLayer(io, audio);

      // Act + Assert
      return Effect.gen(function* () {
        const lobby = yield* Lobby;
        const game = yield* Game;
        const gameFlow = yield* GameFlow;

        yield* addSixPlayers(lobby.addPlayer);

        const scenario: MockScenario = {
          segment: 'DAY_VOTE',
          index: 0,
          players: [
            { role: 'VILLAGER' }, // socket-1
            { role: 'VILLAGER' }, // socket-2 (lover victim)
            { role: 'HUNTER' }, // socket-3 (lover partner)
            { role: 'WITCH' }, // socket-4 (prevents some win conditions)
            { role: 'WEREWOLF' }, // socket-5
            { role: 'VILLAGER' }, // socket-6 (hunter revenge target)
          ],
        };
        yield* game.setPlayers(scenario);
        yield* game.setLovers('socket-2', 'socket-3');

        const deathFiber = yield* gameFlow
          .confirmAndAlertSingleDeath('socket-2', 'DAY_VOTE', true)
          .pipe(Effect.fork);

        yield* waitFor(
          emissions,
          cursor,
          (e) =>
            e.kind === 'to' &&
            e.sid === 'socket-3' &&
            e.event === 'hunter:pick-required'
        );

        yield* gameFlow.completeHunterKill('socket-6');
        yield* Fiber.join(deathFiber);

        const idxVoteDeath = playAudioCalls.indexOf('Day-vote/Vote-Death');
        const idxLoverPartnerHunter = playAudioCalls.indexOf(
          'Day-vote/Lover-partner-hunter'
        );
        const idxSleep = playAudioCalls.indexOf(
          'Day-vote/Village-go-back-sleep'
        );

        expect(idxVoteDeath).toBeGreaterThanOrEqual(0);
        expect(idxLoverPartnerHunter).toBeGreaterThanOrEqual(0);
        expect(idxSleep).toBeGreaterThanOrEqual(0);
        expect(idxVoteDeath).toBeLessThan(idxLoverPartnerHunter);
        expect(idxLoverPartnerHunter).toBeLessThan(idxSleep);

        expect(playAudioCalls).not.toContain('Day-vote/Lover');
        expect(playAudioCalls).not.toContain('Hunter/Hunter-start-vote');
      }).pipe(Effect.provide(testLayer));
    }
  );

  it.effect(
    'should reveal lovers then wait until closed (LOVERS scenario)',
    () => {
      // Arrange
      const { io, emissions } = makeIoCapture();
      const { audio } = makeAudioCapture();
      const testLayer = makeGameFlowTestLayer(io, audio);

      // Act + Assert
      return Effect.gen(function* () {
        const lobby = yield* Lobby;
        const gameFlow = yield* GameFlow;

        yield* addSixPlayers(lobby.addPlayer);

        const fiber = yield* gameFlow
          .loadMockScenario('LOVERS')
          .pipe(Effect.fork);

        // promptLovers sleeps 5s then 6s
        yield* TestClock.adjust(Duration.millis(11_000));
        yield* Effect.yieldNow();

        expect(
          emissions
            .filter(isToEmission)
            .filter((e) => e.event === 'alert:player-is-lover')
        ).toEqual([
          {
            kind: 'to',
            sid: 'socket-2',
            event: 'alert:player-is-lover',
            data: 'socket-3',
          },
          {
            kind: 'to',
            sid: 'socket-3',
            event: 'alert:player-is-lover',
            data: 'socket-2',
          },
        ]);

        expect(
          emissions
            .filter(isToEmission)
            .filter((e) => e.event === 'alert:lovers-can-close-alert')
            .map((e) => e.sid)
            .sort()
        ).toEqual(['socket-2', 'socket-3']);

        yield* gameFlow.completeLoversDefer();
        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(testLayer));
    }
  );

  it.effect(
    'should prompt werewolves and set pending death (WEREWOLF scenario)',
    () => {
      // Arrange
      const { io, emissions } = makeIoCapture();
      const { audio } = makeAudioCapture();
      const testLayer = makeGameFlowTestLayer(io, audio);

      // Act + Assert
      return Effect.gen(function* () {
        const lobby = yield* Lobby;
        const gameFlow = yield* GameFlow;
        const deathManager = yield* DeathManager;

        yield* addSixPlayers(lobby.addPlayer);

        // The built-in WEREWOLF mock does not include a WITCH role, but segments do.
        // Skip WITCH so the scenario can focus on werewolf voting.
        yield* gameFlow.markSegmentAsSkipped('WITCH');

        const fiber = yield* gameFlow
          .loadMockScenario('WEREWOLF')
          .pipe(Effect.fork);

        yield* waitForCount(
          emissions,
          (e) => e.kind === 'to' && e.event === 'werewolf:pick-required',
          2
        );

        expect(
          emissions
            .filter(isToEmission)
            .filter((e) => e.event === 'werewolf:pick-required')
            .map((e) => e.sid)
            .sort()
        ).toEqual(['socket-2', 'socket-3']);

        yield* gameFlow.completeWerewolfVote('socket-6');
        yield* Effect.yieldNow();

        const victim = yield* deathManager.getVictim('WEREWOLVES');
        expect(victim.getSocketId()).toBe('socket-6');

        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(testLayer));
    }
  );

  it.effect(
    'should prompt witch to heal the correct victim (WITCH scenario)',
    () => {
      // Arrange
      const { io, emissions } = makeIoCapture();
      const cursor = { current: 0 };
      const { audio, playAudioCalls } = makeAudioCapture();
      const testLayer = makeGameFlowTestLayer(io, audio);

      // Act + Assert
      return Effect.gen(function* () {
        const lobby = yield* Lobby;
        const game = yield* Game;
        const gameFlow = yield* GameFlow;

        yield* addSixPlayers(lobby.addPlayer);

        const fiber = yield* gameFlow
          .loadMockScenario('WITCH')
          .pipe(Effect.fork);

        const healPrompt = (yield* waitFor(
          emissions,
          cursor,
          (e) => e.kind === 'to' && e.event === 'witch:can-heal'
        )) as Extract<Emission, { kind: 'to' }>;

        // Built-in WITCH scenario: witch at slot 3 => socket-4; werewolves target slot 5 => socket-6
        expect(healPrompt.sid).toBe('socket-4');
        expect(healPrompt.data).toBe('socket-6');

        yield* gameFlow.completeWitchHeal(true);

        const poisonPrompt = (yield* waitFor(
          emissions,
          cursor,
          (e) => e.kind === 'to' && e.event === 'witch:pick-poison-player'
        )) as Extract<Emission, { kind: 'to' }>;

        expect(poisonPrompt.sid).toBe('socket-4');
        yield* gameFlow.completeWitchPoison(null);

        yield* waitForAudioCall(playAudioCalls, 'Witch/Witch-end');

        expect(yield* game.canWitchHeal).toBe(false);
        expect(yield* game.canWitchKill).toBe(true);

        // Audio: just check a couple stable waypoints (avoid brittle full sequences)
        expect(playAudioCalls).toContain('Witch/wake-up-witch');
        expect(playAudioCalls).toContain('Witch/Witch-end');

        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(testLayer));
    }
  );

  it.effect(
    'should resolve pending lover deaths then prompt alive players (DAY_VOTE scenario)',
    () => {
      // Arrange
      const { io, emissions } = makeIoCapture();
      const cursor = { current: 0 };
      const { audio } = makeAudioCapture();
      const testLayer = makeGameFlowTestLayer(io, audio);

      // Act + Assert
      return Effect.gen(function* () {
        const lobby = yield* Lobby;
        const gameFlow = yield* GameFlow;

        yield* addSixPlayers(lobby.addPlayer);

        const fiber = yield* gameFlow
          .loadMockScenario('DAY_VOTE')
          .pipe(Effect.fork);

        yield* waitFor(
          emissions,
          cursor,
          (e) => e.kind === 'broadcast' && e.event === 'day:voting-phase-start'
        );

        // Alive players get vote prompts
        expect(
          emissions
            .filter(isToEmission)
            .filter((e) => e.event === 'day:vote-required')
            .map((e) => e.sid)
            .sort()
        ).toEqual([
          'socket-1',
          'socket-2',
          'socket-3',
          'socket-4',
          'socket-5',
          'socket-6',
        ]);

        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(testLayer));
    }
  );

  it.effect(
    'should prompt hunter for revenge when hunter dies (HUNTER scenario)',
    () => {
      // Arrange
      const { io, emissions } = makeIoCapture();
      const cursor = { current: 0 };
      const { audio, playAudioCalls } = makeAudioCapture();
      const testLayer = makeGameFlowTestLayer(io, audio);

      // Act + Assert
      return Effect.gen(function* () {
        const lobby = yield* Lobby;
        const gameFlow = yield* GameFlow;

        yield* addSixPlayers(lobby.addPlayer);

        const fiber = yield* gameFlow
          .loadMockScenario('HUNTER')
          .pipe(Effect.fork);

        const hunterPrompt = (yield* waitFor(
          emissions,
          cursor,
          (e) => e.kind === 'to' && e.event === 'hunter:pick-required'
        )) as Extract<Emission, { kind: 'to' }>;

        expect(hunterPrompt.sid).toBe('socket-4');

        yield* gameFlow.completeHunterKill('socket-1');

        yield* waitFor(
          emissions,
          cursor,
          (e) =>
            e.kind === 'to' &&
            e.event === 'alert:player-is-dead' &&
            e.sid === 'socket-1'
        );

        expect(playAudioCalls).toContain('Hunter/Hunter');

        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(testLayer));
    }
  );

  it.effect(
    'should announce win/loss only once (checkWinCondition idempotency)',
    () => {
      // Arrange
      const { io, emissions } = makeIoCapture();
      const { audio } = makeAudioCapture();
      const testLayer = makeGameFlowTestLayer(io, audio);

      // Act + Assert
      return Effect.gen(function* () {
        const lobby = yield* Lobby;
        const game = yield* Game;
        const gameFlow = yield* GameFlow;

        yield* addSixPlayers(lobby.addPlayer);

        const scenario: MockScenario = {
          segment: 'DAY_VOTE',
          index: 0,
          players: [
            { role: 'WEREWOLF' },
            { role: 'WEREWOLF' },
            { role: 'CUPID' },
            { role: 'WITCH' },
            { role: 'VILLAGER' },
            { role: 'VILLAGER' },
          ],
        };

        yield* game.setPlayers(scenario);

        const werewolves = yield* game.getWerewolves;
        expect(werewolves.length).toBe(2);

        for (const wolf of werewolves) {
          wolf.kill();
        }

        const before = emissions.length;
        const first = yield* gameFlow.checkWinCondition;
        const afterFirst = emissions.length;
        const second = yield* gameFlow.checkWinCondition;
        const afterSecond = emissions.length;

        expect(first).toBe(true);
        expect(second).toBe(true);

        expect(afterFirst).toBeGreaterThan(before);
        expect(afterSecond).toBe(afterFirst);

        const winners = emissions
          .filter(isToEmission)
          .filter((e) => e.event === 'alert:player-won');
        const losers = emissions
          .filter(isToEmission)
          .filter((e) => e.event === 'alert:player-lost');
        expect(winners.length + losers.length).toBeGreaterThan(0);
      }).pipe(Effect.provide(testLayer));
    }
  );
});

// Helpers
function makeGameFlowTestLayer(io: SocketIOInstance, audio: AudioMock) {
  const socketLayer = Layer.succeed(SocketServer, io);
  const audioLayer = Layer.succeed(AudioManager, audio);

  const lobbyLayer = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(LobbyConfig.Live)
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

  return Layer.mergeAll(baseLayer, gameFlowLayer);
}

function makeFullGameFlowTestLayer(io: SocketIOInstance, audio: AudioMock) {
  const socketLayer = Layer.succeed(SocketServer, io);
  const audioLayer = Layer.succeed(AudioManager, audio);

  const lobbyLayer = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(LobbyConfig.Live)
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
  const werewolvesVoteLayer = WerewolvesVote.DefaultWithoutDependencies.pipe(
    Layer.provide(gameLayer)
  );

  const baseLayer = Layer.mergeAll(
    lobbyLayer,
    gameLayer,
    deathManagerLayer,
    dayVoteLayer,
    werewolvesVoteLayer,
    socketLayer,
    audioLayer
  );

  const gameFlowLayer = GameFlow.DefaultWithoutDependencies.pipe(
    Layer.provide(baseLayer)
  );
  const socketActionLayer = SocketAction.DefaultWithoutDependencies.pipe(
    Layer.provide(baseLayer),
    Layer.provide(gameFlowLayer)
  );

  return Layer.mergeAll(baseLayer, gameFlowLayer, socketActionLayer);
}

function makeIoCapture() {
  const emissions: Emission[] = [];

  const io = {
    to: (sid: string) => ({
      emit: (event: string, data?: unknown) => {
        emissions.push({ kind: 'to', sid, event, data });
      },
    }),
    emit: (event: string, data?: unknown) => {
      emissions.push({ kind: 'broadcast', event, data });
    },
    on: () => {
      return;
    },
  } as unknown as SocketIOInstance;

  return { io, emissions };
}

function makeAudioCapture() {
  const playAudioCalls: string[] = [];

  const audio = {
    playAudio: (file: string) =>
      Effect.sync(() => {
        playAudioCalls.push(file);
      }),
    playIntro: Effect.void,
    playSegmentStart: () => Effect.void,
    playSegmentEnd: () => Effect.void,
    playWinnerAudio: () => Effect.void,
    playDeathAnnoucementAudio: () => Effect.void,
    isLoverAudioRunning: () => false,
  };

  return { audio, playAudioCalls };
}

function addSixPlayers<R, E, A>(
  addPlayer: (name: string, sid: string) => Effect.Effect<A, E, R>
) {
  return Effect.forEach(
    [
      ['Player1', 'socket-1'],
      ['Player2', 'socket-2'],
      ['Player3', 'socket-3'],
      ['Player4', 'socket-4'],
      ['Player5', 'socket-5'],
      ['Player6', 'socket-6'],
    ] as const,
    ([name, sid]) => addPlayer(name, sid)
  ).pipe(Effect.asVoid);
}

const waitFor = Effect.fn('test.waitFor')(function* (
  emissions: Emission[],
  cursor: { current: number },
  predicate: (e: Emission) => boolean,
  maxTurns = 10_000
) {
  for (let turn = 0; turn < maxTurns; turn += 1) {
    for (let i = cursor.current; i < emissions.length; i += 1) {
      const e = emissions[i];
      if (e && predicate(e)) {
        cursor.current = i + 1;
        return e;
      }
    }
    yield* Effect.yieldNow();
  }

  return yield* new TestTimeoutError({
    message: 'Timed out waiting for expected SocketServer emission',
  });
});

const waitForCount = Effect.fn('test.waitForCount')(function* (
  emissions: Emission[],
  predicate: (e: Emission) => boolean,
  count: number,
  maxTurns = 10_000
) {
  for (let turn = 0; turn < maxTurns; turn += 1) {
    const matches = emissions.filter(predicate);
    if (matches.length >= count) {
      return matches;
    }
    yield* Effect.yieldNow();
  }

  return yield* new TestTimeoutError({
    message: 'Timed out waiting for expected SocketServer emissions',
  });
});

const waitForAudioCall = Effect.fn('test.waitForAudioCall')(function* (
  calls: string[],
  expected: string,
  maxTurns = 10_000
) {
  for (let turn = 0; turn < maxTurns; turn += 1) {
    if (calls.includes(expected)) {
      return;
    }
    yield* Effect.yieldNow();
  }

  return yield* new TestTimeoutError({
    message: `Timed out waiting for audio call: ${expected}`,
  });
});
