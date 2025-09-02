import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import type { Socket } from 'socket.io';
import type { Game } from '@/core/game';
import { MockScenario } from '@/segments/mock-scenario';
import type { SegmentsManager } from '@/segments/segments-manager';
import type { EventsActions } from '@/server/events-actions';
import type { SocketType } from '@/server/sockets';

const MAX_PLAYERCOUNT = 6;

export class GameEvents {
  private readonly io: SocketType;
  private readonly game: Game;
  private readonly eventsActions: EventsActions;
  private readonly segmentsManager: SegmentsManager;
  private loversAlertClosed = 0;

  constructor(
    game: Game,
    segmentsManager: SegmentsManager,
    io: SocketType,
    eventActions: EventsActions
  ) {
    this.io = io;
    this.eventsActions = eventActions;
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

      // Admin/Dashboard events for testing
      socket.on('admin:start-game', () => {
        console.log('🎮 Admin starting game manually');
        this.game.assignRandomRoles();
        this.game.alertPlayersOfRoles();
        socket.emit('lobby:villagers-list', this.game.getVillagersList());
        this.segmentsManager.startGame();
      });

      socket.on('admin:next-segment', () => {
        console.log('⏭ Admin advancing to next segment');
        this.segmentsManager.finishSegment();
      });

      socket.on('admin:simulate-werewolf-vote', (targetPlayer: string) => {
        console.log(`🐺 Admin simulating werewolf vote for: ${targetPlayer}`);
        const werewolves = this.game.getWerewolves();
        for (const werewolf of werewolves) {
          this.game.handleWerewolfVote(werewolf.getSocketId(), targetPlayer);
        }
        this.segmentsManager.getGameActions().broadcastWerewolfVotes();

        if (this.game.hasAllWerewolvesAgreed()) {
          const victim = this.game.getWerewolfTarget();
          if (!victim) {
            throw new Error('The victim does not exist, this is not normal');
          }
          this.game.addPendingDeath(victim, 'WEREWOLVES');
          this.segmentsManager.finishSegment();
        }
      });

      socket.on('admin:simulate-day-vote', (targetPlayer: string) => {
        console.log(`☀ Admin simulating day vote for: ${targetPlayer}`);
        // For now, just log - day voting will be implemented later
      });

      this.setupGettersEvents(socket);
      this.setupCupidEvents(socket);
      this.setupLoversEvents(socket);
      this.setupWerewolfEvents(socket);
      this.setupWitchEvents(socket);
      this.setupDayVoteEvents(socket);
      this.setupHunterEvents(socket);
      this.setupMockEvents(socket);
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
      console.log('alert received, current count ', this.loversAlertClosed);
      if (this.loversAlertClosed === 2) {
        this.segmentsManager.finishSegment();
      }
    });
  }

  setupWerewolfEvents(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) {
    socket.on('werewolf:player-voted', (targetPlayer: string) => {
      this.eventsActions.handleWerewolfVote(socket.id, targetPlayer);
    });

    socket.on(
      'werewolf:player-update-vote',
      (targetPlayer: string, oldVote: string) => {
        this.game.handleWerewolfUpdateVote(socket.id, targetPlayer, oldVote);
        if (this.game.hasAllWerewolvesAgreed()) {
          this.game.handleAllWerewolvesAgree();
          this.segmentsManager.finishSegment();
        }
      }
    );
  }

  setupWitchEvents(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
    socket.on('witch:healed-player', () => {
      this.game.healWerewolfVictim();
      this.segmentsManager.finishSegment();
    });

    socket.on('witch:poisoned-player', (playerSid: string) => {
      this.game.witchKill(playerSid);
      this.segmentsManager.finishSegment();
    });

    socket.on('witch:skipped-heal', () => {
      console.log('🧙 Witch skipped heal action');
      this.segmentsManager.finishSegment();
    });

    socket.on('witch:skipped-poison', () => {
      console.log('🧙 Witch skipped poison action');
      this.segmentsManager.finishSegment();
    });
  }

  setupDayVoteEvents(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) {
    socket.on('day:player-voted', (targetPlayer: string) => {
      this.eventsActions.handleDayVote(socket.id, targetPlayer);
    });
  }

  setupHunterEvents(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) {
    socket.on('hunter:killed-player', (targetSid: string) => {
      this.eventsActions.handleHunterPlayerPick(targetSid);
    });
  }

  setupMockEvents(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
    socket.on('admin:mock-hunter-event', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runWerewolfKillHunter();
    });

    socket.on('admin:mock-lover-event', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runWerewolfKillLover();
    });

    socket.on('admin:mock-lover-second-hunter-event', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runWerewolfKillLoverSecondIsHunter();
    });

    socket.on('admin:mock-lover-is-hunter-event', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runWerewolfKillLoverWhoIsHunter();
    });

    socket.on('admin:mock-day-vote-hunter-event', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runDayVoteKillHunter();
    });

    socket.on('admin:mock-day-vote-lover-event', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runDayVoteKillLover();
    });

    socket.on('admin:mock-day-vote-lover-is-hunter-event', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runDayVoteKillLoverWhoIsHunter();
    });

    socket.on('admin:mock-day-vote-lover-second-hunter-event', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runDayVoteKillLoverSecondIsHunter();
    });
  }

  cleanup() {
    this.io.removeAllListeners();
    this.loversAlertClosed = 0;
    this.setupSocketHandlers();
  }
}
