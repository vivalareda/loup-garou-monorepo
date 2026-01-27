import { describe, expect, it } from '@effect/vitest';
import type { MockScenario } from '@repo/types';
import { Effect, Layer } from 'effect';
import { Game } from '../Game.js';
import { GameFlow } from '../GameFlow.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';
import { SharedState } from '../SharedState.js';
import { type SocketIOInstance, SocketServer } from '../SocketServer.js';
import { WerewolfVoting } from '../WerewolfVoting.js';

type Emission = {
  room: string;
  event: string;
  payload: unknown[];
};

const makeGameFlowStub = (onFinish?: () => void) => {
  const segment = { type: 'WEREWOLF', skip: false } as const;

  return {
    startGame: Effect.void,
    playSegment: Effect.void,
    getCurrentSegment: Effect.succeed(segment),
    setCurrentSegment: () => Effect.void,
    markSegmentAsSkipped: () => Effect.succeed(segment),
    finishSegment: Effect.sync(() => {
      onFinish?.();
    }),
    loadMockScenario: () => Effect.void,
  };
};

const makeTestLayer = (
  ioStub: SocketIOInstance,
  gameFlowLayer = Layer.succeed(GameFlow, makeGameFlowStub())
) => {

  const configLayer = Layer.succeed(LobbyConfig, { maxPlayers: 6 });
  const lobbyLayer = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(configLayer)
  );
  const gameLayer = Game.DefaultWithoutDependencies.pipe(
    Layer.provide(lobbyLayer)
  );
  const sharedStateLayer = SharedState.Default;
  const socketLayer = Layer.succeed(SocketServer, ioStub);
  const werewolfVotingLayer = WerewolfVoting.DefaultWithoutDependencies.pipe(
    Layer.provide(
      Layer.mergeAll(gameLayer, sharedStateLayer, socketLayer, gameFlowLayer)
    )
  );

  return Layer.mergeAll(
    lobbyLayer,
    gameLayer,
    sharedStateLayer,
    socketLayer,
    gameFlowLayer,
    werewolfVotingLayer
  );
};

describe('WerewolfVoting Service', () => {
  it.effect('stores per-werewolf votes and broadcasts tallies after each vote',
    () => {
      const emissions: Emission[] = [];
      const ioStub: SocketIOInstance = {
        to: (room: string) => ({
          emit: (event: string, ...payload: unknown[]) => {
            emissions.push({ room, event, payload });
          },
        }),
      } as SocketIOInstance;

      return Effect.gen(function* () {
        const lobby = yield* Lobby;
        const game = yield* Game;
        const sharedState = yield* SharedState;
        const werewolfVoting = yield* WerewolfVoting;

        yield* lobby.addPlayer('Wolf One', 'wolf-1');
        yield* lobby.addPlayer('Wolf Two', 'wolf-2');
        yield* lobby.addPlayer('Villager One', 'villager-1');
        yield* lobby.addPlayer('Villager Two', 'villager-2');

        const scenario: MockScenario = {
          segment: 'WEREWOLF',
          index: 2,
          players: [
            { role: 'WEREWOLF' },
            { role: 'WEREWOLF' },
            { role: 'VILLAGER' },
            { role: 'VILLAGER' },
          ],
        };

        yield* game.setPlayers(scenario);

        const expectBroadcast = (expectedTallies: Record<string, number>) => {
          const latest = emissions.slice(-2);
          expect(latest).toHaveLength(2);
          expect(latest.map((entry) => entry.room).sort()).toEqual([
            'wolf-1',
            'wolf-2',
          ]);

          for (const entry of latest) {
            expect(entry.event).toBe('werewolf:current-votes');
            expect(entry.payload[0]).toEqual(expectedTallies);
          }
        };

        yield* werewolfVoting.handleVote('wolf-1', 'villager-1');
        expectBroadcast({ 'villager-1': 1 });

        yield* werewolfVoting.handleVote('wolf-2', 'villager-1');
        expectBroadcast({ 'villager-1': 2 });

        yield* werewolfVoting.handleVoteUpdate(
          'wolf-2',
          'villager-2',
          'villager-1'
        );
        expectBroadcast({ 'villager-1': 1, 'villager-2': 1 });

        const tallies = yield* sharedState.getWerewolfVoteTallies;
        expect(tallies).toEqual({ 'villager-1': 1, 'villager-2': 1 });
      }).pipe(Effect.provide(makeTestLayer(ioStub)));
    }
  );

  it.effect('emits voting-complete once all werewolves agree on a target', () => {
    const emissions: Emission[] = [];
    const ioStub: SocketIOInstance = {
      to: (room: string) => ({
        emit: (event: string, ...payload: unknown[]) => {
          emissions.push({ room, event, payload });
        },
      }),
    } as SocketIOInstance;

    return Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const werewolfVoting = yield* WerewolfVoting;

      yield* lobby.addPlayer('Wolf One', 'wolf-1');
      yield* lobby.addPlayer('Wolf Two', 'wolf-2');
      yield* lobby.addPlayer('Villager One', 'villager-1');
      yield* lobby.addPlayer('Villager Two', 'villager-2');

      const scenario: MockScenario = {
        segment: 'WEREWOLF',
        index: 2,
        players: [
          { role: 'WEREWOLF' },
          { role: 'WEREWOLF' },
          { role: 'VILLAGER' },
          { role: 'VILLAGER' },
        ],
      };

      yield* game.setPlayers(scenario);

      yield* werewolfVoting.handleVote('wolf-1', 'villager-1');
      expect(
        emissions.some((entry) => entry.event === 'werewolf:voting-complete')
      ).toBe(false);

      yield* werewolfVoting.handleVote('wolf-2', 'villager-1');

      const completions = emissions.filter(
        (entry) => entry.event === 'werewolf:voting-complete'
      );
      expect(completions).toHaveLength(2);
      expect(completions.map((entry) => entry.room).sort()).toEqual([
        'wolf-1',
        'wolf-2',
      ]);
    }).pipe(Effect.provide(makeTestLayer(ioStub)));
  });

  it.effect('adds a WEREWOLVES pending death when consensus is reached', () => {
    const ioStub: SocketIOInstance = {
      to: () => ({
        emit: () => {
          // no-op
        },
      }),
    } as SocketIOInstance;

    return Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const sharedState = yield* SharedState;
      const werewolfVoting = yield* WerewolfVoting;

      yield* lobby.addPlayer('Wolf One', 'wolf-1');
      yield* lobby.addPlayer('Wolf Two', 'wolf-2');
      yield* lobby.addPlayer('Villager One', 'villager-1');
      yield* lobby.addPlayer('Villager Two', 'villager-2');

      const scenario: MockScenario = {
        segment: 'WEREWOLF',
        index: 2,
        players: [
          { role: 'WEREWOLF' },
          { role: 'WEREWOLF' },
          { role: 'VILLAGER' },
          { role: 'VILLAGER' },
        ],
      };

      yield* game.setPlayers(scenario);

      yield* werewolfVoting.handleVote('wolf-1', 'villager-1');
      expect(yield* sharedState.listPendingDeaths).toEqual([]);

      yield* werewolfVoting.handleVote('wolf-2', 'villager-1');
      expect(yield* sharedState.listPendingDeaths).toEqual([
        { playerId: 'villager-1', cause: 'WEREWOLVES' },
      ]);

      yield* werewolfVoting.handleVoteUpdate(
        'wolf-2',
        'villager-2',
        'villager-1'
      );
      expect(yield* sharedState.listPendingDeaths).toEqual([
        { playerId: 'villager-2', cause: 'WEREWOLVES' },
      ]);
    }).pipe(Effect.provide(makeTestLayer(ioStub)));
  });

  it.effect('finishes the WEREWOLF segment immediately after consensus', () => {
    const ioStub: SocketIOInstance = {
      to: () => ({
        emit: () => {
          // no-op
        },
      }),
    } as SocketIOInstance;

    let finishCount = 0;
    const gameFlowLayer = Layer.succeed(
      GameFlow,
      makeGameFlowStub(() => {
        finishCount += 1;
      })
    );

    return Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const werewolfVoting = yield* WerewolfVoting;

      yield* lobby.addPlayer('Wolf One', 'wolf-1');
      yield* lobby.addPlayer('Wolf Two', 'wolf-2');
      yield* lobby.addPlayer('Villager One', 'villager-1');
      yield* lobby.addPlayer('Villager Two', 'villager-2');

      const scenario: MockScenario = {
        segment: 'WEREWOLF',
        index: 2,
        players: [
          { role: 'WEREWOLF' },
          { role: 'WEREWOLF' },
          { role: 'VILLAGER' },
          { role: 'VILLAGER' },
        ],
      };

      yield* game.setPlayers(scenario);

      yield* werewolfVoting.handleVote('wolf-1', 'villager-1');
      expect(finishCount).toBe(0);

      yield* werewolfVoting.handleVote('wolf-2', 'villager-1');
      expect(finishCount).toBe(1);
    }).pipe(Effect.provide(makeTestLayer(ioStub, gameFlowLayer)));
  });
});
