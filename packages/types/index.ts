export type {
  DeathCause,
  DeathInfo,
  PendingDeath,
} from './src/death';
export type {
  ClientToServerEvents,
  GamePhase,
  PendingPrompt,
  PlayerGameSnapshot,
  ServerToClientEvents,
  SnapshotPlayer,
  WerewolvesVoteState,
} from './src/event';
export {
  type GameEndResult,
  type GamePlayer,
  isGamePlayer,
  type Player,
  type PlayerGetters,
  type PlayerListItem,
  type PlayerSetters,
  type RevealedPlayer,
  type WaitingRoomPlayer,
} from './src/player';
export { getRoleDescription, type Role } from './src/role';
export type {
  Segment,
  SegmentType,
  segments,
} from './src/segment';
