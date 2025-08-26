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
  type Player,
  type PlayerGetters,
  type PlayerListItem,
  type PlayerSetters,
  type WaitingRoomPlayer,
} from './src/player';
export { getRoleDescription, type Role } from './src/role';
export type {
  Segment,
  SegmentType,
  segments,
} from './src/segment';
