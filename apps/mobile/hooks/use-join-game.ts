import type { Player } from '@repo/types';
import { socket } from '@/utils/sockets';

/** Server rejection reasons, translated for the join screen. */
const JOIN_REJECTION_MESSAGES: Record<string, string> = {
  'Invalid name': 'Entrez un nom valide.',
  'Name already taken': 'Ce nom est déjà pris.',
  'Player already joined': 'Vous avez déjà rejoint la partie.',
  'Game is full': 'La partie est complète.',
  'Game already started': 'La partie a déjà commencé.',
};

export function translateJoinRejection(reason: string) {
  return (
    JOIN_REJECTION_MESSAGES[reason] ?? 'Impossible de rejoindre la partie.'
  );
}

/**
 * Trim and submit the player's name. Returns false (and emits nothing)
 * when the name is empty — the caller shows the validation message.
 */
export function submitJoin(name: string) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return false;
  }
  socket.emit('player:join', trimmedName);
  return true;
}

/**
 * Registers the join-response listeners and returns their cleanup.
 * Persistent `on` listeners (not `once`): a rejected join followed by a
 * retry must not stack a stale success handler per tap.
 */
export function registerJoinListeners(handlers: {
  onJoined: (player: Player) => void;
  onRejected: (message: string) => void;
}) {
  const onPlayerData = (player: Player) => {
    handlers.onJoined(player);
  };
  const onRejection = (reason: string) => {
    handlers.onRejected(translateJoinRejection(reason));
  };

  socket.on('lobby:player-data', onPlayerData);
  socket.on('lobby:join-rejected', onRejection);

  return () => {
    socket.off('lobby:player-data', onPlayerData);
    socket.off('lobby:join-rejected', onRejection);
  };
}
