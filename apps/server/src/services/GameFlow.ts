import type { Segment, SegmentType } from '@repo/types';
import { Duration, Effect } from 'effect';
import { AudioManager } from './AudioManager.js';
import { SegmentNotFoundError } from './errors.js';
import { Game } from './Game.js';
import { Lobby } from './Lobby.js';
import { MockScenario } from './MockScenario.js';
import { SocketServer } from './SocketServer.js';

export class GameFlow extends Effect.Service<GameFlow>()('GameFlow', {
  effect: Effect.gen(function* () {
    const game = yield* Game;
    const lobby = yield* Lobby;
    const io = yield* SocketServer;
    const audio = yield* AudioManager;
    const mockScenarios = yield* MockScenario;

    const segments: Segment[] = [
      { type: 'CUPID', skip: false },
      { type: 'LOVERS', skip: false },
      { type: 'WEREWOLF', skip: false },
      { type: 'WITCH-HEAL', skip: false },
      { type: 'WITCH-POISON', skip: false },
      { type: 'DAY_VOTE', skip: false },
    ];

    let currentSegmentIndex = 0;

    const startGame = Effect.gen(function* () {
      yield* game.startGame;

      const players = yield* game.getPlayers;
      for (const player of players) {
        yield* Effect.log(`role ${player.role} assigned to ${player.name}`);
        io.to(player.socketId).emit('player:role-assigned', player.role);
      }

      yield* lobby.clear;
      yield* audio.playIntro;
      yield* playSegment;
    });

    const playSegment = Effect.gen(function* () {
      currentSegmentIndex = findNextSegment(segments, currentSegmentIndex);
      const segment = segments[currentSegmentIndex];
      yield* Effect.log(`playing segment ${segment.type}`);
      yield* audio.playSegmentStart(segment.type);
      yield* dispatchSegmentAction(segment.type);
    });

    const advanceToNextSegment = Effect.sync(() => {
      currentSegmentIndex = findNextSegment(segments, currentSegmentIndex + 1);
    });

    const finishSegment = Effect.gen(function* () {
      const segment = segments[currentSegmentIndex];
      yield* audio.playSegmentEnd(segment.type);
      yield* advanceToNextSegment;
      yield* playSegment;
    });

    const loadMockScenario = Effect.fn('loadMockScenario')(function* (
      scenario: 'LOVERS' | 'WEREWOLF'
    ) {
      const mockScenario = mockScenarios[scenario];
      yield* Effect.log(`player mock scenario ${mockScenario.segment}`);
      const lobbyPlayers = yield* lobby.getAllPlayers;
      const mockLovers: string[] = [];
      if (mockScenario.players.length !== lobbyPlayers.length) {
        return new Error(
          `Players count mismatch, scenario requires ${mockScenario.players.length} players, but lobby has ${lobbyPlayers.length} players`
        );
      }

      yield* game.setPlayers(mockScenario);
      const players = yield* game.getPlayers;

      if (mockScenario.loversIndex) {
        for (const idx of mockScenario.loversIndex) {
          const player = players[idx];
          mockLovers.push(player.getSocketId());
        }
        yield* game.setLovers(mockLovers[0], mockLovers[1]);
      }

      for (const player of players) {
        io.to(player.socketId).emit('player:role-assigned', player.role);
      }

      currentSegmentIndex = mockScenario.index;
      yield* playSegment;
    });

    const markSegmentAsSkipped = Effect.fn('markSegmentAsSkipped')(function* (
      segment: SegmentType
    ) {
      const targetSegment = segments.find((s) => s.type === segment);

      if (!targetSegment) {
        return yield* new SegmentNotFoundError({ segment });
      }

      targetSegment.skip = true;
      return targetSegment;
    });

    const dispatchSegmentAction = Effect.fn('dispatchSegmentAction')(function* (
      segment: SegmentType
    ) {
      switch (segment) {
        case 'CUPID':
          yield* promptCupid;
          break;
        case 'LOVERS':
          yield* promptLovers;
          break;
        case 'WEREWOLF':
          yield* promptWerewolves;
          break;
        default:
          return `segment not implemented yet ${segment}`;
      }
    });

    const setCurrentSegment = (segmentIndex: number) =>
      Effect.sync(() => {
        currentSegmentIndex = segmentIndex;
      });

    const getCurrentSegment = Effect.sync(() => segments[currentSegmentIndex]);

    const promptCupid = Effect.gen(function* () {
      const cupid = yield* game.getCupid;
      io.to(cupid.getSocketId()).emit('cupid:pick-required');
      yield* Effect.log('sent socket event to cupid');
    });

    const promptLovers = Effect.gen(function* () {
      yield* Effect.log('inside the prompt lover function');
      const LOVERS_REVEAL_DELAY = 5000;
      const LOVERS_ALERT_DELAY = 6000;

      const lovers = yield* game.getLovers.pipe(
        Effect.tapError((err) => Effect.logError(err))
      );

      yield* Effect.sleep(Duration.millis(LOVERS_REVEAL_DELAY));

      yield* Effect.log('emitting to lovers');
      io.to(lovers[0].getSocketId()).emit(
        'alert:player-is-lover',
        lovers[1].getSocketId()
      );

      io.to(lovers[1].getSocketId()).emit(
        'alert:player-is-lover',
        lovers[0].getSocketId()
      );

      yield* Effect.sleep(Duration.millis(LOVERS_ALERT_DELAY));

      yield* Effect.log('emitting closing alert');
      for (const lover of lovers) {
        io.to(lover.getSocketId()).emit('alert:lovers-can-close-alert');
      }
    });

    const promptWerewolves = Effect.gen(function* () {
      const werewolves = yield* game.getWerewolves;
      for (const wolf of werewolves) {
        io.to(wolf.getSocketId()).emit('werewolf:pick-required');
      }
    });

    return {
      startGame,
      playSegment,
      getCurrentSegment,
      setCurrentSegment,
      markSegmentAsSkipped,
      finishSegment,
      loadMockScenario,
    };
  }),
  dependencies: [
    Game.Default,
    Lobby.Default,
    SocketServer.Default,
    AudioManager.Default,
    MockScenario.Default,
  ],
}) {}

const findNextSegment = (segments: Segment[], currentIndex: number) => {
  const STARTING_INDEX_NONE_FIRST_NIGHT = 2;
  let idx = currentIndex;

  while (idx < segments.length && segments[idx].skip) {
    idx++;
  }

  if (idx >= segments.length) {
    idx = STARTING_INDEX_NONE_FIRST_NIGHT;
    while (idx < segments.length && segments[idx].skip) {
      idx++;
    }
  }

  return idx;
};
