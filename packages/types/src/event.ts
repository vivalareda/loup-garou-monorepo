import type { DeathInfo } from './death';
import type { Player, PlayerIdentity } from './player';
import type { Role } from './role';
import type { SegmentType } from './segment';

export type WerewolvesVoteState = Record<string, number>;

export type ServerToClientEvents = {
  'lobby:player-data': (player: Player) => void;
  'lobby:player-left': (playerName: string) => void;
  'lobby:player-died': (playerSid: string) => void;
  'lobby:update-players-list': (player: Player) => void;
  'lobby:players-list': (playersList: PlayerIdentity[]) => void;
  'lobby:villagers-list': (villagers: Player[]) => void;
  'lobby:start-game': () => void;

  'player:role-assigned': (role: Role) => void;
  'cupid:pick-required': () => void;

  'alert:player-is-lover': (loverName: string) => void;
  'alert:lovers-can-close-alert': () => void;
  'alert:player-is-dead': () => void;
  'alert:player-won': () => void;
  'alert:player-lost': () => void;

  'werewolf:pick-required': () => void;
  'werewolf:current-votes': (currentvotes: WerewolvesVoteState) => void;
  'werewolf:voting-complete': () => void;
  'werewolf:player-update-vote': (
    targetPlayer: string,
    oldVote: string
  ) => void;

  'witch:can-heal': (playerSid: string) => void;
  'witch:pick-poison-player': () => void;

  'night:deaths-announced': (deaths: DeathInfo[]) => void;
  'day:voting-phase-start': () => void;

  'hunter:pick-required': () => void;
  'hunter:killed-player': (selectedPlayer: string) => void;

  error: (message: string) => void;
};

export type ClientToServerEvents = {
  'lobby:get-players-list': () => void;
  'player:join': (playerName: string) => void;
  'lobby:start-game': () => void;
  'lobby:start-mock': (segment: SegmentType) => void;

  'admin:start-game': () => void;
  'admin:next-segment': () => void;
  'admin:simulate-werewolf-vote': (targetPlayer: string) => void;
  'admin:simulate-day-vote': (targetPlayer: string) => void;
  'admin:mock-hunter-event': () => void;
  'admin:mock-lover-event': () => void;
  'admin:mock-lover-second-hunter-event': () => void;
  'admin:mock-lover-is-hunter-event': () => void;
  'admin:mock-day-vote-hunter-event': () => void;
  'admin:mock-day-vote-lover-event': () => void;
  'admin:mock-day-vote-lover-is-hunter-event': () => void;
  'admin:mock-day-vote-lover-second-hunter-event': () => void;

  'cupid:lovers-pick': (selectedPlayers: string[]) => void;
  'alert:lover-closed-alert': () => void;

  'werewolf:player-voted': (targetPlayer: string) => void;
  'werewolf:current-votes': (currentvotes: WerewolvesVoteState) => void;
  'werewolf:player-update-vote': (
    targetPlayer: string,
    oldVote: string
  ) => void;

  'witch:healed-player': () => void;
  'witch:poisoned-player': (targetPlayer: string) => void;
  'witch:skipped-heal': () => void;
  'witch:skipped-poison': () => void;

  'day:player-voted': (targetPlayer: string) => void;
  'alert:hunter-died': () => void;
  'hunter:killed-player': (selectedPlayer: string) => void;
  'mocksegment:setup': (segment: SegmentType) => void;
};
