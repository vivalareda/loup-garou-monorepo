export type {
  DeathCause,
  DeathInfo,
  PendingDeath,
} from './src/death';
export {
  type ClientToServerEvents,
  type Countdown,
  type CountdownPhase,
  type GamePhase,
  isClientEvent,
  isServerEvent,
  type PendingPrompt,
  type PlayerGameSnapshot,
  type ServerToClientEvents,
  type SnapshotPlayer,
  type WerewolvesVoteState,
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
export {
  type AckFrame,
  type ClientFrame,
  DEFAULT_ROOM_CODE,
  type EventFrame,
  encodeFrame,
  isRoomCode,
  parseClientFrame,
  parseRoomPath,
  parseServerFrame,
  roomUrl,
  type ServerFrame,
} from './src/wire';
