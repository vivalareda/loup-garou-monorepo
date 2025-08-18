import type {
  ClientToServerEvents,
  Player,
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
  playersList: string[];
  isConnected: boolean;
  status: 'disconnected' | 'waiting' | 'in-game';
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
};

function createPlayerSocket(
  id: string,
  name: string,
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

  socket.on('lobby:update-players-list', (newPlayer: string) => {
    console.log(`Player ${name} received new player:`, newPlayer);
    const currentPlayer = store.getState().players.get(id);
    const currentList = currentPlayer?.playersList || [];
    if (!currentList.includes(newPlayer)) {
      const updatedList = [...currentList, newPlayer];
      store.getState().updatePlayerData(id, { playersList: updatedList });
    }
  });

  socket.on('lobby:players-list', (playersList: string[]) => {
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

      set((state) => ({
        players: newPlayers,
        activePlayerId:
          state.activePlayerId === id
            ? newPlayers.size > 0
              ? Array.from(newPlayers.keys())[0]
              : null
            : state.activePlayerId,
      }));
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
    if (player && player.isConnected) {
      player.socket.disconnect();
    }
  },
}));
