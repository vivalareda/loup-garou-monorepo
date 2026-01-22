import { describe, expect, it } from '@effect/vitest';
import type { Role } from '@repo/types';
import { Effect, Layer } from 'effect';
import { Player } from '@/core/player.js';
import {
  InvalidVoteError,
  NoTargetError,
  PlayerNotFoundError,
  SpecialPlayerNotFoundError,
  TieVoteError,
} from '../errors.js';
import { Game } from '../Game.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';

const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
const playerSocketIds = playerNames.map((_, index) => `socket-${index + 1}`);

const baseCounts: Record<Role, number> = {
  VILLAGER: 0,
  WEREWOLF: 0,
  SEER: 0,
  HUNTER: 0,
  CUPID: 0,
  WITCH: 0,
};

const countRoles = (roles: Role[]): Record<Role, number> => {
  const counts = { ...baseCounts };
  for (const role of roles) {
    counts[role] += 1;
  }
  return counts;
};

const makeTestLayer = () => {
  const configLayer = Layer.succeed(LobbyConfig, { maxPlayers: 6 });
  const lobbyLayer = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(configLayer)
  );
  const gameLayer = Game.DefaultWithoutDependencies.pipe(
    Layer.provide(lobbyLayer)
  );

  return Layer.mergeAll(lobbyLayer, gameLayer);
};

const setupGame = Effect.gen(function* () {
  const lobby = yield* Lobby;
  const game = yield* Game;

  for (const [index, name] of playerNames.entries()) {
    yield* lobby.addPlayer(name, playerSocketIds[index]);
  }

  yield* game.startGame;

  const players = yield* game.getPlayers;

  return { game, players };
});

const setPlayerStates = (
  players: Player[],
  states: Array<{ role: Role; alive: boolean }>
) => {
  if (players.length !== states.length) {
    throw new Error('Expected players and states to match in length');
  }

  for (const [index, player] of players.entries()) {
    const state = states[index];
    if (!state) {
      throw new Error('Expected player state to be defined');
    }
    player.setRole(state.role);
    player.setIsAlive(state.alive);
  }
};

describe('Game Service', () => {
  it.effect('starts game with lobby players and assigns roles', () =>
    Effect.gen(function* () {
      const { players } = yield* setupGame;

      expect(players).toHaveLength(playerNames.length);
      expect(players.map((player) => player.getName())).toEqual(playerNames);
      expect(players.map((player) => player.getSocketId())).toEqual(
        playerSocketIds
      );

      const roleCounts = countRoles(players.map((player) => player.getRole()));

      expect(roleCounts).toEqual({
        ...baseCounts,
        WEREWOLF: 2,
        CUPID: 1,
        WITCH: 1,
        VILLAGER: 2,
      });
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('returns client player list identities', () =>
    Effect.gen(function* () {
      const { game } = yield* setupGame;

      const clientPlayers = yield* game.getClientPlayerList;

      expect(clientPlayers).toEqual(
        playerNames.map((name, index) => ({
          name,
          sid: playerSocketIds[index],
        }))
      );
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('returns special role players and errors when missing', () =>
    Effect.gen(function* () {
      const { game, players } = yield* setupGame;

      const cupid = players.find((player) => player.getRole() === 'CUPID');
      const witch = players.find((player) => player.getRole() === 'WITCH');

      expect(cupid).toBeDefined();
      expect(witch).toBeDefined();

      const cupidPlayer = yield* game.getSpecialRolePlayer('CUPID');
      const witchPlayer = yield* game.getSpecialRolePlayer('WITCH');

      expect(cupidPlayer.getSocketId()).toBe(cupid?.getSocketId());
      expect(witchPlayer.getSocketId()).toBe(witch?.getSocketId());

      const error = yield* game
        .getSpecialRolePlayer('HUNTER')
        .pipe(Effect.flip);

      expect(error).toBeInstanceOf(SpecialPlayerNotFoundError);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('returns player by socket id and errors when missing', () =>
    Effect.gen(function* () {
      const { game } = yield* setupGame;

      const player = yield* game.getPlayerBySocketId(playerSocketIds[0]);

      expect(player.getName()).toBe(playerNames[0]);

      const error = yield* game
        .getPlayerBySocketId('missing-socket')
        .pipe(Effect.flip);

      expect(error).toBeInstanceOf(PlayerNotFoundError);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  describe('Day Voting', () => {
    it.effect('records day votes and tallies them', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        const voterOne = players[0];
        const voterTwo = players[1];
        const target = players[2];

        if (!(voterOne && voterTwo && target)) {
          throw new Error('Expected players to be defined');
        }

        yield* game.handleDayVote(voterOne.getSocketId(), target.getSocketId());
        yield* game.handleDayVote(voterTwo.getSocketId(), target.getSocketId());

        const tallies = yield* game.getDayVoteTallies;

        expect(tallies[target.getSocketId()]).toBe(2);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('rejects day votes from missing players', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        const target = players[0];
        if (!target) {
          throw new Error('Expected target player to be defined');
        }

        const error = yield* game
          .handleDayVote('missing-socket', target.getSocketId())
          .pipe(Effect.flip);

        expect(error).toBeInstanceOf(PlayerNotFoundError);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('treats only alive players as voters', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        const lastPlayer = players.at(-1);
        if (!lastPlayer) {
          throw new Error('Expected player to be defined');
        }

        lastPlayer.setIsAlive(false);

        const alivePlayers = players.filter((player) => player.isAlive);
        const target = alivePlayers[0];

        if (!target) {
          throw new Error('Expected target player to be defined');
        }

        for (const voter of alivePlayers) {
          yield* game.handleDayVote(voter.getSocketId(), target.getSocketId());
        }

        const allVoted = yield* game.hasAllPlayersVoted;

        expect(allVoted).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('detects when not all alive players have voted', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        const target = players[0];
        const voter = players[1];

        if (!(target && voter)) {
          throw new Error('Expected players to be defined');
        }

        yield* game.handleDayVote(voter.getSocketId(), target.getSocketId());

        const allVoted = yield* game.hasAllPlayersVoted;

        expect(allVoted).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('returns player with most votes', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        const target = players[0];
        const alternateTarget = players[1];
        const voters = players.slice(2);

        if (!(target && alternateTarget) || voters.length < 3) {
          throw new Error('Expected players to be defined');
        }

        yield* game.handleDayVote(
          voters[0].getSocketId(),
          target.getSocketId()
        );
        yield* game.handleDayVote(
          voters[1].getSocketId(),
          target.getSocketId()
        );
        yield* game.handleDayVote(
          voters[2].getSocketId(),
          alternateTarget.getSocketId()
        );

        const votedOut = yield* game.getDayVoteTarget;

        expect(votedOut.getSocketId()).toBe(target.getSocketId());
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('fails when a tie occurs', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        const targetOne = players[0];
        const targetTwo = players[1];
        const voters = players.slice(2, 6);

        if (!(targetOne && targetTwo) || voters.length < 4) {
          throw new Error('Expected players to be defined');
        }

        yield* game.handleDayVote(
          voters[0].getSocketId(),
          targetOne.getSocketId()
        );
        yield* game.handleDayVote(
          voters[1].getSocketId(),
          targetOne.getSocketId()
        );
        yield* game.handleDayVote(
          voters[2].getSocketId(),
          targetTwo.getSocketId()
        );
        yield* game.handleDayVote(
          voters[3].getSocketId(),
          targetTwo.getSocketId()
        );

        const error = yield* game.getDayVoteTarget.pipe(Effect.flip);

        expect(error).toBeInstanceOf(TieVoteError);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('fails when no votes are cast', () =>
      Effect.gen(function* () {
        const { game } = yield* setupGame;

        const error = yield* game.getDayVoteTarget.pipe(Effect.flip);

        expect(error).toBeInstanceOf(NoTargetError);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('clears day votes', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        const voter = players[0];
        const target = players[1];

        if (!(voter && target)) {
          throw new Error('Expected players to be defined');
        }

        yield* game.handleDayVote(voter.getSocketId(), target.getSocketId());

        let tallies = yield* game.getDayVoteTallies;
        expect(Object.keys(tallies).length).toBeGreaterThan(0);

        yield* game.clearDayVotes;

        tallies = yield* game.getDayVoteTallies;
        expect(tallies).toEqual({});
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Werewolf voting', () => {
    it.effect('records werewolf votes and returns the target', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;
        const werewolves = players.filter(
          (player) => player.getRole() === 'WEREWOLF'
        );
        const target = players.find(
          (player) => player.getRole() !== 'WEREWOLF'
        );

        if (werewolves.length < 2 || !target) {
          throw new Error('Expected werewolves and target to be defined');
        }

        yield* game.handleWerewolfVote(
          werewolves[0].getSocketId(),
          target.getSocketId()
        );
        yield* game.handleWerewolfVote(
          werewolves[1].getSocketId(),
          target.getSocketId()
        );

        const tallies = yield* game.getWerewolfVoteTallies;
        expect(tallies[target.getSocketId()]).toBe(2);
        expect(yield* game.hasAllWerewolvesAgreed).toBe(true);
        expect(yield* game.getWerewolfTarget).toBe(target.getSocketId());

        yield* game.clearWerewolfVotes;

        const clearedTallies = yield* game.getWerewolfVoteTallies;
        expect(clearedTallies).toEqual({});
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('rejects votes from non-werewolves', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;
        const villager = players.find(
          (player) => player.getRole() !== 'WEREWOLF'
        );
        const target = players.find(
          (player) => player.getRole() === 'WEREWOLF'
        );

        if (!(villager && target)) {
          throw new Error('Expected villager and target to be defined');
        }

        const error = yield* game
          .handleWerewolfVote(villager.getSocketId(), target.getSocketId())
          .pipe(Effect.flip);

        expect(error).toBeInstanceOf(InvalidVoteError);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('errors when werewolf voter is missing', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;
        const target = players.find(
          (player) => player.getRole() !== 'WEREWOLF'
        );

        if (!target) {
          throw new Error('Expected target to be defined');
        }

        const error = yield* game
          .handleWerewolfVote('missing-socket', target.getSocketId())
          .pipe(Effect.flip);

        expect(error).toBeInstanceOf(PlayerNotFoundError);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('returns undefined when werewolves disagree', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;
        const werewolves = players.filter(
          (player) => player.getRole() === 'WEREWOLF'
        );
        const targets = players.filter(
          (player) => player.getRole() !== 'WEREWOLF'
        );

        if (werewolves.length < 2 || targets.length < 2) {
          throw new Error('Expected werewolves and targets to be defined');
        }

        yield* game.handleWerewolfVote(
          werewolves[0].getSocketId(),
          targets[0].getSocketId()
        );
        yield* game.handleWerewolfVote(
          werewolves[1].getSocketId(),
          targets[1].getSocketId()
        );

        expect(yield* game.hasAllWerewolvesAgreed).toBe(false);
        expect(yield* game.getWerewolfTarget).toBeUndefined();
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Player deaths', () => {
    it.effect('kills a player and disables witch potions', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;
        const witch = players.find((player) => player.getRole() === 'WITCH');

        if (!witch) {
          throw new Error('Expected witch to be defined');
        }

        expect(witch.isAlive).toBe(true);
        expect(yield* game.canWitchHeal).toBe(true);
        expect(yield* game.canWitchPoison).toBe(true);

        yield* game.killPlayer(witch.getSocketId());

        expect(witch.isAlive).toBe(false);
        expect(yield* game.canWitchHeal).toBe(false);
        expect(yield* game.canWitchPoison).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('errors when killing a missing player', () =>
      Effect.gen(function* () {
        const { game } = yield* setupGame;

        const error = yield* game
          .killPlayer('missing-socket')
          .pipe(Effect.flip);

        expect(error).toBeInstanceOf(PlayerNotFoundError);
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Witch potions', () => {
    it.effect('heals the werewolf victim and consumes potion', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;
        const victim = players[0];

        if (!victim) {
          throw new Error('Expected victim to be defined');
        }

        expect(yield* game.canWitchHeal).toBe(true);

        yield* game.addPendingDeath(victim.getSocketId(), 'WEREWOLVES');
        expect(yield* game.isInDeathQueue(victim.getSocketId())).toBe(true);

        yield* game.witchHeal;

        expect(yield* game.isInDeathQueue(victim.getSocketId())).toBe(false);
        expect(yield* game.canWitchHeal).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('poisons a player and consumes potion', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;
        const target = players[0];

        if (!target) {
          throw new Error('Expected target to be defined');
        }

        yield* game.witchPoison(target.getSocketId());

        expect(yield* game.isInDeathQueue(target.getSocketId())).toBe(true);
        expect(yield* game.canWitchPoison).toBe(false);

        const deaths = yield* game.processPendingDeaths;
        const poisonDeath = deaths.find(
          (death) => death.playerId === target.getSocketId()
        );

        expect(poisonDeath?.cause).toBe('WITCH_POISON');
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('prevents reusing heal potion', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;
        const firstVictim = players[0];
        const secondVictim = players[1];

        if (!(firstVictim && secondVictim)) {
          throw new Error('Expected victims to be defined');
        }

        yield* game.addPendingDeath(firstVictim.getSocketId(), 'WEREWOLVES');
        yield* game.witchHeal;

        yield* game.addPendingDeath(secondVictim.getSocketId(), 'WEREWOLVES');
        yield* game.witchHeal;

        expect(yield* game.isInDeathQueue(secondVictim.getSocketId())).toBe(
          true
        );
        expect(yield* game.canWitchHeal).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('removes potions when the witch dies', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;
        const witch = players.find((player) => player.getRole() === 'WITCH');

        if (!witch) {
          throw new Error('Expected witch to be defined');
        }

        expect(yield* game.canWitchHeal).toBe(true);
        expect(yield* game.canWitchPoison).toBe(true);

        yield* game.addPendingDeath(witch.getSocketId(), 'WITCH_POISON');
        yield* game.processPendingDeaths;

        expect(yield* game.canWitchHeal).toBe(false);
        expect(yield* game.canWitchPoison).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Win conditions', () => {
    it.effect('reports villagers win when werewolves are gone', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        setPlayerStates(players, [
          { role: 'VILLAGER', alive: true },
          { role: 'VILLAGER', alive: true },
          { role: 'VILLAGER', alive: true },
          { role: 'VILLAGER', alive: true },
          { role: 'VILLAGER', alive: true },
          { role: 'VILLAGER', alive: true },
        ]);

        const winner = yield* game.checkWinner;

        expect(winner).toBe('villagers');
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('reports werewolf win when they outnumber villagers', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        setPlayerStates(players, [
          { role: 'WEREWOLF', alive: true },
          { role: 'WEREWOLF', alive: true },
          { role: 'WEREWOLF', alive: true },
          { role: 'VILLAGER', alive: true },
          { role: 'VILLAGER', alive: true },
          { role: 'VILLAGER', alive: false },
        ]);

        const winner = yield* game.checkWinner;

        expect(winner).toBe('werewolves');
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('continues when witch still has potions', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        setPlayerStates(players, [
          { role: 'WEREWOLF', alive: true },
          { role: 'WEREWOLF', alive: true },
          { role: 'VILLAGER', alive: true },
          { role: 'VILLAGER', alive: true },
          { role: 'VILLAGER', alive: false },
          { role: 'VILLAGER', alive: false },
        ]);

        const winner = yield* game.checkWinner;

        expect(winner).toBeNull();
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('reports werewolf win when potions are gone', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;
        const witch = players[4];

        if (!witch) {
          throw new Error('Expected witch to be defined');
        }

        setPlayerStates(players, [
          { role: 'WEREWOLF', alive: true },
          { role: 'WEREWOLF', alive: true },
          { role: 'VILLAGER', alive: true },
          { role: 'VILLAGER', alive: true },
          { role: 'WITCH', alive: true },
          { role: 'VILLAGER', alive: false },
        ]);

        yield* game.killPlayer(witch.getSocketId());

        const winner = yield* game.checkWinner;

        expect(winner).toBe('werewolves');
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('continues when villagers outnumber werewolves', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        setPlayerStates(players, [
          { role: 'WEREWOLF', alive: true },
          { role: 'VILLAGER', alive: true },
          { role: 'VILLAGER', alive: true },
          { role: 'VILLAGER', alive: true },
          { role: 'VILLAGER', alive: false },
          { role: 'VILLAGER', alive: false },
        ]);

        const winner = yield* game.checkWinner;

        expect(winner).toBeNull();
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Player model', () => {
    it('updates identity and state', () => {
      const player = new Player('Casey', 'player-1', 'VILLAGER');

      expect(player.getIdentity()).toEqual({ name: 'Casey', sid: 'player-1' });
      expect(player.getRole()).toBe('VILLAGER');

      player.setRole('WEREWOLF');
      expect(player.getRole()).toBe('WEREWOLF');

      player.kill();
      expect(player.isAlive).toBe(false);

      player.setIsAlive(true);
      expect(player.isAlive).toBe(true);

      player.assignRole('CUPID');
      expect(player.getRole()).toBe('CUPID');
    });
  });
});
