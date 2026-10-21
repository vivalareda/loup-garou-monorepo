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
  | 'narrator'
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

/**
 * Checks an event map at compile time: every name is `<type>:<action>` and
 * every handler is a function. Resolves to the map itself.
 */
type EventMap<
  Events extends {
    [Name in keyof Events]: Name extends EventName
      ? (...args: never[]) => void
      : never;
  },
> = Events;

export type ServerToClientEvents = EventMap<{
  'lobby:player-data': (player: Player) => void;
  'lobby:join-rejected': (reason: string) => void;
  'lobby:player-left': (playerName: string) => void;
  'lobby:player-died': (playerSid: string) => void;

  'lobby:update-players-list': (player: PlayerListItem) => void;
  // The full lobby: who joined, how many players start the game, and the
  // host (the earliest joined player, who sets that count), if anyone joined
  'lobby:players-list': (
    playersList: PlayerListItem[],
    requiredPlayerCount: number,
    hostSocketId: string | null
  ) => void;
  'game:snapshot': (snapshot: PlayerGameSnapshot) => void;
  // The presented session token matched no player (server restarted, game
  // reset, or the player was removed): the client must forget the session
  'player:rejoin-failed': () => void;
  'game:phase-changed': (phase: GamePhase) => void;
  'game:countdown': (phase: CountdownPhase, remainingMs: number) => void;
  'game:phase-timed-out': (phase: GamePhase) => void;
  // The server reset the game in place: every client must drop its local
  // game state and return to the join screen
  'game:restarted': () => void;
  'lobby:villagers-list': (villagers: PlayerListItem[]) => void;

  'player:role-assigned': (role: Role) => void;
  'cupid:pick-required': () => void;

  'alert:player-is-lover': (loverName: string) => void;
  'alert:lovers-can-close-alert': () => void;
  'alert:player-is-dead': () => void;
  'alert:player-won': (result: GameEndResult) => void;
  'alert:player-lost': (result: GameEndResult) => void;
  'alert:action-error': (message: string) => void;

  'seer:pick-required': () => void;
  'seer:vision-result': (playerName: string, role: Role) => void;

  'werewolf:pick-required': () => void;
  'werewolf:current-votes': (currentvotes: WerewolvesVoteState) => void;
  'werewolf:voting-complete': () => void;
  'werewolf:player-update-vote': (
    targetPlayer: string,
    oldVote: string
  ) => void;

  'witch:can-heal': (playerSid: string) => void;
  'witch:pick-poison-player': () => void;

  // Night phase events
  'night:deaths-announced': (deaths: DeathInfo[]) => void;

  // Day phase events
  'day:voting-phase-start': () => void;
  'day:vote-tie': (tiedPlayerNames: string[]) => void;

  'hunter:pick-required': () => void;

  // TODO: remove this, temporary for testing
  'hunter:killed-player': (selectedPlayer: string) => void;

  // Sent only to the registered narrator; it answers `narrator:done`
  'narrator:play': (clipId: string, clip: string) => void;
}>;

export type ClientToServerEvents = EventMap<{
  'lobby:get-players-list': () => void;
  /** Agent/CLI protocol: request the complete private snapshot for this player. */
  'agent:get-state': (callback: (snapshot: PlayerGameSnapshot) => void) => void;

  'player:join': (playerName: string) => void;
  // Host only, in the lobby: the game starts once this many players joined
  // (at once if they already have). MIN_PLAYER_COUNT..MAX_PLAYER_COUNT
  'lobby:set-player-count': (count: number) => void;
  'player:rejoin': (sessionToken: string) => void;
  // Play-again after a finished game; any player may trigger it
  'game:restart': () => void;

  // Admin/Dashboard events for testing
  'admin:start-game': () => void;
  'admin:next-segment': () => void;
  'admin:simulate-werewolf-vote': (targetPlayer: string) => void;
  'admin:simulate-day-vote': (targetPlayer: string) => void;
  'admin:mock-hunter-event': () => void;
  'admin:mock-lover-event': () => void;
  'admin:mock-lover-second-hunter-event': () => void;
  'admin:mock-lover-is-hunter-event': () => void;
  'admin:mock-day-vote-hunter-event': () => void;
  'admin:mock-day-vote-lover-event': () => void;
  'admin:mock-day-vote-lover-is-hunter-event': () => void;
  'admin:mock-day-vote-lover-second-hunter-event': () => void;
  'admin:mock-hunter-revenge-kills-lover': () => void;

  // A dashboard takes over playing the narration clips
  'narrator:register': () => void;
  'narrator:done': (clipId: string) => void;

  'cupid:lovers-pick': (selectedPlayers: string[]) => void;
  'alert:lover-closed-alert': () => void;

  'seer:picked-player': (targetSid: string) => void;

  'werewolf:player-voted': (targetPlayer: string) => void;

  'witch:healed-player': () => void;
  'witch:poisoned-player': (targetPlayer: string) => void;
  'witch:skipped-heal': () => void;
  'witch:skipped-poison': () => void;

  'day:player-voted': (targetPlayer: string) => void;
  // Any living player may end the day discussion and open the vote
  'day:start-vote': () => void;
  'alert:hunter-died': () => void;
  'hunter:killed-player': (selectedPlayer: string) => void;

  //TODO: REMOVE THIS ONLY FOR TESTING
  'werewolf:current-votes': (currentvotes: WerewolvesVoteState) => void;
  'werewolf:player-update-vote': (
    targetPlayer: string,
    oldVote: string
  ) => void;
}>;

/*
 * The event names at runtime. Typed as a record over the event map's keys,
 * so a name missing from (or extra to) its map fails typecheck.
 */
const serverEventNames: Record<keyof ServerToClientEvents, true> = {
  'lobby:player-data': true,
  'lobby:join-rejected': true,
  'lobby:player-left': true,
  'lobby:player-died': true,
  'lobby:update-players-list': true,
  'lobby:players-list': true,
  'game:snapshot': true,
  'player:rejoin-failed': true,
  'game:phase-changed': true,
  'game:countdown': true,
  'game:phase-timed-out': true,
  'game:restarted': true,
  'lobby:villagers-list': true,
  'player:role-assigned': true,
  'cupid:pick-required': true,
  'alert:player-is-lover': true,
  'alert:lovers-can-close-alert': true,
  'alert:player-is-dead': true,
  'alert:player-won': true,
  'alert:player-lost': true,
  'alert:action-error': true,
  'seer:pick-required': true,
  'seer:vision-result': true,
  'werewolf:pick-required': true,
  'werewolf:current-votes': true,
  'werewolf:voting-complete': true,
  'werewolf:player-update-vote': true,
  'witch:can-heal': true,
  'witch:pick-poison-player': true,
  'night:deaths-announced': true,
  'day:voting-phase-start': true,
  'day:vote-tie': true,
  'hunter:pick-required': true,
  'hunter:killed-player': true,
  'narrator:play': true,
};

const clientEventNames: Record<keyof ClientToServerEvents, true> = {
  'lobby:get-players-list': true,
  'agent:get-state': true,
  'player:join': true,
  'lobby:set-player-count': true,
  'player:rejoin': true,
  'game:restart': true,
  'admin:start-game': true,
  'admin:next-segment': true,
  'admin:simulate-werewolf-vote': true,
  'admin:simulate-day-vote': true,
  'admin:mock-hunter-event': true,
  'admin:mock-lover-event': true,
  'admin:mock-lover-second-hunter-event': true,
  'admin:mock-lover-is-hunter-event': true,
  'admin:mock-day-vote-hunter-event': true,
  'admin:mock-day-vote-lover-event': true,
  'admin:mock-day-vote-lover-is-hunter-event': true,
  'admin:mock-day-vote-lover-second-hunter-event': true,
  'admin:mock-hunter-revenge-kills-lover': true,
  'narrator:register': true,
  'narrator:done': true,
  'cupid:lovers-pick': true,
  'alert:lover-closed-alert': true,
  'seer:picked-player': true,
  'werewolf:player-voted': true,
  'witch:healed-player': true,
  'witch:poisoned-player': true,
  'witch:skipped-heal': true,
  'witch:skipped-poison': true,
  'day:player-voted': true,
  'day:start-vote': true,
  'alert:hunter-died': true,
  'hunter:killed-player': true,
  'werewolf:current-votes': true,
  'werewolf:player-update-vote': true,
};

const serverEventNameSet: ReadonlySet<unknown> = new Set(
  Object.keys(serverEventNames)
);

const clientEventNameSet: ReadonlySet<unknown> = new Set(
  Object.keys(clientEventNames)
);

/** Runtime guard for an event name a client may send. */
export function isClientEvent(
  name: unknown
): name is keyof ClientToServerEvents {
  return clientEventNameSet.has(name);
}

/** Runtime guard for an event name the server may send. */
export function isServerEvent(
  name: unknown
): name is keyof ServerToClientEvents {
  return serverEventNameSet.has(name);
}
