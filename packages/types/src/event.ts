/** biome-ignore-all lint/suspicious/noExplicitAny: <use of generics> */
import type { Player, PlayerListItem } from './player';
import type { Role } from './role';

type EventName = `${EventType}:${string}`;
type EventType = 'lobby' | 'player' | 'alert' | Lowercase<Role>;

const serverEventSchemas = {
  'lobby:player-data': null as unknown as (player: Player) => void,
  'lobby:player-left': null as unknown as (playerName: string) => void,

  'lobby:update-players-list': null as unknown as (
    player: PlayerListItem
  ) => void,
  'lobby:players-list': null as unknown as (
    playersList: PlayerListItem[]
  ) => void,
  'lobby:villagers-list': null as unknown as (villagers: string[]) => void,

  'player:role-assigned': null as unknown as (role: Role) => void,
  'cupid:pick-required': null as unknown as () => void,

  'alert:player-is-lover': null as unknown as (loverName: string) => void,
  'alert:lovers-can-close-alert': null as unknown as () => void,

  'werewolf:pick-required': null as unknown as () => void,
} satisfies Record<EventName, (...args: any[]) => void>;

export type ServerToClientEvents = typeof serverEventSchemas;

const clientEventSchemas = {
  'lobby:get-players-list': null as unknown as () => void,

  'player:join': null as unknown as (playerName: string) => void,

  'cupid:lovers-pick': null as unknown as (selectedPlayers: string[]) => void,
  'alert:lover-closed-alert': null as unknown as () => void,

  'werewolf:player-voted': null as unknown as (targetPlayer: string) => void,
} satisfies Record<EventName, (...args: any[]) => void>;

export type ClientToServerEvents = typeof clientEventSchemas;
