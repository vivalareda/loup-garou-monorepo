export type { DeathCause, DeathInfo, PendingDeath } from './src/death';

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
  isValidPlayerCount,
  MAX_PLAYER_COUNT,
  MIN_PLAYER_COUNT,
  type Player,
  type PlayerGetters,
  type PlayerListItem,
  type PlayerSetters,
  type RevealedPlayer,
  type WaitingRoomPlayer,
} from './src/player';

export { getRoleDescription, type Role } from './src/role';

export type { SegmentType, segments } from './src/segment';

export {
  type AckFrame,
  type ClientEventFrame,
  type ClientFrame,
  DEFAULT_ROOM_CODE,
  type EventFrame,
  encodeFrame,
  type FrameData,
  isRoomCode,
  normalizeRoomCode,
  type PingFrame,
  type PongFrame,
  parseClientFrame,
  parseRoomPath,
  parseRoomsRequest,
  parseServerFrame,
  type RoomInfo,
  type RoomsRequest,
  roomsApiUrl,
  roomUrl,
  type ServerFrame,
} from './src/wire';
