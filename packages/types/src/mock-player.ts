import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from './event';
import type { Player } from './player';
import type { PlayerListItem } from './player-utils';

export type MockPlayer = {
  id: string;
  name: string;
  socket: Socket<ClientToServerEvents, ServerToClientEvents>;
  player: Player | null;
  playersList: PlayerListItem[];
  isConnected: boolean;
  status: 'disconnected' | 'lobby' | 'in-game';
  isLover: boolean;
  loverName: string | null;
  canCloseLoverAlert: boolean;
  isCupid: boolean;
  canSelectLovers: boolean;
  selectedLovers: string[];
  showHealModal: boolean;
  showPoisonModal: boolean;
  werewolfVictimId: string | null;
  showDayVoteModal: boolean;
  dayVoteTarget: string | null;
  canVote: boolean;
};
