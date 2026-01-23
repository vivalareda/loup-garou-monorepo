export type {
  DeathCause,
  DeathInfo,
  PendingDeath,
} from './src/death';
export type {
  ClientToServerEvents,
  ServerToClientEvents,
  WerewolvesVoteState,
} from './src/event';
export type { MockPlayer } from './src/mock-player';
export {
  type GamePlayer,
  isGamePlayer,
  isLobbyPlayer,
  type LobbyPlayer,
  type Player,
  type PlayerIdentity,
} from './src/player';
export type { PlayerListItem, WaitingRoomPlayer } from './src/player-utils';
export { getRoleDescription, type Role } from './src/role';
export type {
  Segment,
  SegmentType,
  segments,
} from './src/segment';
