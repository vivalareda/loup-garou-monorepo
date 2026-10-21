import { createRooms } from '@/hooks/room';
import { sessionRoom, sessionTokens } from '@/utils/session';
import { connectToRoom, createRoom, roomExists, socket } from '@/utils/sockets';

/** The app's rooms: the socket singleton and the device's own storage. */
export const rooms = createRooms(
  socket,
  { create: createRoom, exists: roomExists, connect: connectToRoom },
  sessionTokens,
  sessionRoom
);
