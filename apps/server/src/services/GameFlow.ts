import type { Segment, SegmentType } from '@repo/types';
import { Effect } from 'effect';
import { AudioManager } from './AudioManager.js';
import { Game } from './Game.js';
import { Lobby } from './Lobby.js';
import { SocketServer } from './SocketServer.js';

export class GameFlow extends Effect.Service<GameFlow>()(
  'GameFlow',
  {
    effect: Effect.gen(function* () {
      const game = yield* Game;
      const lobby = yield* Lobby;
      const io = yield* SocketServer;
      const audio = yield* AudioManager;

      const currentSegmentIndex = 0;

      const segments: Segment[] = [
        { type: 'CUPID', skip: false },
        { type: 'LOVERS', skip: false },
        { type: 'WEREWOLF', skip: false },
        { type: 'WITCH-HEAL', skip: false },
        { type: 'WITCH-POISON', skip: false },
        { type: 'DAY_VOTE', skip: false },
      ];

      const startGame = Effect.gen(function* () {
        yield* game.startGame;

        const players = yield* game.getPlayers;
        for (const player of players) {
          yield* Effect.log(
            `role ${player.role} assigned to ${player.name}`
          );
          io.to(player.socketId).emit(
            'player:role-assigned',
            player.role
          );
        }

        yield* lobby.clear;
        yield* audio.playIntro;
        yield* playSegment;
      });

      const playSegment = Effect.gen(function* () {
        const idx = findNextSegment(segments, currentSegmentIndex);
        const segment = segments[idx];
        yield* Effect.log(`playing segment ${segment.type}`)
        yield* audio.playSegmentStart(segment.type);
        yield* dispatchSegmentAction(segment.type)
      });

      const dispatchSegmentAction = Effect.fn('dispatchSegmentAction')(function* (
        segment: SegmentType
      ) {
        switch (segment) {
          case 'CUPID':
            yield* promptCupid;
            break;
          case 'WEREWOLF':
            yield* promptWerewolves;
            break;
        }
      });

      const getCurrentSegment = Effect.sync(() => segments[currentSegmentIndex])

      const promptCupid = Effect.gen(function* () {
        const cupid = yield* game.getCupid
        io.to(cupid.getSocketId()).emit('cupid:pick-required');
        yield* Effect.log("sent socket event to cupid");
      })

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
      };
    }),
    dependencies: [
      Game.Default,
      Lobby.Default,
      SocketServer.Default,
      AudioManager.Default,
    ],
  }
) { }

const findNextSegment = (segments: Segment[], currentIndex: number) => {
  let idx = currentIndex;

  while (idx < segments.length && segments[idx].skip) {
    idx++;
  }

  if (idx >= segments.length) {
    idx = 2;
    while (idx < segments.length && segments[idx].skip) {
      idx++;
    }
  }

  return idx;
};

