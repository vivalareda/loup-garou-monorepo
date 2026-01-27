import type { MockLoverScenario, MockWerewolvesScenario } from '@repo/types';
import { Effect } from 'effect';

const loverScenario: MockLoverScenario = {
  segment: 'CUPID',
  index: 1,
  players: [
    { role: 'CUPID', isAlive: true },
    { role: 'WEREWOLF', isAlive: true },
    { role: 'WEREWOLF', isAlive: true },
    { role: 'VILLAGER', isAlive: true },
    { role: 'VILLAGER', isAlive: true },
    { role: 'VILLAGER', isAlive: true },
  ],
  loversIndex: [1, 2],
};

const werewolvesScenario: MockWerewolvesScenario = {
  segment: 'LOVERS',
  index: 2,
  players: [
    { role: 'CUPID', isAlive: true },
    { role: 'WEREWOLF', isAlive: true },
    { role: 'WEREWOLF', isAlive: true },
    { role: 'VILLAGER', isAlive: true },
    { role: 'VILLAGER', isAlive: true },
    { role: 'VILLAGER', isAlive: true },
  ],
};

const mockScenarios = {
  LOVERS: loverScenario,
  WEREWOLF: werewolvesScenario,
} as const;

export class MockScenario extends Effect.Service<MockScenario>()(
  'MockScenario',
  {
    succeed: mockScenarios,
  }
) {}
