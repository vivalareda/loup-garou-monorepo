import type { Role } from '@repo/types';
import { describe, expect, it, vi } from 'vitest';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import type { SocketType } from '@/server/sockets';

/**
 * Table-driven matrix for checkIfWinner (parity rule):
 * werewolves win as soon as they are at least as numerous as the living
 * villagers — they control every day vote from there — EXCEPT when a
 * living witch still holds a potion (she can swing the numbers at night).
 */

type Scenario = {
  name: string;
  /** Living players on the villager team (roles). */
  villagers: Role[];
  /** Living werewolf count. */
  werewolves: number;
  /** Dead players to register on each team (still on the team lists). */
  deadVillagers?: Role[];
  deadWerewolves?: number;
  /** Potion state (only meaningful when a WITCH is in play). */
  healPotion?: boolean;
  poisonPotion?: boolean;
  expected: 'villagers' | 'werewolves' | null;
};

const scenarios: Scenario[] = [
  {
    name: 'no werewolves left → villagers win',
    villagers: ['VILLAGER', 'WITCH'],
    werewolves: 0,
    deadWerewolves: 2,
    expected: 'villagers',
  },
  {
    name: 'no villagers left → werewolves win',
    villagers: [],
    werewolves: 2,
    deadVillagers: ['VILLAGER', 'VILLAGER'],
    expected: 'werewolves',
  },
  {
    name: 'wolves outnumbered (1 wolf vs 3 villagers) → game continues',
    villagers: ['VILLAGER', 'VILLAGER', 'CUPID'],
    werewolves: 1,
    expected: null,
  },
  {
    name: 'exact parity 2v2 without witch → werewolves win',
    villagers: ['VILLAGER', 'CUPID'],
    werewolves: 2,
    expected: 'werewolves',
  },
  {
    name: '1v1 without witch → werewolves win',
    villagers: ['VILLAGER'],
    werewolves: 1,
    expected: 'werewolves',
  },
  {
    name: 'parity but the witch still has her heal potion → game continues',
    villagers: ['WITCH', 'VILLAGER'],
    werewolves: 2,
    healPotion: true,
    poisonPotion: false,
    expected: null,
  },
  {
    name: 'parity but the witch still has her poison potion → game continues',
    villagers: ['WITCH'],
    werewolves: 1,
    healPotion: false,
    poisonPotion: true,
    expected: null,
  },
  {
    name: 'parity with a potionless witch → werewolves win',
    villagers: ['WITCH', 'VILLAGER'],
    werewolves: 2,
    healPotion: false,
    poisonPotion: false,
    expected: 'werewolves',
  },
  {
    name: 'a DEAD witch with unspent potions does not save parity',
    villagers: ['VILLAGER'],
    werewolves: 1,
    deadVillagers: ['WITCH'],
    healPotion: true,
    poisonPotion: true,
    expected: 'werewolves',
  },
  {
    name: 'wolves ahead but not at parity is impossible to reach without >=, still: 2 wolves vs 3 villagers → continues',
    villagers: ['VILLAGER', 'VILLAGER', 'WITCH'],
    werewolves: 2,
    expected: null,
  },
];

function buildGame(scenario: Scenario) {
  const mockIo = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  } as unknown as SocketType;
  const deathManager = new DeathManager();
  const game = new Game(mockIo, deathManager);
  let sidCounter = 0;

  const add = (role: Role, alive: boolean, team: 'V' | 'W') => {
    const player = game.addPlayer(`P${sidCounter}`, `sid-${sidCounter}`);
    sidCounter++;
    player.setRole(role);
    game.setPlayerTeams(player);
    if (team === 'V' && role !== 'VILLAGER') {
      game.setSpecialRolePlayer(player);
    }
    if (!alive) {
      player.setIsAlive(false);
    }
  };

  for (const role of scenario.villagers) {
    add(role, true, 'V');
  }
  for (const role of scenario.deadVillagers ?? []) {
    add(role, false, 'V');
  }
  for (let i = 0; i < scenario.werewolves; i++) {
    add('WEREWOLF', true, 'W');
  }
  for (let i = 0; i < (scenario.deadWerewolves ?? 0); i++) {
    add('WEREWOLF', false, 'W');
  }

  if (scenario.healPotion === false) {
    game.healWerewolfVictim();
  }
  if (scenario.poisonPotion === false) {
    game.witchKill('sid-0');
    deathManager.removePendingDeath('sid-0');
  }

  return game;
}

describe('checkIfWinner victory matrix (parity rule)', () => {
  it.each(scenarios)('$name', (scenario) => {
    const game = buildGame(scenario);
    expect(game.checkIfWinner()).toBe(scenario.expected);
  });

  it('an empty game reports no winner (empty lobby cannot be a village victory)', () => {
    const mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketType;
    const game = new Game(mockIo, new DeathManager());
    expect(game.checkIfWinner()).toBeNull();
  });
});
