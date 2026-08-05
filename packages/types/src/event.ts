/** biome-ignore-all lint/suspicious/noExplicitAny: <use of generics> */

import type { DeathInfo } from './death';
import type { GameEndResult, Player, PlayerListItem } from './player';
import type { Role } from './role';
import type { SegmentType } from './segment';

/**
 * The action a reconnecting player is currently expected to take, so the
 * client can reopen the right prompt. Carries only information that player
 * is allowed to see.
 */
export type PendingPrompt =
  | { kind: 'CUPID' }
  | { kind: 'LOVERS'; partnerName: string }
  | { kind: 'SEER' }
  | { kind: 'WEREWOLF' }
  | { kind: 'WITCH-HEAL'; victimSid: string; victimName: string }
  | { kind: 'WITCH-POISON' }
  | { kind: 'DAY-VOTE' }
  | { kind: 'HUNTER' };

/** Public roster entry: alive/dead is public knowledge once announced. */
export type SnapshotPlayer = PlayerListItem & { isAlive: boolean };

type EventName = `${EventType}:${string}`;
type EventType =
  | 'lobby'
  | 'player'
  | 'alert'
  | 'night'
  | 'day'
  | 'game'
  | 'admin'
  | 'agent'
  | Lowercase<Role>;

export type WerewolvesVoteState = Record<string, number>;
export type GamePhase = SegmentType | 'LOBBY' | 'FINISHED';
/** What a client-visible countdown is for: a phase deadline, or the
 * day-discussion window that precedes the vote. */
export type CountdownPhase = GamePhase | 'DAY-DISCUSSION';
export type Countdown = { phase: CountdownPhase; remainingMs: number };
export type PlayerGameSnapshot = {
  phase: GamePhase;
  players: SnapshotPlayer[];
  self: Player;
  /** Own private lover info; never another player's. */
  loverName?: string;
  /** The action this player still owes the current phase, if any. */
  pendingPrompt?: PendingPrompt;
  /** Only present when the game is finished. */
  gameResult?: GameEndResult;
  /** Only present when the game is finished. */
  didWin?: boolean;
  /** The running deadline (or discussion window), when one is active. */
  countdown?: Countdown;
};
const serverEventSchemas = {
  'lobby:player-data': null as unknown as (player: Player) => void,
  'lobby:join-rejected': null as unknown as (reason: string) => void,
  'lobby:player-left': null as unknown as (playerName: string) => void,
  'lobby:player-died': null as unknown as (playerSid: string) => void,

  'lobby:update-players-list': null as unknown as (
    player: PlayerListItem
  ) => void,
  'lobby:players-list': null as unknown as (
    playersList: PlayerListItem[],
    requiredPlayerCount: number
  ) => void,
  'game:snapshot': null as unknown as (snapshot: PlayerGameSnapshot) => void,
  // The presented session token matched no player (server restarted, game
  // reset, or the player was removed): the client must forget the session
  'player:rejoin-failed': null as unknown as () => void,
  'game:phase-changed': null as unknown as (phase: GamePhase) => void,
  'game:countdown': null as unknown as (
    phase: CountdownPhase,
    remainingMs: number
  ) => void,
  'game:phase-timed-out': null as unknown as (phase: GamePhase) => void,
  // The server reset the game in place: every client must drop its local
  // game state and return to the join screen
  'game:restarted': null as unknown as () => void,
  'lobby:villagers-list': null as unknown as (
    villagers: PlayerListItem[]
  ) => void,

  'player:role-assigned': null as unknown as (role: Role) => void,
  'cupid:pick-required': null as unknown as () => void,

  'alert:player-is-lover': null as unknown as (loverName: string) => void,
  'alert:lovers-can-close-alert': null as unknown as () => void,
  'alert:player-is-dead': null as unknown as () => void,
  'alert:player-won': null as unknown as (result: GameEndResult) => void,
  'alert:player-lost': null as unknown as (result: GameEndResult) => void,
  'alert:action-error': null as unknown as (message: string) => void,

  'seer:pick-required': null as unknown as () => void,
  'seer:vision-result': null as unknown as (
    playerName: string,
    role: Role
  ) => void,

  'werewolf:pick-required': null as unknown as () => void,
  'werewolf:current-votes': null as unknown as (
    currentvotes: WerewolvesVoteState
  ) => void,
  'werewolf:voting-complete': null as unknown as () => void,
  'werewolf:player-update-vote': null as unknown as (
    targetPlayer: string,
    oldVote: string
  ) => void,

  'witch:can-heal': null as unknown as (playerSid: string) => void,
  'witch:pick-poison-player': null as unknown as () => void,

  // Night phase events
  'night:deaths-announced': null as unknown as (deaths: DeathInfo[]) => void,

  // Day phase events
  'day:voting-phase-start': null as unknown as () => void,
  'day:vote-tie': null as unknown as (tiedPlayerNames: string[]) => void,

  'hunter:pick-required': null as unknown as () => void,

  // TODO: remove this, temporary for testing
  'hunter:killed-player': null as unknown as (selectedPlayer: string) => void,
} satisfies Record<EventName, (...args: any[]) => void>;

export type ServerToClientEvents = typeof serverEventSchemas;

const clientEventSchemas = {
  'lobby:get-players-list': null as unknown as () => void,
  /** Agent/CLI protocol: request the complete private snapshot for this player. */
  'agent:get-state': null as unknown as (
    callback: (snapshot: PlayerGameSnapshot) => void
  ) => void,

  'player:join': null as unknown as (playerName: string) => void,
  'player:rejoin': null as unknown as (sessionToken: string) => void,
  // Play-again after a finished game; any player may trigger it
  'game:restart': null as unknown as () => void,

  // Admin/Dashboard events for testing
  'admin:start-game': null as unknown as () => void,
  'admin:next-segment': null as unknown as () => void,
  'admin:simulate-werewolf-vote': null as unknown as (
    targetPlayer: string
  ) => void,
  'admin:simulate-day-vote': null as unknown as (targetPlayer: string) => void,
  'admin:mock-hunter-event': null as unknown as () => void,
  'admin:mock-lover-event': null as unknown as () => void,
  'admin:mock-lover-second-hunter-event': null as unknown as () => void,
  'admin:mock-lover-is-hunter-event': null as unknown as () => void,
  'admin:mock-day-vote-hunter-event': null as unknown as () => void,
  'admin:mock-day-vote-lover-event': null as unknown as () => void,
  'admin:mock-day-vote-lover-is-hunter-event': null as unknown as () => void,
  'admin:mock-day-vote-lover-second-hunter-event':
    null as unknown as () => void,
  'admin:mock-hunter-revenge-kills-lover': null as unknown as () => void,

  'cupid:lovers-pick': null as unknown as (selectedPlayers: string[]) => void,
  'alert:lover-closed-alert': null as unknown as () => void,

  'seer:picked-player': null as unknown as (targetSid: string) => void,

  'werewolf:player-voted': null as unknown as (targetPlayer: string) => void,

  'witch:healed-player': null as unknown as () => void,
  'witch:poisoned-player': null as unknown as (targetPlayer: string) => void,
  'witch:skipped-heal': null as unknown as () => void,
  'witch:skipped-poison': null as unknown as () => void,

  'day:player-voted': null as unknown as (targetPlayer: string) => void,
  // Any living player may end the day discussion and open the vote
  'day:start-vote': null as unknown as () => void,
  'alert:hunter-died': null as unknown as () => void,
  'hunter:killed-player': null as unknown as (selectedPlayer: string) => void,

  //TODO: REMOVE THIS ONLY FOR TESTING
  'werewolf:current-votes': null as unknown as (
    currentvotes: WerewolvesVoteState
  ) => void,
  'werewolf:player-update-vote': null as unknown as (
    targetPlayer: string,
    oldVote: string
  ) => void,
} satisfies Record<EventName, (...args: any[]) => void>;

export type ClientToServerEvents = typeof clientEventSchemas;
