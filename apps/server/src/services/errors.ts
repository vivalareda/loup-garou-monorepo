import type { Role, SegmentType } from '@repo/types';
import { Data } from 'effect';

export class NameExistsError extends Data.TaggedError('NameExists')<{}> {
  override readonly message = 'Player name already exists';
}

export class LobbyFullError extends Data.TaggedError('LobbyFull')<{}> {
  override readonly message = 'Lobby is full';
}

export class PlayerNotFoundError extends Data.TaggedError(
  'PlayerNotFoundError'
)<{
  socketId: string;
}> {
  override readonly message;
  constructor(props: { socketId: string }) {
    super(props);
    this.message = `Player with socketId ${props.socketId} not found`;
  }
}

export class SpecialPlayerNotFoundError extends Data.TaggedError(
  'SpecialPlayerNotFoundError'
)<{
  role: Role;
}> {
  override readonly message;
  constructor(props: { role: Role }) {
    super(props);
    this.message = `Player with role ${props.role} not found`;
  }
}

export class InvalidSegmentIndex extends Data.TaggedError(
  'InvalidSegmentIndex'
)<{
  index: number;
  maxIndex: number;
}> {
  override readonly message;
  constructor(props: { index: number; maxIndex: number }) {
    super(props);
    this.message = `Invalid segment index: ${props.index} (max: ${props.maxIndex})`;
  }
}

export class SegmentNotFound extends Data.TaggedError('SegmentNotFound')<{
  type: SegmentType;
}> {
  override readonly message;
  constructor(props: { type: SegmentType }) {
    super(props);
    this.message = `Segment not found: ${props.type}`;
  }
}

export class AudioPlaybackError extends Data.TaggedError('AudioPlaybackError')<{
  file: string;
  error: unknown;
}> {
  override readonly message;
  constructor(props: { file: string; error: unknown }) {
    super(props);
    this.message = `Audio playback error for file ${props.file}`;
  }
}

export class HunterNotFoundError extends Data.TaggedError(
  'HunterNotFoundError'
)<{}> {
  override readonly message = 'Hunter player not found';
}

export class SegmentExecutionError extends Data.TaggedError(
  'SegmentExecutionError'
)<{
  segment: SegmentType;
  message: string;
}> {
  override readonly message;
  constructor(props: { segment: SegmentType; message: string }) {
    super(props);
    this.message = `Segment execution error in ${props.segment}: ${props.message}`;
  }
}

export class NotAWerewolfError extends Data.TaggedError('NotAWerewolfError')<{
  socketId: string;
}> {
  override readonly message;
  constructor(props: { socketId: string }) {
    super(props);
    this.message = `Player ${props.socketId} is not a werewolf`;
  }
}

export class InvalidWerewolfTargetError extends Data.TaggedError(
  'InvalidWerewolfTargetError'
)<{
  targetSid: string;
  reason: string;
}> {
  override readonly message;
  constructor(props: { targetSid: string; reason: string }) {
    super(props);
    this.message = `Target ${props.targetSid} is not valid: ${props.reason}`;
  }
}

export class VoteMismatchError extends Data.TaggedError('VoteMismatchError')<{
  expected: string;
  actual: string | undefined;
}> {
  override readonly message;
  constructor(props: { expected: string; actual: string | undefined }) {
    super(props);
    this.message = `Vote mismatch: expected ${props.expected}, but got ${props.actual}`;
  }
}

export class NoPlayersAvailableError extends Data.TaggedError(
  'NoPlayersAvailableError'
)<{}> {
  override readonly message = 'No players available';
}

export class NotEnoughPlayersError extends Data.TaggedError(
  'NotEnoughPlayersError'
)<{
  required: number;
  available: number;
}> {
  override readonly message;
  constructor(props: { required: number; available: number }) {
    super(props);
    this.message = `Need at least ${props.required} players, only ${props.available} available`;
  }
}

export class InvalidRoleError extends Data.TaggedError('InvalidRoleError')<{
  expected: Role;
  actual: Role | undefined;
}> {
  override readonly message;
  constructor(props: { expected: Role; actual: Role | undefined }) {
    super(props);
    this.message = `Expected role ${props.expected}, but got ${props.actual}`;
  }
}

export class WerewolfVictimNotFoundError extends Data.TaggedError(
  'WerewolfVictimNotFoundError'
)<{
  reason: string;
}> {
  override readonly message;
  constructor(props: { reason: string }) {
    super(props);
    this.message = `No werewolf victim found: ${props.reason}`;
  }
}

export class PlayerNotFoundErrorInQueue extends Data.TaggedError(
  'PlayerNotFoundErrorInQueue'
)<{
  playerId: string;
}> {
  override readonly message;
  constructor(props: { playerId: string }) {
    super(props);
    this.message = `Player ${props.playerId} not found in death queue`;
  }
}

export class HunterPlayerNotFoundError extends Data.TaggedError(
  'HunterPlayerNotFoundError'
)<{}> {
  override readonly message = 'Hunter player not found for revenge';
}

export class TargetPlayerNotFoundError extends Data.TaggedError(
  'TargetPlayerNotFoundError'
)<{
  targetSid: string;
}> {
  override readonly message;
  constructor(props: { targetSid: string }) {
    super(props);
    this.message = `Target player with sid ${props.targetSid} not found`;
  }
}

export class LoverNotFoundError extends Data.TaggedError('LoverNotFoundError')<{
  segment: SegmentType;
}> {
  override readonly message;
  constructor(props: { segment: SegmentType }) {
    super(props);
    this.message = `Lover not found in segment ${props.segment}`;
  }
}
