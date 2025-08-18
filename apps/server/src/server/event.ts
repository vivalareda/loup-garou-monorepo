import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import type { Socket } from 'socket.io';
import type { Game } from '@/core/game';
import type { SegmentsManager } from '@/segments/segments-manager';
import type { SocketType } from '@/server/sockets';

const MAX_PLAYERCOUNT = 6;

export class GameEvents {
  private readonly io: SocketType;
  private readonly game: Game;
  private readonly segmentsManager: SegmentsManager;

  constructor(game: Game, segmentsManager: SegmentsManager, io: SocketType) {
    this.io = io;
    this.game = game;
    this.segmentsManager = segmentsManager;
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      socket.on('player:join', (name: string) => {
        const player = this.game.addPlayer(name, socket.id);
        socket.emit('lobby:player-data', player.getWaitingRoomData());
        socket.broadcast.emit('lobby:update-players-list', player.getName());
        console.log(
          `Player joined: ${name} (ID: ${socket.id}), player count: ${this.game.getPlayerList()}`
        );

        if (this.game.getPlayerList().size >= MAX_PLAYERCOUNT) {
          this.game.assignRoles();
          this.game.alertPlayersOfRoles();
          this.segmentsManager.firstNightSegment();
        }
      });

      socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
      });

      this.setupGettersEvents(socket);
      this.setupCupidEvents(socket);
    });
  }

  setupGettersEvents(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) {
    socket.on('lobby:get-players-list', () => {
      const playersArray = Array.from(this.game.getPlayerList().values()).map(
        (player) => player.name
      );
      socket.emit('lobby:players-list', playersArray);
    });
  }

  setupCupidEvents(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
    socket.on('cupid:lovers-pick', (selectedPlayers: string[]) => {
      this.game.setLovers(selectedPlayers);
      this.segmentsManager.finishSegment();
    });
  }

  setupLoversEvents(socket: Socket) {
    socket.on('lover-alert-closed', () => {
      // this.loversAlertClosed++;
      // if (this.loversAlertClosed === 2) {
      //   this.segmentsManager.finishSegment();
      // }
    });
  }
}
