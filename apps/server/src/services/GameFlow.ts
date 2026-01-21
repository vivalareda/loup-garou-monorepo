import { Effect } from 'effect';
import { AudioManager } from './AudioManager.js';
import { Game } from './Game.js';
import { Lobby } from './Lobby.js';
import { SocketServer } from './SocketServer.js';

export class GameFlow extends Effect.Service<GameFlow>()('GameFlow', {
  effect: Effect.gen(function* () {
    const game = yield* Game;
    const lobby = yield* Lobby;
    const io = yield* SocketServer;
    const audio = yield* AudioManager;

    const segments: SegmentState[] = [
      { type: 'CUPID', skip: false },
      { type: 'LOVERS_REVEAL', skip: false },
      { type: 'WEREWOLF', skip: false },
      { type: 'WITCH', skip: false },
      { type: 'SEER', skip: false },
      { type: 'DAY_VOTE', skip: false },
    ];

    return {
      startGame: Effect.gen(function* () {
        yield* game.startGame;

        const players = yield* game.getPlayers;
        for (const player of players) {
          io.to(player.socketId).emit('player:role-assigned', player.role);
        }

        yield* lobby.clear;

        yield* audio.playIntro();
      }),
    };
  }),
  dependencies: [
    Game.Default,
    Lobby.Default,
    SocketServer.Default,
    AudioManager.Default,
  ],
}) { }
