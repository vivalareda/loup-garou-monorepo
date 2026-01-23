import type { Segment, SegmentType } from '@repo/types';
import { Duration, Effect } from 'effect';
import { AudioManager } from './AudioManager.js';
import { SegmentNotFoundError } from './errors.js';
import { Game } from './Game.js';
import { Lobby } from './Lobby.js';
import { SocketServer } from './SocketServer.js';

export class GameFlow extends Effect.Service<GameFlow>()('GameFlow', {
  effect: Effect.gen(function* () {
    const game = yield* Game;
    const lobby = yield* Lobby;
    const io = yield* SocketServer;
    const audio = yield* AudioManager;

    const segments: Segment[] = [
      { type: 'CUPID', skip: false, isFirstNight: true },
      { type: 'LOVERS', skip: false, isFirstNight: true },
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

    const getCurrentSegment = Effect.sync(() => segments[currentSegmentIndex]);

    const promptCupid = Effect.gen(function* () {
      const cupid = yield* game.getCupid;
      io.to(cupid.getSocketId()).emit('cupid:pick-required');
      yield* Effect.log('sent socket event to cupid');
    });

    const promptLovers = Effect.gen(function* () {
      const LOVERS_AUDIO_DURATION_MS = 21_000;

      const lovers = yield* game.getLovers.pipe(
        Effect.tapError((err) => Effect.logError(err))
      );

      io.to(lovers[0].getSocketId()).emit(
        'alert:player-is-lover',
        lovers[1].getSocketId()
      );

      io.to(lovers[1].getSocketId()).emit(
        'alert:player-is-lover',
        lovers[0].getSocketId()
      );

      yield* Effect.sleep(Duration.millis(LOVERS_AUDIO_DURATION_MS));
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
      markSegmentAsSkipped,
      finishSegment,
    };
  }),
  dependencies: [
    Game.Default,
    Lobby.Default,
    SocketServer.Default,
    AudioManager.Default,
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
