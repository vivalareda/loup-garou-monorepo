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
export {
  type GamePlayer,
  isGamePlayer,
  isLobbyPlayer,
  type LobbyPlayer,
  type Player,
  type PlayerIdentity,
} from './src/player';
export { getRoleDescription, type Role } from './src/role';
export type {
  Segment,
  SegmentType,
  segments,
} from './src/segment';
