import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import { Effect, Runtime } from 'effect';
import type { Socket } from 'socket.io';
import { MockScenario } from '@/segments/mock-scenario';
import { GameState } from './game-service.effect';
import * as Handlers from './event-handlers.effect';

/**
 * Setup all socket event handlers for a connected socket
 * This creates a layer-aware runtime for executing handlers
 */
export const setupSocketEventHandlers = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents>
) =>
  Effect.gen(function* () {
    const gameState = yield* GameState;
    const { game, segmentsManager, eventsActions } = gameState;

    // Create a runtime with the GameState context
    const runtime = yield* Effect.runtime<GameState>();

    // Helper to run effect in background with context
    const runHandler = (effect: Effect.Effect<void, never, GameState>) => {
      Runtime.runPromise(runtime)(effect).catch((error: unknown) => {
        console.error('Error in socket handler:', error);
      });
    };

    // Player events
    socket.on('player:join', (name: string) => {
      runHandler(Handlers.handlePlayerJoin(socket, name));
    });

    socket.on('disconnect', () => {
      runHandler(Handlers.handlePlayerDisconnect(socket));
    });

    // Admin events
    socket.on('admin:start-game', () => {
      runHandler(Handlers.handleAdminStartGame(socket));
    });

    socket.on('admin:next-segment', () => {
      runHandler(Handlers.handleAdminNextSegment());
    });

    socket.on('admin:simulate-werewolf-vote', (targetPlayer: string) => {
      runHandler(Handlers.handleAdminSimulateWerewolfVote(targetPlayer));
    });

    socket.on('admin:simulate-day-vote', (targetPlayer: string) => {
      Effect.sync(() => {
        console.log(`☀ Admin simulating day vote for: ${targetPlayer}`);
        // For now, just log - day voting will be implemented later
      }).pipe(Effect.runPromise);
    });

    // Lobby events
    socket.on('lobby:get-players-list', () => {
      runHandler(Handlers.handleGetPlayersList(socket));
    });

    // Cupid events
    socket.on('cupid:lovers-pick', (selectedPlayers: string[]) => {
      runHandler(Handlers.handleCupidLoversPick(selectedPlayers));
    });

    // Lovers events
    socket.on('alert:lover-closed-alert', () => {
      runHandler(Handlers.handleLoverClosedAlert());
    });

    // Werewolf events
    socket.on('werewolf:player-voted', (targetPlayer: string) => {
      runHandler(Handlers.handleWerewolfVote(socket.id, targetPlayer));
    });

    socket.on(
      'werewolf:player-update-vote',
      (targetPlayer: string, oldVote: string) => {
        runHandler(
          Handlers.handleWerewolfUpdateVote(socket.id, targetPlayer, oldVote)
        );
      }
    );

    // Witch events
    socket.on('witch:healed-player', () => {
      runHandler(Handlers.handleWitchHealedPlayer());
    });

    socket.on('witch:poisoned-player', (playerSid: string) => {
      runHandler(Handlers.handleWitchPoisonedPlayer(playerSid));
    });

    socket.on('witch:skipped-heal', () => {
      runHandler(Handlers.handleWitchSkippedHeal());
    });

    socket.on('witch:skipped-poison', () => {
      runHandler(Handlers.handleWitchSkippedPoison());
    });

    // Day vote events
    socket.on('day:player-voted', (targetPlayer: string) => {
      runHandler(Handlers.handleDayVote(socket.id, targetPlayer));
    });

    // Hunter events
    socket.on('hunter:killed-player', (targetSid: string) => {
      runHandler(Handlers.handleHunterKilledPlayer(targetSid));
    });

    // Mock scenario events
    socket.on('admin:mock-hunter-event', () => {
      Effect.sync(() => {
        const mockScenario = new MockScenario(
          game,
          segmentsManager,
          game['io'],
          eventsActions
        );
        mockScenario.runWerewolfKillHunter();
      }).pipe(Effect.runPromise);
    });

    socket.on('admin:mock-lover-event', () => {
      Effect.sync(() => {
        const mockScenario = new MockScenario(
          game,
          segmentsManager,
          game['io'],
          eventsActions
        );
        mockScenario.runWerewolfKillLover();
      }).pipe(Effect.runPromise);
    });

    socket.on('admin:mock-lover-second-hunter-event', () => {
      Effect.sync(() => {
        const mockScenario = new MockScenario(
          game,
          segmentsManager,
          game['io'],
          eventsActions
        );
        mockScenario.runWerewolfKillLoverSecondIsHunter();
      }).pipe(Effect.runPromise);
    });

    socket.on('admin:mock-lover-is-hunter-event', () => {
      Effect.sync(() => {
        const mockScenario = new MockScenario(
          game,
          segmentsManager,
          game['io'],
          eventsActions
        );
        mockScenario.runWerewolfKillLoverWhoIsHunter();
      }).pipe(Effect.runPromise);
    });

    socket.on('admin:mock-day-vote-hunter-event', () => {
      Effect.sync(() => {
        const mockScenario = new MockScenario(
          game,
          segmentsManager,
          game['io'],
          eventsActions
        );
        mockScenario.runDayVoteKillHunter();
      }).pipe(Effect.runPromise);
    });

    socket.on('admin:mock-day-vote-lover-event', () => {
      Effect.sync(() => {
        const mockScenario = new MockScenario(
          game,
          segmentsManager,
          game['io'],
          eventsActions
        );
        mockScenario.runDayVoteKillLover();
      }).pipe(Effect.runPromise);
    });

    socket.on('admin:mock-day-vote-lover-is-hunter-event', () => {
      Effect.sync(() => {
        const mockScenario = new MockScenario(
          game,
          segmentsManager,
          game['io'],
          eventsActions
        );
        mockScenario.runDayVoteKillLoverWhoIsHunter();
      }).pipe(Effect.runPromise);
    });

    socket.on('admin:mock-day-vote-lover-second-hunter-event', () => {
      Effect.sync(() => {
        const mockScenario = new MockScenario(
          game,
          segmentsManager,
          game['io'],
          eventsActions
        );
        mockScenario.runDayVoteKillLoverSecondIsHunter();
      }).pipe(Effect.runPromise);
    });

    socket.on('admin:mock-hunter-revenge-kills-lover', () => {
      Effect.sync(() => {
        const mockScenario = new MockScenario(
          game,
          segmentsManager,
          game['io'],
          eventsActions
        );
        mockScenario.runHunterRevengeKillsLover();
      }).pipe(Effect.runPromise);
    });
  });

/**
 * Cleanup all socket event handlers
 */
export const cleanupSocketHandlers = Effect.gen(function* () {
  const { game } = yield* GameState;

  yield* Effect.sync(() => {
    game['io'].removeAllListeners();
  });
});
