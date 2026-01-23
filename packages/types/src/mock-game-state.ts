import type { WerewolvesVoteState } from './event';
import type { PlayerListItem } from './player-utils';
import type { Role } from './role';

export type MockGameState = {
  playersList: PlayerListItem[];
  villagersList: PlayerListItem[];
  roleAssigned: Role | null;
  werewolfVotes: WerewolvesVoteState;
  playerVote: string;
  isVotingComplete: boolean;
  votingResult: string | null;
};
