/** biome-ignore-all lint/suspicious/noExplicitAny: <use of generics> */
import type { Player } from './player';
import type { Role } from './role';

type EventName = `${EventType}:${string}`;
type EventType = 'lobby' | 'player' | 'action' | 'alert' | Lowercase<Role>;

const serverEventSchemas = {
  'lobby:player-data': null as unknown as (player: Player) => void,
  'lobby:player-left': null as unknown as (playerName: string) => void,
  'lobby:update-players-list': null as unknown as (newPlayer: string) => void,
  'lobby:players-list': null as unknown as (playersList: string[]) => void,

  'player:role-assigned': null as unknown as (role: Role) => void,
  'action:cupid-pick-required': null as unknown as () => void,

  'alert:player-is-lover': null as unknown as (loverName: string) => void,
} satisfies Record<EventName, (...args: any[]) => void>;

export type ServerToClientEvents = typeof serverEventSchemas;

const clientEventSchemas = {
  'lobby:get-players-list': null as unknown as () => void,

  'player:join': null as unknown as (playerName: string) => void,

  'cupid:lovers-pick': null as unknown as (selectedPlayers: string[]) => void,
};

export type ClientToServerEvents = typeof clientEventSchemas;
