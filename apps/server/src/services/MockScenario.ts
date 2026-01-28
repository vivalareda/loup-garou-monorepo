import type {
  MockLoverScenario,
  MockWerewolvesScenario,
  MockWitchHealScenario,
} from '@repo/types';
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

const witchHealScenario: MockWitchHealScenario = {
  segment: 'WEREWOLF',
  index: 3,
  players: [
    { role: 'CUPID', isAlive: true },
    { role: 'WEREWOLF', isAlive: true },
    { role: 'WEREWOLF', isAlive: true },
    { role: 'WITCH', isAlive: true },
    { role: 'VILLAGER', isAlive: true },
    { role: 'VILLAGER', isAlive: true },
  ],
  werewolvesTargetIndex: 5,
};

const mockScenarios: {
  LOVERS: MockLoverScenario;
  WEREWOLF: MockWerewolvesScenario;
  WITCH_HEAL: MockWitchHealScenario;
} = {
  LOVERS: loverScenario,
  WEREWOLF: werewolvesScenario,
  WITCH_HEAL: witchHealScenario,
};

const MockScenarioValue = Effect.succeed(mockScenarios) as Effect.Effect<
  typeof mockScenarios
>;

export const MockScenario = MockScenarioValue;
export const MockScenarioDefault = MockScenarioValue;
