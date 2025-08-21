import type {
  ClientToServerEvents,
  Player,
  PlayerListItem,
  Role,
  ServerToClientEvents,
} from '@repo/types';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { create } from 'zustand';

const BACKEND_URL =
  import.meta.env.VITE_PUBLIC_BACKEND_SERVER_URL || 'http://localhost:3000';

type MockPlayer = {
  id: string;
  name: string;
  socket: Socket;
  player: Player | null;
  playersList: PlayerListItem[];
  isConnected: boolean;
  status: 'disconnected' | 'waiting' | 'in-game';
  isLover: boolean;
  loverName: string | null;
  canCloseLoverAlert: boolean;
  isCupid: boolean;
  canSelectLovers: boolean;
  selectedLovers: string[];
};

type MockPlayerState = {
  players: Map<string, MockPlayer>;
  activePlayerId: string | null;
};

type MockPlayerStore = MockPlayerState & {
  addPlayer: (name: string) => void;
  removePlayer: (id: string) => void;
  setActivePlayer: (id: string) => void;
  updatePlayerData: (id: string, updates: Partial<MockPlayer>) => void;
  connectPlayer: (id: string) => void;
  disconnectPlayer: (id: string) => void;
  sendLoverClosedAlert: (id: string) => void;
  toggleLoverSelection: (playerId: string, loverName: string) => void;
  sendLoverSelection: (playerId: string) => void;
};

function createPlayerSocket(
  id: string,
  name: string,
  // biome-ignore lint/suspicious/noExplicitAny: <just for testing>
  store: any
): Socket<ClientToServerEvents, ServerToClientEvents> {
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    BACKEND_URL,
    {
      autoConnect: false,
      transports: ['websocket'],
    }
  );

  socket.on('connect', () => {
    console.log(`Player ${name} connected`);
    store.getState().updatePlayerData(id, {
      isConnected: true,
      status: 'waiting',
    });
  });

  socket.on('disconnect', () => {
    console.log(`Player ${name} disconnected`);
    store.getState().updatePlayerData(id, {
      isConnected: false,
      status: 'disconnected',
    });
  });

  // socket.on('player:joined', (playerData: Player) => {
  //   console.log(`Player ${name} sees player joined:`, playerData);
  //   store.getState().updatePlayerData(id, { player: playerData });
  // });

  socket.on('lobby:player-data', (playerData: Player) => {
    console.log(`Player ${name} received own player data:`, playerData);
    store.getState().updatePlayerData(id, { player: playerData });
  });

  socket.on('lobby:update-players-list', (newPlayer: PlayerListItem) => {
    console.log(`Player ${name} received new player:`, newPlayer);
    const currentPlayer = store.getState().players.get(id);
    const currentList = currentPlayer?.playersList || [];
    if (!currentList.some((p) => p.sid === newPlayer.sid)) {
      const updatedList = [...currentList, newPlayer];
      store.getState().updatePlayerData(id, { playersList: updatedList });
    }
  });

  socket.on('lobby:players-list', (playersList: PlayerListItem[]) => {
    console.log(`Player ${name} received full players list:`, playersList);
    store.getState().updatePlayerData(id, { playersList });
  });

  socket.on('player:role-assigned', (role: Role) => {
    console.log(`Player ${name} assigned role:`, role);
    const currentPlayer = store.getState().players.get(id);
    if (currentPlayer?.player && currentPlayer.player.type === 'waiting') {
      const gamePlayer: Player = {
        type: 'game',
        name: currentPlayer.player.name,
        sid: currentPlayer.player.sid,
        isAlive: true,
        role,
      };
      store.getState().updatePlayerData(id, {
        player: gamePlayer,
        status: 'in-game',
      });
    }
  });

  socket.on('alert:player-is-lover', (loverName: string) => {
    console.log(`Player ${name} is a lover with:`, loverName);
    store.getState().updatePlayerData(id, {
      isLover: true,
      loverName,
    });

    // Automatically send lover closed alert after receiving the notification
    setTimeout(() => {
      socket.emit('alert:lover-closed-alert');
      console.log(`Player ${name} automatically closed lover alert`);
    }, 1000); // Small delay to simulate reading the notification
  });

  socket.on('alert:lovers-can-close-alert', () => {
    console.log(`Player ${name} can close lover alert`);
    store.getState().updatePlayerData(id, {
      canCloseLoverAlert: true,
    });
  });

  socket.on('cupid:pick-required', () => {
    console.log(`Player ${name} (Cupid) needs to pick lovers`);
    store.getState().updatePlayerData(id, {
      isCupid: true,
      canSelectLovers: true,
    });
  });

  return socket;
}

export const useMockPlayerStore = create<MockPlayerStore>((set, get) => ({
  players: new Map(),
  activePlayerId: null,

  addPlayer: (name: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const store = { getState: get };
    const socket = createPlayerSocket(id, name, store);

    const newPlayer: MockPlayer = {
      id,
      name,
      socket,
      player: null,
      playersList: [],
      isConnected: false,
      status: 'disconnected',
      isLover: false,
      loverName: null,
      canCloseLoverAlert: false,
      isCupid: false,
      canSelectLovers: false,
      selectedLovers: [],
    };

    set((state) => ({
      players: new Map(state.players).set(id, newPlayer),
      activePlayerId: state.activePlayerId || id,
    }));

    setTimeout(
      () => {
        get().connectPlayer(id);
      },
      Math.random() * 200 + 100
    ); // Add random delay to prevent timing issues
  },

  removePlayer: (id: string) => {
    const { players } = get();
    const player = players.get(id);
    if (player) {
      player.socket.disconnect();
      const newPlayers = new Map(players);
      newPlayers.delete(id);

      set((state) => {
        let newActivePlayerId: string | null;
        if (state.activePlayerId === id) {
          newActivePlayerId =
            newPlayers.size > 0 ? Array.from(newPlayers.keys())[0] : null;
        } else {
          newActivePlayerId = state.activePlayerId;
        }
        return {
          players: newPlayers,
          activePlayerId: newActivePlayerId,
        };
      });
    }
  },

  setActivePlayer: (id: string) => {
    set({ activePlayerId: id });
  },

  updatePlayerData: (id: string, updates: Partial<MockPlayer>) => {
    set((state) => {
      const updatedPlayers = new Map(state.players);
      const player = updatedPlayers.get(id);
      if (player) {
        updatedPlayers.set(id, { ...player, ...updates });
      }
      return { players: updatedPlayers };
    });
  },

  connectPlayer: (id: string) => {
    const { players } = get();
    const player = players.get(id);
    if (player && !player.isConnected) {
      player.socket.connect();
      player.socket.once('connect', () => {
        player.socket.emit('player:join', player.name);
        setTimeout(() => {
          player.socket.emit('lobby:get-players-list');
        }, 100);
      });
    }
  },

  disconnectPlayer: (id: string) => {
    const { players } = get();
    const player = players.get(id);
    if (player?.isConnected) {
      player.socket.disconnect();
    }
  },

  sendLoverClosedAlert: (id: string) => {
    const { players } = get();
    const player = players.get(id);
    if (player?.isConnected && player.canCloseLoverAlert) {
      player.socket.emit('alert:lover-closed-alert');
      get().updatePlayerData(id, {
        canCloseLoverAlert: false,
      });
    }
  },

  toggleLoverSelection: (playerId: string, loverName: string) => {
    const { players } = get();
    const player = players.get(playerId);
    if (player?.canSelectLovers) {
      const currentSelection = [...player.selectedLovers];
      const isSelected = currentSelection.includes(loverName);

      if (isSelected) {
        const updatedSelection = currentSelection.filter(
          (name) => name !== loverName
        );
        get().updatePlayerData(playerId, { selectedLovers: updatedSelection });
      } else if (currentSelection.length < 2) {
        get().updatePlayerData(playerId, {
          selectedLovers: [...currentSelection, loverName],
        });
      }
    }
  },

  sendLoverSelection: (playerId: string) => {
    const { players } = get();
    const player = players.get(playerId);
    if (
      player?.isConnected &&
      player.canSelectLovers &&
      player.selectedLovers.length === 2
    ) {
      // Convert names to SIDs like the mobile app does
      const loversSid = player.selectedLovers.map((name) => {
        const foundPlayer = player.playersList.find((p) => p.name === name);
        if (!foundPlayer) {
          throw new Error(`Player with name ${name} not found in players list`);
        }
        return foundPlayer.sid;
      });

      console.log('Selected lovers (names):', player.selectedLovers);
      console.log('Selected lovers (SIDs):', loversSid);

      player.socket.emit('cupid:lovers-pick', loversSid);
      get().updatePlayerData(playerId, {
        canSelectLovers: false,
      });
    }
  },
}));
