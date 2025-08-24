/** biome-ignore-all lint/suspicious/noExplicitAny: <use of generics> */

import type { DeathInfo } from './death';
import type { Player, PlayerListItem } from './player';
import type { Role } from './role';

type EventName = `${EventType}:${string}`;
type EventType =
  | 'lobby'
  | 'player'
  | 'alert'
  | 'night'
  | 'day'
  | 'admin'
  | Lowercase<Role>;

export type WerewolvesVoteState = Record<string, number>;
const serverEventSchemas = {
  'lobby:player-data': null as unknown as (player: Player) => void,
  'lobby:player-left': null as unknown as (playerName: string) => void,

  'lobby:update-players-list': null as unknown as (
    player: PlayerListItem
  ) => void,
  'lobby:players-list': null as unknown as (
    playersList: PlayerListItem[]
  ) => void,
  'lobby:villagers-list': null as unknown as (
    villagers: PlayerListItem[]
  ) => void,

  'player:role-assigned': null as unknown as (role: Role) => void,
  'cupid:pick-required': null as unknown as () => void,

  'alert:player-is-lover': null as unknown as (loverName: string) => void,
  'alert:lovers-can-close-alert': null as unknown as () => void,

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
} satisfies Record<EventName, (...args: any[]) => void>;

export type ServerToClientEvents = typeof serverEventSchemas;

const clientEventSchemas = {
  'lobby:get-players-list': null as unknown as () => void,

  'player:join': null as unknown as (playerName: string) => void,

  // Admin/Dashboard events for testing
  'admin:start-game': null as unknown as () => void,
  'admin:next-segment': null as unknown as () => void,
  'admin:simulate-werewolf-vote': null as unknown as (
    targetPlayer: string
  ) => void,
  'admin:simulate-day-vote': null as unknown as (targetPlayer: string) => void,

  'cupid:lovers-pick': null as unknown as (selectedPlayers: string[]) => void,
  'alert:lover-closed-alert': null as unknown as () => void,

  'werewolf:player-voted': null as unknown as (targetPlayer: string) => void,

  'witch:healed-player': null as unknown as () => void,
  'witch:poisoned-player': null as unknown as (targetPlayer: string) => void,
  'witch:skipped-heal': null as unknown as () => void,
  'witch:skipped-poison': null as unknown as () => void,

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
