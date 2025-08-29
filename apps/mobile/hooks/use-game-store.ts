import type { PlayerListItem, Role, WerewolvesVoteState } from '@repo/types';
import { create } from 'zustand';
import { usePlayerStore } from '@/hooks/use-player-store';
import { socket } from '@/utils/sockets';

type GameState = {
  // Existing state
  playersList: PlayerListItem[];
  villagersList: PlayerListItem[];
  roleAssigned: Role | null;

  // Werewolf voting state
  werewolfVotes: WerewolvesVoteState;
  playerVote: string;
  isVotingComplete: boolean;
  votingResult: string | null;

  // Existing actions
  setRoleAssigned: (role: Role) => void;
  setPlayersList: (players: PlayerListItem[]) => void;
  addPlayer: (player: PlayerListItem) => void;
  setVillagersList: (villagers: PlayerListItem[]) => void;

  // Werewolf voting actions
  setWerewolfVotes: (votes: WerewolvesVoteState) => void;
  setPlayerVote: (vote: string) => void;
  setVotingComplete: (complete: boolean) => void;
  setVotingResult: (result: string | null) => void;
  updateVote: (targetPlayer: string) => void;
  sendVote: (targetPlayerSid: string) => void;
  resetVoting: () => void;

  // Helper functions
  getPlayerNameFromSid: (socketId: string) => string;

  // Socket management
  initializeSocketListeners: () => void;
  cleanupSocketListeners: () => void;
};

export const useGameStore = create<GameState>((set, get) => ({
  // Existing state
  playersList: [],
  roleAssigned: null,
  villagersList: [],

  // Werewolf voting state
  werewolfVotes: {},
  playerVote: '',
  isVotingComplete: false,
  votingResult: null,

  // Existing actions
  setRoleAssigned: (role: Role) =>
    set(() => ({
      roleAssigned: role,
    })),
  setPlayersList: (players: PlayerListItem[]) =>
    set(() => ({
      playersList: players,
    })),
  addPlayer: (player: PlayerListItem) =>
    set((state) => ({
      playersList: [...state.playersList, player],
    })),
  setVillagersList: (villagers: PlayerListItem[]) =>
    set(() => ({
      villagersList: villagers,
    })),

  // Werewolf voting actions
  setWerewolfVotes: (votes) => set({ werewolfVotes: votes }),
  setPlayerVote: (vote) => set({ playerVote: vote }),
  setVotingComplete: (complete) => set({ isVotingComplete: complete }),
  setVotingResult: (result) => set({ votingResult: result }),

  updateVote: (targetPlayer: string) => {
    const { playerVote } = get();
    const oldVote = playerVote;

    set({ playerVote: targetPlayer });
    console.log('updating vote', targetPlayer, oldVote);
    socket.emit('werewolf:player-update-vote', targetPlayer, oldVote);
  },

  sendVote: (targetPlayerSid: string) => {
    const { playerVote, updateVote } = get();

    if (playerVote) {
      updateVote(targetPlayerSid);
      return;
    }

    set({ playerVote: targetPlayerSid });
    socket.emit('werewolf:player-voted', targetPlayerSid);
  },

  resetVoting: () => {
    set({
      isVotingComplete: false,
      votingResult: null,
      playerVote: '',
      werewolfVotes: {},
    });
  },

  // Socket management
  initializeSocketListeners: () => {
    // Existing socket listeners
    socket.on('lobby:players-list', (players: PlayerListItem[]) => {
      set(() => {
        const { player } = usePlayerStore.getState();
        return {
          playersList: players.filter((p) => p.socketId !== player?.socketId),
        };
      });
    });

    socket.on('lobby:update-players-list', (newPlayer) => {
      set((state) => ({ playersList: [...state.playersList, newPlayer] }));
    });

    socket.on('lobby:player-died', (playerSid) => {
      set((state) => ({
        playersList: state.playersList.filter((p) => p.socketId !== playerSid),
      }));
    });

    socket.on('player:role-assigned', (role) => {
      set({ roleAssigned: role });
      // Update player store with the assigned role
      usePlayerStore.getState().setRole(role);
    });

    socket.on('lobby:villagers-list', (villagers) => {
      set({ villagersList: villagers });
    });

    // Werewolf voting listeners
    socket.on('werewolf:current-votes', (currentVotes) => {
      console.log('Received current votes:', currentVotes);
      set({ werewolfVotes: currentVotes });
    });

    socket.on('werewolf:voting-complete', () => {
      set({ isVotingComplete: true });
    });
  },

  cleanupSocketListeners: () => {
    socket.off('lobby:players-list');
    socket.off('lobby:update-players-list');
    socket.off('lobby:player-died');
    socket.off('player:role-assigned');
    socket.off('lobby:villagers-list');
    socket.off('werewolf:current-votes');
    socket.off('werewolf:voting-complete');
  },

  getPlayerNameFromSid: (socketId: string) => {
    const { playersList } = get();
    const foundPlayer = playersList.find((p) => p.socketId === socketId);
    if (!foundPlayer) {
      throw new Error(`player with socketId ${socketId} not found`);
    }
    return foundPlayer.name;
  },
}));
