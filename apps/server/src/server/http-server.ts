import { createServer, type ServerResponse } from 'node:http';
import { DEFAULT_ROOM_CODE, parseRoomsRequest, type RoomInfo } from '@repo/types';

const SUCCESS_CODE = 200;

function sendRoom(res: ServerResponse, status: number, room: RoomInfo) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    // The dashboard's Vite dev server and Expo web run on other origins
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(room));
}

/**
 * The room API (wire.ts), for a server that hosts a single game: every
 * room code reaches it, so "creating" a room hands out DEFAULT_ROOM_CODE
 * and every valid code is found. Other plain requests get a health-check
 * answer; the game runs over the WebSocket upgrade handled in sockets.ts.
 */
const httpServer = createServer((req, res) => {
  const pathname = (req.url ?? '').split('?')[0] ?? '';
  const call = parseRoomsRequest(req.method ?? 'GET', pathname);
  if (call?.kind === 'create') {
    sendRoom(res, 201, { code: DEFAULT_ROOM_CODE });
    return;
  }
  if (call?.kind === 'find') {
    sendRoom(res, SUCCESS_CODE, { code: call.code });
    return;
  }
  res.writeHead(SUCCESS_CODE, { 'Content-Type': 'text/plain' });
  res.end('ok');
});

const PORT = process.env.PORT || '3000';

export function startServer() {
  httpServer.listen(Number.parseInt(PORT, 10), '0.0.0.0', () => {
    console.log(`Werewolf Game Server running on port ${PORT}`);
  });
}

export { httpServer };
