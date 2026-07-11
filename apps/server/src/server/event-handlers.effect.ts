import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import { Effect } from 'effect';
import type { Socket } from 'socket.io';
import { GameState, incrementLoversAlertCount } from './game-service.effect';
import { broadcastFrom } from './socket-io.effect';

const MAX_PLAYERCOUNT = 6;

/**
 * Handle player join event
 */
export const handlePlayerJoin = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  name: string
) =>
  Effect.gen(function* () {
    const { game, segmentsManager } = yield* GameState;

    const player = game.addPlayer(name, socket.id);

    yield* Effect.sync(() => {
      socket.emit('lobby:player-data', player.getWaitingRoomData());
    });

    yield* broadcastFrom(
      socket,
      'lobby:update-players-list',
      player.getPlayerForClient()
    );

    yield* Effect.sync(() => {
      console.log(
        `Player joined: ${name} (ID: ${socket.id}), player count: ${game.getPlayerList().size}`
      );
    });

    if (game.getPlayerList().size >= MAX_PLAYERCOUNT) {
      yield* Effect.sync(() => {
        game.assignRoles();
        game.alertPlayersOfRoles();
        socket.emit('lobby:villagers-list', game.getVillagersList());
        segmentsManager.startGame();
      });
    }
  });

/**
 * Handle player disconnect event
 */
export const handlePlayerDisconnect = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents>
) =>
  Effect.sync(() => {
    console.log('Player disconnected:', socket.id);
  });

/**
 * Handle admin start game event
 */
export const handleAdminStartGame = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents>
) =>
  Effect.gen(function* () {
    const { game, segmentsManager } = yield* GameState;

    yield* Effect.sync(() => {
      console.log('🎮 Admin starting game manually');
      game.assignRandomRoles();
      game.alertPlayersOfRoles();
      socket.emit('lobby:villagers-list', game.getVillagersList());
      segmentsManager.startGame();
    });
  });

/**
 * Handle admin next segment event
 */
export const handleAdminNextSegment = () =>
  Effect.gen(function* () {
    const { segmentsManager } = yield* GameState;

    yield* Effect.sync(() => {
      console.log('⏭ Admin advancing to next segment');
      segmentsManager.finishSegment();
    });
  });

/**
 * Handle Cupid lovers pick event
 */
export const handleCupidLoversPick = (selectedPlayers: string[]) =>
  Effect.gen(function* () {
    const { game, segmentsManager } = yield* GameState;

    yield* Effect.sync(() => {
      game.setLovers(selectedPlayers);
      segmentsManager.finishSegment();
    });
  });

/**
 * Handle lover closed alert event
 */
export const handleLoverClosedAlert = () =>
  Effect.gen(function* () {
    const { segmentsManager } = yield* GameState;
    const count = yield* incrementLoversAlertCount;

    yield* Effect.sync(() => {
      console.log('alert received, current count ', count);
    });

    if (count === 2) {
      yield* Effect.sync(() => {
        segmentsManager.finishSegment();
      });
    }
  });

/**
 * Handle werewolf vote event
 */
export const handleWerewolfVote = (werewolfSid: string, targetPlayer: string) =>
  Effect.gen(function* () {
    const { eventsActions } = yield* GameState;

    yield* Effect.sync(() => {
      eventsActions.handleWerewolfVote(werewolfSid, targetPlayer);
    });
  });

/**
 * Handle werewolf update vote event
 */
export const handleWerewolfUpdateVote = (
  werewolfSid: string,
  targetPlayer: string,
  oldVote: string
) =>
  Effect.gen(function* () {
    const { game, segmentsManager } = yield* GameState;

    yield* Effect.sync(() => {
      game.handleWerewolfUpdateVote(werewolfSid, targetPlayer, oldVote);
      if (game.hasAllWerewolvesAgreed()) {
        game.handleAllWerewolvesAgree();
        segmentsManager.finishSegment();
      }
    });
  });

/**
 * Handle witch healed player event
 */
export const handleWitchHealedPlayer = () =>
  Effect.gen(function* () {
    const { game, segmentsManager } = yield* GameState;

    yield* Effect.sync(() => {
      game.healWerewolfVictim();
      segmentsManager.finishSegment();
    });
  });

/**
 * Handle witch poisoned player event
 */
export const handleWitchPoisonedPlayer = (playerSid: string) =>
  Effect.gen(function* () {
    const { game, segmentsManager } = yield* GameState;

    yield* Effect.sync(() => {
      game.witchKill(playerSid);
      segmentsManager.finishSegment();
    });
  });

/**
 * Handle witch skipped heal event
 */
export const handleWitchSkippedHeal = () =>
  Effect.gen(function* () {
    const { segmentsManager } = yield* GameState;

    yield* Effect.sync(() => {
      console.log('🧙 Witch skipped heal action');
      segmentsManager.finishSegment();
    });
  });

/**
 * Handle witch skipped poison event
 */
export const handleWitchSkippedPoison = () =>
  Effect.gen(function* () {
    const { segmentsManager } = yield* GameState;

    yield* Effect.sync(() => {
      console.log('🧙 Witch skipped poison action');
      segmentsManager.finishSegment();
    });
  });

/**
 * Handle day vote event
 */
export const handleDayVote = (voterSid: string, targetPlayer: string) =>
  Effect.gen(function* () {
    const { eventsActions } = yield* GameState;

    yield* Effect.promise(() =>
      eventsActions.handleDayVote(voterSid, targetPlayer)
    );
  });

/**
 * Handle hunter killed player event
 */
export const handleHunterKilledPlayer = (targetSid: string) =>
  Effect.gen(function* () {
    const { eventsActions } = yield* GameState;

    yield* Effect.sync(() =>
      eventsActions.submitHunterPick(targetSid)
    );
  });

/**
 * Handle get players list event
 */
export const handleGetPlayersList = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents>
) =>
  Effect.gen(function* () {
    const { game } = yield* GameState;

    yield* Effect.sync(() => {
      const playersArray = game.getClientPlayerList();
      socket.emit('lobby:players-list', playersArray);
    });
  });

/**
 * Handle admin simulate werewolf vote
 */
export const handleAdminSimulateWerewolfVote = (targetPlayer: string) =>
  Effect.gen(function* () {
    const { game, segmentsManager } = yield* GameState;

    yield* Effect.sync(() => {
      console.log(`🐺 Admin simulating werewolf vote for: ${targetPlayer}`);
      const werewolves = game.getWerewolves();
      for (const werewolf of werewolves) {
        game.handleWerewolfVote(werewolf.getSocketId(), targetPlayer);
      }
      segmentsManager.getGameActions().broadcastWerewolfVotes();

      if (game.hasAllWerewolvesAgreed()) {
        const victim = game.getWerewolfTarget();
        if (!victim) {
          throw new Error('The victim does not exist, this is not normal');
        }
        game.addPendingDeath(victim, 'WEREWOLVES');
        segmentsManager.finishSegment();
      }
    });
  });
