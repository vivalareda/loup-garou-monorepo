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
  private loversAlertClosed = 0;

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
        socket.broadcast.emit(
          'lobby:update-players-list',
          player.getPlayerForClient()
        );
        console.log(
          `Player joined: ${name} (ID: ${socket.id}), player count: ${this.game.getPlayerList()}`
        );

        if (this.game.getPlayerList().size >= MAX_PLAYERCOUNT) {
          this.game.assignRoles();
          this.game.alertPlayersOfRoles();
          socket.emit('lobby:villagers-list', this.game.getVillagersList());
          this.segmentsManager.startGame();
        }
      });

      socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
      });

      this.setupGettersEvents(socket);
      this.setupCupidEvents(socket);
      this.setupLoversEvents(socket);
      this.setupWerewolfEvents(socket);
    });
  }

  setupGettersEvents(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) {
    socket.on('lobby:get-players-list', () => {
      const playersArray = this.game.getClientPlayerList();
      socket.emit('lobby:players-list', playersArray);
    });
  }

  setupCupidEvents(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
    socket.on('cupid:lovers-pick', (selectedPlayers: string[]) => {
      this.game.setLovers(selectedPlayers);
      this.segmentsManager.finishSegment();
    });
  }

  setupLoversEvents(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) {
    socket.on('alert:lover-closed-alert', () => {
      this.loversAlertClosed++;
      if (this.loversAlertClosed === 2) {
        this.segmentsManager.finishSegment();
      }
    });
  }

  setupWerewolfEvents(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) {
    socket.on('werewolf:player-voted', (targetPlayer: string) => {
      this.game.handleWerewolfVote(socket.id, targetPlayer);
      if (this.game.hasAllWerewolvesVoted()) {
        this.segmentsManager.finishSegment();
      }
    });

    socket.on(
      'werewolf:player-update-vote',
      (targetPlayer: string, oldVote: string) => {
        this.game.handleWerewolfUpdateVote(socket.id, targetPlayer, oldVote);
        if (this.game.hasAllWerewolvesVoted()) {
          this.segmentsManager.finishSegment();
        }
      }
    );
  }

  cleanup() {
    this.io.removeAllListeners();
    this.loversAlertClosed = 0;
    this.setupSocketHandlers();
  }
}
