import type { DeathCause, DeathInfo, PendingDeath, Role } from '@repo/types';
import { Effect } from 'effect';
import { Player } from '@/core/player.js';
import {
  InvalidVoteError,
  NoTargetError,
  PlayerNotFoundError,
  SpecialPlayerNotFoundError,
  TieVoteError,
} from './errors.js';
import { Lobby } from './Lobby.js';
import { initRolesList } from './role-assignment.js';
import {
  calculateTallies,
  checkForTie,
  getWerewolfTarget as getWerewolfTargetPure,
  getWinningTarget,
  hasAllVoted,
  hasAllWerewolvesAgreed as hasAllWerewolvesAgreedPure,
} from './vote-tallying.js';
import { checkWinner as checkWinnerPure } from './win-conditions.js';

export class Game extends Effect.Service<Game>()('@app/Game', {
  effect: Effect.gen(function* () {
    const lobby = yield* Lobby;
    const players = new Map<string, Player>();
    const specialRolePlayers = new Map<Role, Player>();
    let lovers: [Player, Player] | null = null;
    const werewolfVotes = new Map<string, string>(); // voterSid → targetSid
    const dayVotes = new Map<string, string>(); // voterSid → targetSid
    const pendingDeaths = new Map<string, PendingDeath>();
    let witchHasHealPotion = true;
    let witchHasPoisonPotion = true;

    const setSpecialRolePlayer = (player: Player, role: Role) => {
      if (role !== 'WEREWOLF' && role !== 'VILLAGER') {
        specialRolePlayers.set(role, player);
      }
    };

    const getPartnerForPlayer = (player: Player) => {
      if (!lovers) {
        return null;
      }
      if (lovers[0] === player) {
        return lovers[1];
      }
      if (lovers[1] === player) {
        return lovers[0];
      }
      return null;
    };

    const isPlayerLover = (player: Player) => lovers?.includes(player) ?? false;

    const getPlayerOrFail = (socketId: string) =>
      Effect.gen(function* () {
        return (
          players.get(socketId) ??
          (yield* Effect.fail(new PlayerNotFoundError({ socketId })))
        );
      });

    const createDeathInfo = (pendingDeath: PendingDeath, player: Player) => {
      const baseInfo = {
        playerId: pendingDeath.playerId,
        playerName: player.getName(),
        cause: pendingDeath.cause,
        timestamp: new Date(),
      };

      if (pendingDeath.metadata) {
        return {
          ...baseInfo,
          metadata: pendingDeath.metadata,
        } satisfies DeathInfo;
      }

      return baseInfo satisfies DeathInfo;
    };

    const enqueuePartnerSuicide = (
      pendingDeath: PendingDeath,
      player: Player
    ) => {
      if (pendingDeath.cause === 'PARTNER_SUICIDE') {
        return;
      }

      const partner = getPartnerForPlayer(player);
      if (!partner?.isAlive) {
        return;
      }

      if (!pendingDeaths.has(partner.getSocketId())) {
        pendingDeaths.set(partner.getSocketId(), {
          playerId: partner.getSocketId(),
          cause: 'PARTNER_SUICIDE',
          metadata: { loverId: pendingDeath.playerId },
        });
      }
    };

    return {
      /**
       * Initializes the game by creating Player instances from lobby players and assigning roles.
       * @returns Effect that completes when the game is initialized.
       * @dependencies Depends on Lobby service to retrieve all lobby players.
       */
      startGame: Effect.gen(function* () {
        const lobbyPlayers = yield* lobby.getAllPlayers;
        const roles = initRolesList(lobbyPlayers.length);

        lobbyPlayers.map((lp, index) => {
          const role = roles[index];
          const player = new Player(lp.name, lp.sid, role);
          players.set(player.getSocketId(), player);
          setSpecialRolePlayer(player, role);
          return player;
        });
      }),

      /**
       * Retrieves all players currently in the game.
       * @returns Effect containing an array of all Player instances.
       */
      getPlayers: Effect.sync(() => Array.from(players.values())),

      /**
       * Retrieves a simplified list of player identities for client consumption.
       * @returns Effect containing an array of PlayerIdentity objects with non-sensitive player information.
       */
      getClientPlayerList: Effect.sync(() =>
        Array.from(players.values()).map((player) => player.getIdentity())
      ),

      /**
       * Checks if the game has a winner based on current game state.
       * @returns Effect containing the winner ('villagers' or 'werewolves') or null if the game continues.
       * @dependencies Depends on internal vote-tallying and win-conditions pure functions.
       */
      checkWinner: Effect.sync(() => {
        const alivePlayers = Array.from(players.values()).filter(
          (player) => player.isAlive
        );
        const aliveWerewolves = alivePlayers.filter(
          (player) => player.getRole() === 'WEREWOLF'
        ).length;
        const aliveVillagers = alivePlayers.filter(
          (player) => player.getRole() !== 'WEREWOLF'
        ).length;
        const witchHasPotions = [witchHasHealPotion, witchHasPoisonPotion].some(
          Boolean
        );

        return checkWinnerPure(
          aliveWerewolves,
          aliveVillagers,
          witchHasPotions
        );
      }),

      /**
       * Retrieves the player with a specific special role.
       * @param role - The special role to find (e.g., 'HUNTER', 'WITCH', 'CUPID').
       * @returns Effect containing the Player with the specified role.
       * @throws SpecialPlayerNotFoundError - If no player has the specified role.
       */
      getSpecialRolePlayer: (role: Role) =>
        Effect.gen(function* () {
          return (
            specialRolePlayers.get(role) ??
            (yield* Effect.fail(new SpecialPlayerNotFoundError({ role })))
          );
        }),

      /**
       * Retrieves a player by their socket ID.
       * @param socketId - The socket ID of the player to find.
       * @returns Effect containing the Player with the specified socket ID.
       * @throws PlayerNotFoundError - If no player with the given socket ID exists.
       */
      getPlayerBySocketId: (socketId: string) =>
        Effect.gen(function* () {
          return (
            players.get(socketId) ??
            (yield* Effect.fail(new PlayerNotFoundError({ socketId })))
          );
        }),

      /**
       * Sets two players as lovers in the game.
       * @param firstSid - The socket ID of the first lover.
       * @param secondSid - The socket ID of the second lover.
       * @returns Effect that completes when the lovers are set.
       * @throws PlayerNotFoundError - If either socket ID does not correspond to an existing player.
       */
      setLovers: (firstSid: string, secondSid: string) =>
        Effect.gen(function* () {
          const first = players.get(firstSid);
          const second = players.get(secondSid);
          if (!(first && second)) {
            return yield* Effect.fail(
              new PlayerNotFoundError({
                socketId: first ? secondSid : firstSid,
              })
            );
          }
          lovers = [first, second];
        }),

      /**
       * Retrieves the partner of a player if they are lovers.
       * @param socketId - The socket ID of the player.
       * @returns Effect containing the partner Player or null if the player is not a lover or player not found.
       */
      getPartner: (socketId: string) =>
        Effect.sync(() => {
          if (!lovers) {
            return null;
          }
          const player = players.get(socketId);
          if (!player) {
            return null;
          }
          if (lovers[0] === player) {
            return lovers[1];
          }
          if (lovers[1] === player) {
            return lovers[0];
          }
          return null;
        }),

      /**
       * Checks if a player is one of the lovers.
       * @param socketId - The socket ID of the player to check.
       * @returns Effect containing true if the player is a lover, false otherwise.
       */
      isPlayerLover: (socketId: string) =>
        Effect.sync(() => {
          if (!lovers) {
            return false;
          }
          const player = players.get(socketId);
          if (!player) {
            return false;
          }
          return lovers[0] === player || lovers[1] === player;
        }),

      /**
       * Checks if either lover is a hunter.
       * @returns Effect containing true if at least one lover is a hunter, false otherwise.
       */
      isAnyLoverHunter: () =>
        Effect.sync(
          () => lovers?.some((p) => p.getRole() === 'HUNTER') ?? false
        ),

      /**
       * Retrieves the current lovers pair.
       * @returns Effect containing the pair of lovers as [Player, Player] or null if no lovers are set.
       */
      getLovers: () => Effect.sync(() => lovers),

      /**
       * Adds a player to the pending death queue.
       * @param socketId - The socket ID of the player to mark for death.
       * @param cause - The cause of death (e.g., 'WEREWOLVES', 'WITCH_POISON', 'DAY_VOTE').
       * @returns Effect that completes when the death is added to the queue.
       * @throws PlayerNotFoundError - If the player with the given socket ID does not exist.
       */
      addPendingDeath: (socketId: string, cause: DeathCause) =>
        Effect.gen(function* () {
          const player = players.get(socketId);
          if (!player) {
            return yield* Effect.fail(new PlayerNotFoundError({ socketId }));
          }

          const pendingDeath: PendingDeath = {
            playerId: socketId,
            cause,
          };

          pendingDeaths.set(socketId, pendingDeath);
        }),

      /**
       * Checks if a player is in the pending death queue.
       * @param socketId - The socket ID of the player to check.
       * @returns Effect containing true if the player is in the death queue, false otherwise.
       */
      isInDeathQueue: (socketId: string) =>
        Effect.sync(() => pendingDeaths.has(socketId)),

      /**
       * Checks if the hunter is in the pending death queue.
       * @returns Effect containing true if the hunter is in the death queue, false otherwise.
       */
      hunterIsInDeathQueue: Effect.sync(() => {
        const hunter = specialRolePlayers.get('HUNTER');
        if (!hunter) {
          return false;
        }
        return pendingDeaths.has(hunter.getSocketId());
      }),

      /**
       * Marks a player as dead and handles witch potion loss if applicable.
       * @param socketId - The socket ID of the player to kill.
       * @returns Effect that completes when the player is marked as dead.
       * @throws PlayerNotFoundError - If the player with the given socket ID does not exist.
       */
      killPlayer: (socketId: string) =>
        Effect.gen(function* () {
          const player = players.get(socketId);
          if (!player) {
            return yield* Effect.fail(new PlayerNotFoundError({ socketId }));
          }
          player.setIsAlive(false);
          if (player.getRole() === 'WITCH') {
            witchHasHealPotion = false;
            witchHasPoisonPotion = false;
          }
        }),

      /**
       * Checks if the witch can use the heal potion.
       * @returns Effect containing true if the witch has a heal potion, false otherwise.
       */
      canWitchHeal: Effect.sync(() => witchHasHealPotion),

      /**
       * Checks if the witch can use the poison potion.
       * @returns Effect containing true if the witch has a poison potion, false otherwise.
       */
      canWitchPoison: Effect.sync(() => witchHasPoisonPotion),

      /**
       * Uses the witch's heal potion to remove werewolf-caused deaths from the death queue.
       * @returns Effect that completes when the heal potion is used (no effect if potion unavailable).
       * @dependencies Consumes the heal potion if available.
       */
      witchHeal: Effect.sync(() => {
        if (!witchHasHealPotion) {
          return;
        }
        for (const [playerId, pendingDeath] of pendingDeaths.entries()) {
          if (pendingDeath.cause === 'WEREWOLVES') {
            pendingDeaths.delete(playerId);
          }
        }
        witchHasHealPotion = false;
      }),

      /**
       * Uses the witch's poison potion to add a player to the death queue.
       * @param socketId - The socket ID of the player to poison.
       * @returns Effect that completes when the poison potion is used (no effect if potion unavailable).
       * @throws PlayerNotFoundError - If the player with the given socket ID does not exist.
       * @dependencies Consumes the poison potion if available.
       */
      witchPoison: (socketId: string) =>
        Effect.gen(function* () {
          if (!witchHasPoisonPotion) {
            return;
          }
          yield* getPlayerOrFail(socketId);
          pendingDeaths.set(socketId, {
            playerId: socketId,
            cause: 'WITCH_POISON',
          });
          witchHasPoisonPotion = false;
        }),

      /**
       * Processes all pending deaths, handling lover suicide mechanics and returning death information.
       * @returns Effect containing an array of DeathInfo objects for all processed deaths.
       * @dependencies Handles lover suicide by adding partners to the death queue.
       */
      processPendingDeaths: Effect.gen(function* () {
        const initialDeaths = Array.from(pendingDeaths.values());

        for (const pendingDeath of initialDeaths) {
          const player = yield* getPlayerOrFail(pendingDeath.playerId);

          if (isPlayerLover(player)) {
            enqueuePartnerSuicide(pendingDeath, player);
          }
        }

        const allDeaths = Array.from(pendingDeaths.values());
        const deathInfos: DeathInfo[] = [];

        for (const pendingDeath of allDeaths) {
          const player = yield* getPlayerOrFail(pendingDeath.playerId);
          deathInfos.push(createDeathInfo(pendingDeath, player));
          player.setIsAlive(false);
          if (player.getRole() === 'WITCH') {
            witchHasHealPotion = false;
            witchHasPoisonPotion = false;
          }
          pendingDeaths.delete(pendingDeath.playerId);
        }

        return deathInfos;
      }),

      /**
       * Records a werewolf's vote during the werewolf phase.
       * @param voterSid - The socket ID of the voting werewolf.
       * @param targetSid - The socket ID of the target player.
       * @returns Effect that completes when the vote is recorded.
       * @throws PlayerNotFoundError - If the voter does not exist.
       * @throws InvalidVoteError - If the voter is not a werewolf.
       */
      handleWerewolfVote: (voterSid: string, targetSid: string) =>
        Effect.gen(function* () {
          const voter = players.get(voterSid);
          if (!voter) {
            return yield* Effect.fail(
              new PlayerNotFoundError({ socketId: voterSid })
            );
          }

          if (voter.getRole() !== 'WEREWOLF') {
            return yield* Effect.fail(
              new InvalidVoteError({
                reason: `Player ${voterSid} is not a werewolf and cannot vote during werewolf phase`,
              })
            );
          }

          werewolfVotes.set(voterSid, targetSid);
        }),

      /**
       * Retrieves the current werewolf vote tallies.
       * @returns Effect containing a record mapping target socket IDs to vote counts.
       * @dependencies Uses vote-tallying pure function.
       */
      getWerewolfVoteTallies: Effect.sync(() =>
        calculateTallies(werewolfVotes)
      ),

      /**
       * Checks if all werewolves have voted unanimously.
       * @returns Effect containing true if all werewolves have agreed on a target, false otherwise.
       * @dependencies Uses vote-tallying pure function.
       */
      hasAllWerewolvesAgreed: Effect.gen(function* () {
        const werewolves = Array.from(players.values()).filter(
          (p) => p.getRole() === 'WEREWOLF'
        );
        const werewolfSids = werewolves.map((w) => w.getSocketId());
        return hasAllWerewolvesAgreedPure(werewolfVotes, werewolfSids);
      }),

      /**
       * Retrieves the target of the werewolf votes if all werewolves have agreed.
       * @returns Effect containing the target socket ID or null if no unanimous target.
       * @dependencies Uses vote-tallying pure function.
       */
      getWerewolfTarget: Effect.gen(function* () {
        const werewolves = Array.from(players.values()).filter(
          (p) => p.getRole() === 'WEREWOLF'
        );
        const werewolfSids = werewolves.map((w) => w.getSocketId());
        return getWerewolfTargetPure(werewolfVotes, werewolfSids);
      }),

      /**
       * Clears all werewolf votes, preparing for the next werewolf phase.
       * @returns Effect that completes when werewolf votes are cleared.
       */
      clearWerewolfVotes: Effect.sync(() => {
        werewolfVotes.clear();
      }),

      /**
       * Records a player's vote during the day voting phase.
       * @param voterSid - The socket ID of the voting player.
       * @param targetSid - The socket ID of the target player.
       * @returns Effect that completes when the vote is recorded.
       * @throws PlayerNotFoundError - If the voter does not exist.
       */
      handleDayVote: (voterSid: string, targetSid: string) =>
        Effect.gen(function* () {
          const voter = players.get(voterSid);
          if (!voter) {
            return yield* Effect.fail(
              new PlayerNotFoundError({ socketId: voterSid })
            );
          }

          dayVotes.set(voterSid, targetSid);
        }),

      /**
       * Retrieves the current day vote tallies.
       * @returns Effect containing a record mapping target socket IDs to vote counts.
       * @dependencies Uses vote-tallying pure function.
       */
      getDayVoteTallies: Effect.sync(() => calculateTallies(dayVotes)),

      /**
       * Checks if all alive players have voted during the day phase.
       * @returns Effect containing true if all alive players have voted, false otherwise.
       * @dependencies Uses vote-tallying pure function.
       */
      hasAllPlayersVoted: Effect.sync(() => {
        const alivePlayers = Array.from(players.values()).filter(
          (player) => player.isAlive
        );
        const aliveSids = alivePlayers.map((player) => player.getSocketId());
        return hasAllVoted(aliveSids, dayVotes);
      }),

      /**
       * Retrieves the winning target from day votes.
       * @returns Effect containing the Player with the most votes.
       * @throws TieVoteError - If there is a tie in votes.
       * @throws NoTargetError - If no votes have been cast.
       * @throws PlayerNotFoundError - If the target player does not exist.
       * @dependencies Uses vote-tallying pure functions.
       */
      getDayVoteTarget: Effect.gen(function* () {
        const tallies = calculateTallies(dayVotes);

        if (checkForTie(tallies)) {
          return yield* Effect.fail(new TieVoteError());
        }

        const targetSid = getWinningTarget(tallies);

        if (!targetSid) {
          return yield* Effect.fail(new NoTargetError());
        }

        const target = players.get(targetSid);

        if (!target) {
          return yield* Effect.fail(
            new PlayerNotFoundError({ socketId: targetSid })
          );
        }

        return target;
      }),

      /**
       * Clears all day votes, preparing for the next day phase.
       * @returns Effect that completes when day votes are cleared.
       */
      clearDayVotes: Effect.sync(() => {
        dayVotes.clear();
      }),
    };
  }),
  dependencies: [Lobby.Default],
}) {}
