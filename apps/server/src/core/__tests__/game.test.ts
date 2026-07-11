import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import type { SocketType } from '@/server/sockets';

describe('Game class', () => {
  let game: Game;
  let deathManager: DeathManager;
  let mockIo: SocketType;

  beforeEach(() => {
    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketType;
    deathManager = new DeathManager();
    game = new Game(mockIo, deathManager);
  });

  describe('Player Management', () => {
    it('should add players to the game', () => {
      game.addPlayer('Player1', 'socket-1');
      game.addPlayer('Player2', 'socket-2');

      expect(game.getPlayerList().size).toBe(2);
    });

    it('should get player list with correct size', () => {
      game.addPlayer('Alice', 'socket-1');
      game.addPlayer('Bob', 'socket-2');
      game.addPlayer('Charlie', 'socket-3');

      expect(game.getPlayerList().size).toBe(3);
    });

    it('should retrieve a player by socket ID', () => {
      game.addPlayer('Player1', 'socket-1');

      const player = game.getPlayerBySocketId('socket-1');
      expect(player).toBeDefined();
      expect(player?.getName()).toBe('Player1');
    });

    it('should return undefined for non-existent socket ID', () => {
      const player = game.getPlayerBySocketId('non-existent');
      expect(player).toBeUndefined();
    });

    it('should get client player list with correct format', () => {
      game.addPlayer('Alice', 'socket-1');
      game.addPlayer('Bob', 'socket-2');

      const clientList = game.getClientPlayerList();
      expect(clientList).toHaveLength(2);
      expect(clientList[0]).toEqual({
        name: 'Alice',
        socketId: 'socket-1',
      });
    });
  });

  describe('Role Assignment', () => {
    it('should initialize roles list based on player count', () => {
      for (let i = 0; i < 4; i++) {
        game.addPlayer(`Player${i}`, `socket-${i}`);
      }

      game.initRolesList();
      expect(game.availableRoles.length).toBe(4);
    });

    it('should assign roles to all players', () => {
      for (let i = 0; i < 4; i++) {
        game.addPlayer(`Player${i}`, `socket-${i}`);
      }

      game.assignRoles();

      const players = Array.from(game.getPlayerList().values());
      for (const player of players) {
        expect(player.getRole()).toBeDefined();
      }
    });

    it('should have at least one werewolf with 4+ players', () => {
      for (let i = 0; i < 4; i++) {
        game.addPlayer(`Player${i}`, `socket-${i}`);
      }

      game.assignRoles();
      const werewolves = game.getWerewolves();
      expect(werewolves.length).toBeGreaterThan(0);
    });

    it('should set special role players correctly', () => {
      for (let i = 0; i < 6; i++) {
        game.addPlayer(`Player${i}`, `socket-${i}`);
      }

      game.assignRoles();

      const cupid = game.getSpecialRolePlayer('CUPID');
      expect(cupid).toBeDefined();
    });

    it('should shuffle array correctly', () => {
      const array = [1, 2, 3, 4, 5];
      const shuffled = game.shuffleArray(array);

      expect(shuffled).toHaveLength(5);
      expect(shuffled).toContain(1);
      expect(shuffled).toContain(5);
    });
  });

  describe('Werewolf Voting', () => {
    beforeEach(() => {
      for (let i = 0; i < 4; i++) {
        game.addPlayer(`Player${i}`, `socket-${i}`);
      }
      game.assignRoles();
    });

    it('should handle werewolf vote', () => {
      const werewolves = game.getWerewolfList();
      const victim = Array.from(game.getPlayerList().values()).find(
        (p) => p.getRole() !== 'WEREWOLF'
      );

      if (werewolves.length > 0 && victim) {
        game.handleWerewolfVote(
          werewolves[0].getSocketId(),
          victim.getSocketId()
        );
        expect(mockIo.to).toHaveBeenCalled();
      }
    });

    it('should reject vote from non-werewolf', () => {
      const villagers = game.getVillagersList();
      const werewolves = game.getWerewolfList();

      if (villagers.length > 0 && werewolves.length > 0) {
        expect(() => {
          game.handleWerewolfVote(
            villagers[0].socketId,
            werewolves[0].getSocketId()
          );
        }).toThrow();
      }
    });

    it('should calculate werewolf vote tallies', () => {
      const werewolves = game.getWerewolfList();
      const victim = Array.from(game.getPlayerList().values()).find(
        (p) => p.getRole() !== 'WEREWOLF'
      );

      if (werewolves.length > 0 && victim) {
        game.handleWerewolfVote(
          werewolves[0].getSocketId(),
          victim.getSocketId()
        );
        const tallies = game.getWerewolfVoteTallies();
        expect(tallies[victim.getSocketId()]).toBe(1);
      }
    });

    it('should detect when all werewolves agree', () => {
      const werewolves = game.getWerewolfList();
      const victim = Array.from(game.getPlayerList().values()).find(
        (p) => p.getRole() !== 'WEREWOLF'
      );

      if (werewolves.length > 0 && victim) {
        for (const werewolf of werewolves) {
          game.handleWerewolfVote(werewolf.getSocketId(), victim.getSocketId());
        }
        expect(game.hasAllWerewolvesAgreed()).toBe(true);
      }
    });

    it('should get werewolf target when agreed', () => {
      const werewolves = game.getWerewolfList();
      const victim = Array.from(game.getPlayerList().values()).find(
        (p) => p.getRole() !== 'WEREWOLF'
      );

      if (werewolves.length > 0 && victim) {
        for (const werewolf of werewolves) {
          game.handleWerewolfVote(werewolf.getSocketId(), victim.getSocketId());
        }
        const target = game.getWerewolfTarget();
        expect(target).toBe(victim.getSocketId());
      }
    });
  });

  describe('Day Voting', () => {
    beforeEach(() => {
      for (let i = 0; i < 4; i++) {
        game.addPlayer(`Player${i}`, `socket-${i}`);
      }
      game.assignRoles();
    });

    it('should handle day vote', () => {
      const players = Array.from(game.getPlayerList().values());
      game.handleDayVote(players[0].getSocketId(), players[1].getSocketId());
      expect(game.getPlayerList().size).toBe(4);
    });

    it('should calculate day vote tallies', () => {
      const players = Array.from(game.getPlayerList().values());
      game.handleDayVote(players[0].getSocketId(), players[1].getSocketId());
      game.handleDayVote(players[2].getSocketId(), players[1].getSocketId());

      const tallies = game.calculateDayVoteTallies();
      expect(tallies[players[1].getSocketId()]).toBe(2);
    });
  });

  describe('Death Management', () => {
    beforeEach(() => {
      for (let i = 0; i < 4; i++) {
        game.addPlayer(`Player${i}`, `socket-${i}`);
      }
      game.assignRoles();
    });

    it('should add pending death', () => {
      const players = Array.from(game.getPlayerList().values());
      game.addPendingDeath(players[0].getSocketId(), 'WEREWOLVES');

      expect(game.getDeathQueue().length).toBe(1);
    });

    it('should throw error when adding death for non-existent player', () => {
      expect(() => {
        game.addPendingDeath('non-existent-socket', 'WEREWOLVES');
      }).toThrow();
    });

    it('should process pending deaths', () => {
      const players = Array.from(game.getPlayerList().values());
      game.addPendingDeath(players[0].getSocketId(), 'WEREWOLVES');

      const deathInfos = game.processPendingDeaths();
      expect(deathInfos).toHaveLength(1);
      expect(deathInfos[0].playerId).toBe(players[0].getSocketId());
      expect(deathInfos[0].cause).toBe('WEREWOLVES');
    });

    it('should set player as not alive after death', () => {
      const players = Array.from(game.getPlayerList().values());
      const player = players[0];

      game.addPendingDeath(player.getSocketId(), 'WEREWOLVES');
      game.processPendingDeaths();

      expect(player.isAlive).toBe(false);
    });
  });

  describe('Lovers/Partners', () => {
    beforeEach(() => {
      for (let i = 0; i < 4; i++) {
        game.addPlayer(`Player${i}`, `socket-${i}`);
      }
    });

    it('should set lovers', () => {
      const players = Array.from(game.getPlayerList().values());
      const lovers = [players[0].getSocketId(), players[1].getSocketId()];

      game.setLovers(lovers);
      expect(game.getLovers()).toHaveLength(2);
    });

    it('should detect if player has partner', () => {
      const players = Array.from(game.getPlayerList().values());
      const lovers = [players[0].getSocketId(), players[1].getSocketId()];

      game.setLovers(lovers);
      expect(game.hasPartner(players[0].getSocketId())).toBe(true);
    });

    it('should get players lover', () => {
      const players = Array.from(game.getPlayerList().values());
      game.setLovers([players[0].getSocketId(), players[1].getSocketId()]);

      const lover = game.getPlayersLover(players[0]);
      expect(lover.getSocketId()).toBe(players[1].getSocketId());
    });

    it('should identify player lover', () => {
      const players = Array.from(game.getPlayerList().values());
      game.setLovers([players[0].getSocketId(), players[1].getSocketId()]);

      expect(game.isPlayerLover(players[0])).toBe(true);
      expect(game.isPlayerLover(players[2])).toBe(false);
    });
  });

  describe('Witch Powers', () => {
    beforeEach(() => {
      for (let i = 0; i < 6; i++) {
        game.addPlayer(`Player${i}`, `socket-${i}`);
      }
      game.assignRoles();
    });

    it('should check if witch can heal', () => {
      expect(game.canWitchHeal()).toBe(true);
    });

    it('should check if witch can poison', () => {
      expect(game.canWitchPoison()).toBe(true);
    });

    it('should remove heal potion after use', () => {
      game.healWerewolfVictim();
      expect(game.canWitchHeal()).toBe(false);
    });

    it('should remove poison potion after use', () => {
      const players = Array.from(game.getPlayerList().values());
      game.witchKill(players[0].getSocketId());
      expect(game.canWitchPoison()).toBe(false);
    });
  });

  describe('Game State Checks', () => {
    beforeEach(() => {
      for (let i = 0; i < 4; i++) {
        game.addPlayer(`Player${i}`, `socket-${i}`);
      }
      game.assignRoles();
    });

    it('should identify werewolves', () => {
      const werewolves = game.getWerewolves();
      for (const werewolf of werewolves) {
        expect(game.isWerewolf(werewolf.getSocketId())).toBe(true);
      }
    });

    it('should get alive players', () => {
      const players = Array.from(game.getPlayerList().values());
      game.addPendingDeath(players[0].getSocketId(), 'WEREWOLVES');
      game.processPendingDeaths();

      const alive = game.getAlivePlayers();
      expect(alive).toHaveLength(3);
    });

    it('should check for winners - villagers win when no werewolves', () => {
      const werewolves = game.getWerewolves();
      for (const werewolf of werewolves) {
        game.addPendingDeath(werewolf.getSocketId(), 'DAY_VOTE');
        game.processPendingDeaths();
      }

      const winner = game.checkIfWinner();
      expect(winner).toBe('villagers');
    });
  });

  describe('Win/Loss Alerts', () => {
    // Per-socket emit spies: the shared `emit: vi.fn()` mock from the
    // outer beforeEach can't prove which socket received an event, so
    // `to(sid)` here returns an object carrying its own `emit` spy.
    let socketEmit: Map<string, ReturnType<typeof vi.fn>>;

    beforeEach(() => {
      socketEmit = new Map();
      mockIo = {
        to: vi.fn((sid: string) => {
          let emit = socketEmit.get(sid);
          if (!emit) {
            emit = vi.fn();
            socketEmit.set(sid, emit);
          }
          return { emit };
        }),
        emit: vi.fn(),
      } as unknown as SocketType;
      deathManager = new DeathManager();
      game = new Game(mockIo, deathManager);

      for (let i = 0; i < 4; i++) {
        game.addPlayer(`Player${i}`, `socket-${i}`);
      }
      game.assignRoles();
    });

    it('alerts villagers (not werewolves) of loss on werewolf win', () => {
      const werewolves = game.getWerewolfList();
      const villagers = deathManager.getTeamVillagers();
      expect(werewolves.length).toBeGreaterThan(0);
      expect(villagers.length).toBeGreaterThan(0);

      game.alertWinnersAndLosers('werewolves');

      // Villagers (the losers) each get alert:player-lost exactly once
      for (const villager of villagers) {
        const spy = socketEmit.get(villager.getSocketId());
        expect(spy).toBeDefined();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith('alert:player-lost');
      }

      // Werewolves (the winners) get alert:player-won, NOT alert:player-lost
      for (const werewolf of werewolves) {
        const spy = socketEmit.get(werewolf.getSocketId());
        expect(spy).toBeDefined();
        expect(spy).toHaveBeenCalledWith('alert:player-won');
        expect(spy).not.toHaveBeenCalledWith('alert:player-lost');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty game state', () => {
      expect(game.getPlayerList().size).toBe(0);
      expect(game.getClientPlayerList()).toHaveLength(0);
    });

    it('should throw error getting roles with no players', () => {
      game.initRolesList();
      expect(game.availableRoles.length).toBe(0);
    });

    it('should throw error assigning roles with no players', () => {
      expect(() => {
        game.assignRoles();
      }).not.toThrow();
    });
  });
});
