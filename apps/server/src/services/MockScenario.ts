import type {
  MockLoverScenario,
  MockWerewolvesScenario,
  MockWitchScenario,
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

const witchScenario: MockWitchScenario = {
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

const dayVoteScenario: MockWerewolvesScenario = {
  segment: 'DAY_VOTE',
  index: 4,
  players: [
    { role: 'CUPID', isAlive: true },
    { role: 'WEREWOLF', isAlive: true },
    { role: 'WEREWOLF', isAlive: true },
    { role: 'WITCH', isAlive: true },
    { role: 'VILLAGER', isAlive: true },
    { role: 'VILLAGER', isAlive: true },
  ],
  // Deterministic sheriff for debugging tie-breaks.
  sheriffPlayerSlot: 0,
  loversIndex: [4, 5],
  // No pending deaths here so we can debug tie-break votes with all 6 players.
};

const hunterScenario: MockWerewolvesScenario = {
  segment: 'DAY_VOTE',
  index: 4,
  players: [
    { role: 'CUPID', isAlive: true },
    { role: 'WEREWOLF', isAlive: true },
    { role: 'WEREWOLF', isAlive: true },
    { role: 'HUNTER', isAlive: true },
    { role: 'VILLAGER', isAlive: true },
    { role: 'VILLAGER', isAlive: true },
  ],
  sheriffPlayerSlot: 0,
  loversIndex: [3, 5],
  pendingDeaths: [{ slot: 5, cause: 'WEREWOLVES' }],
};

const mockScenarios: {
  LOVERS: MockLoverScenario;
  WEREWOLF: MockWerewolvesScenario;
  WITCH: MockWitchScenario;
  DAY_VOTE: MockWerewolvesScenario;
  HUNTER: MockWerewolvesScenario;
} = {
  LOVERS: loverScenario,
  WEREWOLF: werewolvesScenario,
  WITCH: witchScenario,
  DAY_VOTE: dayVoteScenario,
  HUNTER: hunterScenario,
};

const MockScenarioValue = Effect.succeed(mockScenarios) as Effect.Effect<
  typeof mockScenarios
>;

export const MockScenario = MockScenarioValue;
export const MockScenarioDefault = MockScenarioValue;
