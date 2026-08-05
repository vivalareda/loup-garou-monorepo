import type {
  CountdownPhase,
  DeathInfo,
  GameEndResult,
  GamePhase,
  PlayerListItem,
  Role,
  WerewolvesVoteState,
} from '@repo/types';
import { create } from 'zustand';
import { useModalStore } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { socket } from '@/utils/sockets';

/**
 * Modal types that present a given phase's prompt. When the server
 * abandons a phase by timeout, that phase's prompt is stale — the action
 * can no longer be accepted — so the modal must close.
 */
const PHASE_PROMPT_MODALS: Partial<Record<GamePhase, string[]>> = {
  CUPID: ['CUPID'],
  LOVERS: ['LOVER'],
  SEER: ['SEER', 'SEER-RESULT'],
  WEREWOLF: ['WEREWOLVES'],
  'WITCH-HEAL': ['WITCH-HEAL'],
  'WITCH-POISON': ['WITCH-POISON'],
  HUNTER: ['HUNTER'],
  DAY: ['DAY-VOTE'],
};

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
  currentPhase: GamePhase;
  nightDeaths: DeathInfo[];
  dayVoteTie: string[];
  isWaitingForPlayers: boolean;
  /** Players the lobby needs before the game auto-starts (from the server). */
  requiredPlayerCount: number | null;
  /** The werewolves' victim the witch may heal (SID from witch:can-heal). */
  werewolvesVictim: string | null;
  /** The Seer's latest vision (from seer:vision-result). */
  seerVision: { playerName: string; role: Role } | null;
  /** The running deadline, as a local-clock end timestamp. */
  countdown: { phase: CountdownPhase; endsAt: number } | null;
  /** The last phase the server resolved by timeout. */
  phaseTimedOut: GamePhase | null;
  /** Death redirect deferred because a modal was open at the time. */
  pendingRedirect: boolean;
  /** End-of-game reveal: winning faction plus every player's role. */
  gameResult: GameEndResult | null;
  /** Last server rejection (alert:action-error), shown as a banner. */
  actionError: string | null;
  /** The other lover's display name (alert:player-is-lover). */
  loverPartnerName: string | null;

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
  setCurrentPhase: (phase: GamePhase) => void;
  setNightDeaths: (deaths: DeathInfo[]) => void;
  setDayVoteTie: (names: string[]) => void;
  setWaitingForPlayers: (waiting: boolean) => void;
  setWerewolvesVictim: (victimSid: string | null) => void;
  setSeerVision: (vision: { playerName: string; role: Role } | null) => void;
  setCountdown: (
    countdown: { phase: CountdownPhase; endsAt: number } | null
  ) => void;
  setPhaseTimedOut: (phase: GamePhase | null) => void;
  setPendingRedirect: (pending: boolean) => void;
  setGameResult: (result: GameEndResult | null) => void;
  setActionError: (message: string | null) => void;
  setLoverPartnerName: (name: string | null) => void;
  updateVote: (targetPlayer: string) => void;
  sendVote: (targetPlayerSid: string) => void;
  resetVoting: () => void;
  /** Full reset back to the lobby (server emitted game:restarted). */
  resetGame: () => void;

  // Helper functions
  getPlayerNameFromSid: (socketId: string) => string;

  // Socket management
  initializeSocketListeners: () => void;
  cleanupSocketListeners: () => void;
};

/** Fresh copies every call so a reset never shares array references. */
const createInitialGameState = () => ({
  playersList: [] as PlayerListItem[],
  villagersList: [] as PlayerListItem[],
  roleAssigned: null,
  werewolfVotes: {} as WerewolvesVoteState,
  playerVote: '',
  isVotingComplete: false,
  votingResult: null,
  currentPhase: 'LOBBY' as GamePhase,
  nightDeaths: [] as DeathInfo[],
  dayVoteTie: [] as string[],
  isWaitingForPlayers: false,
  requiredPlayerCount: null,
  werewolvesVictim: null,
  seerVision: null,
  countdown: null,
  phaseTimedOut: null,
  pendingRedirect: false,
  gameResult: null,
  actionError: null,
  loverPartnerName: null,
});

export const useGameStore = create<GameState>((set, get) => ({
  ...createInitialGameState(),

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
  setCurrentPhase: (phase) => set({ currentPhase: phase }),
  setNightDeaths: (deaths) => set({ nightDeaths: deaths }),
  setDayVoteTie: (names) => set({ dayVoteTie: names }),
  setWaitingForPlayers: (waiting) => set({ isWaitingForPlayers: waiting }),
  setWerewolvesVictim: (victimSid) => set({ werewolvesVictim: victimSid }),
  setSeerVision: (vision) => set({ seerVision: vision }),
  setCountdown: (countdown) => set({ countdown }),
  setPhaseTimedOut: (phase) => set({ phaseTimedOut: phase }),
  setPendingRedirect: (pending) => set({ pendingRedirect: pending }),
  setGameResult: (result) => set({ gameResult: result }),
  setActionError: (message) => set({ actionError: message }),
  setLoverPartnerName: (name) => set({ loverPartnerName: name }),

  updateVote: (targetPlayer: string) => {
    const { playerVote } = get();
    const oldVote = playerVote;

    set({ playerVote: targetPlayer, isWaitingForPlayers: true });
    console.log('updating vote', targetPlayer, oldVote);
    socket.emit('werewolf:player-update-vote', targetPlayer, oldVote);
  },

  sendVote: (targetPlayerSid: string) => {
    const { playerVote, updateVote } = get();

    if (playerVote) {
      updateVote(targetPlayerSid);
      return;
    }

    set({ playerVote: targetPlayerSid, isWaitingForPlayers: true });
    socket.emit('werewolf:player-voted', targetPlayerSid);
  },

  resetVoting: () => {
    set({
      isVotingComplete: false,
      votingResult: null,
      playerVote: '',
      werewolfVotes: {},
      dayVoteTie: [],
    });
  },

  resetGame: () => set(createInitialGameState()),

  // Socket management
  initializeSocketListeners: () => {
    // Existing socket listeners
    socket.on('lobby:players-list', (players, requiredPlayerCount) => {
      set(() => {
        const { player } = usePlayerStore.getState();
        return {
          playersList: players.filter((p) => p.socketId !== player?.socketId),
          requiredPlayerCount,
        };
      });
    });

    socket.on('lobby:update-players-list', (newPlayer) => {
      set((state) => ({ playersList: [...state.playersList, newPlayer] }));
    });

    socket.on('lobby:player-died', (playerSid) => {
      set((state) => ({
        playersList: state.playersList.filter((p) => p.socketId !== playerSid),
        villagersList: state.villagersList.filter(
          (p) => p.socketId !== playerSid
        ),
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

    socket.on('game:phase-changed', (phase) => {
      set({
        currentPhase: phase,
        dayVoteTie: [],
        isWaitingForPlayers: false,
        countdown: null,
      });
    });

    socket.on('game:countdown', (phase, remainingMs) => {
      set({ countdown: { phase, endsAt: Date.now() + remainingMs } });
    });

    socket.on('game:phase-timed-out', (phase) => {
      set({ phaseTimedOut: phase });
      // The server already applied the fallback: this phase's prompt can no
      // longer be answered, so don't leave its modal actionable on screen.
      const { modalState, closeModal } = useModalStore.getState();
      if (
        modalState.open &&
        PHASE_PROMPT_MODALS[phase]?.includes(modalState.type)
      ) {
        closeModal();
      }
    });

    socket.on('night:deaths-announced', (deaths) => {
      set({ nightDeaths: deaths });
    });

    socket.on('day:vote-tie', (tiedPlayerNames) => {
      set({ dayVoteTie: tiedPlayerNames });
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
    socket.off('game:phase-changed');
    socket.off('game:countdown');
    socket.off('game:phase-timed-out');
    socket.off('night:deaths-announced');
    socket.off('day:vote-tie');
  },

  getPlayerNameFromSid: (socketId: string) => {
    const { playersList } = get();
    const foundPlayer = playersList.find((p) => p.socketId === socketId);
    if (!foundPlayer) {
      // Called from render paths: a dead player pruned from the roster may
      // still be referenced by an open modal, and a throw here unmounts the
      // whole app. Show a placeholder instead.
      return 'Joueur inconnu';
    }
    return foundPlayer.name;
  },
}));
