import type { DeathCause } from './death';
import type { Role } from './role';
import type { SegmentType } from './segment';

type PlayerSlot = number;
type CompleteType<T> = {
  [K in keyof T]: T[K];
};

export type MockScenarioPlayer = {
  /**
   * Role assigned to the player occupying this slot.
   */
  role: Role;
  /**
   * Whether the player starts the scenario alive.
   * Defaults to true when omitted.
   */
  isAlive?: boolean;
};

export type MockScenarioVoteMap = Record<PlayerSlot, PlayerSlot>;

export type MockScenarioPendingDeath = {
  /**
   * Index of the player scheduled to die (based on the players array order).
   */
  slot: PlayerSlot;
  cause: DeathCause;
};

/**
 * Declarative representation of a server debug scenario.
 *
 * Each scenario maps existing lobby slots to roles, relationships,
 * and pending vote results so the server can jump directly to a segment.
 */
export type MockScenario = {
  /**
   * Segment that should be considered "current" after loading the scenario.
   */
  segment: SegmentType;
  /**
   * Index of current segment
   */
  index: number;
  /**
   * Ordered player slots with their desired roles.
   */
  players: readonly MockScenarioPlayer[];
  // /**
  //  * Pair of slot indexes representing the lovers link.
  //  */
  // lovers?: readonly [PlayerSlot, PlayerSlot];
  // /**
  //  * Pre-loaded werewolf vote mapping (voter slot -> target slot).
  //  */
  // werewolfVotes?: MockScenarioVoteMap;
  // /**
  //  * Pre-loaded day vote mapping (voter slot -> target slot).
  //  */
  // dayVotes?: MockScenarioVoteMap;
  // /**
  //  * Queue of deaths that should resolve when the scenario starts.
  //  */
  // pendingDeaths?: readonly MockScenarioPendingDeath[];
};

export type MockLoverScenario = CompleteType<
  MockScenario & {
    loversIndex: number[];
  }
>;

export type MockWerewolvesScenario = CompleteType<
  MockScenario & {
    loversIndex?: number[];
  }
>;
