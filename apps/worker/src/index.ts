import type { RoomInfo } from '@repo/types';
import { hasAccess } from './access-token';
import { newRoomCode } from './room-code';
import { isWebSocketUpgrade, routeRequest, upgradeRequired } from './room-route';

export { GameRoom } from './game-room';

/** `ACCESS_TOKEN` is a secret (or `--var`), so it is not in `Env`. */
type WorkerEnv = Env & { ACCESS_TOKEN?: string };

/** A fresh code colliding with a live room is all but impossible. */
const CREATE_ATTEMPTS = 5;

function roomStub(env: Env, code: string) {
  return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));
}

/**
 * The room API's answers are readable from any origin: the dashboard's
 * Vite dev server and Expo web call it cross-origin. They are "simple"
 * requests (no body, no custom header), so no preflight is needed.
 */
function apiResponse(body: RoomInfo | string, status: number) {
  const headers = { 'Access-Control-Allow-Origin': '*' };
  return typeof body === 'string'
    ? new Response(body, { status, headers })
    : Response.json(body, { status, headers });
}

/** `POST /rooms`: claims a fresh code in its Durable Object. */
async function createRoom(env: Env) {
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const code = newRoomCode();
    if (await roomStub(env, code).create()) {
      return apiResponse({ code }, 201);
    }
  }
  return apiResponse('Could not allocate a room code', 503);
}

/** `GET /rooms/<code>`: 200 for a live room, 404 otherwise. */
async function findRoom(env: Env, code: string) {
  return (await roomStub(env, code).exists())
    ? apiResponse({ code }, 200)
    : apiResponse('No such room', 404);
}

/**
 * Serves the room API (`POST /rooms`, `GET /rooms/<code>`, see wire.ts)
 * and routes `/room/<code>` WebSocket upgrades to that room's Durable
 * Object, which refuses codes that were never created. Bad codes, plain
 * requests to `/room/*` and (when `ACCESS_TOKEN` is set) a missing or
 * wrong `?token=` are refused here. The dashboard's static files are
 * served by the assets layer before the Worker runs; anything else that
 * reaches it is passed on to them.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = routeRequest(request.method, url.pathname);
    if (route.kind === 'other') {
      return env.ASSETS.fetch(request);
    }
    if (route.kind === 'bad-code') {
      return apiResponse(
        'Invalid room code: use 1-64 letters, digits, - or _',
        400
      );
    }
    if (route.kind === 'socket' && !isWebSocketUpgrade(request)) {
      return upgradeRequired();
    }
    if (!(await hasAccess(url, env.ACCESS_TOKEN))) {
      return apiResponse('Missing or wrong access token', 401);
    }
    switch (route.kind) {
      case 'create':
        return createRoom(env);
      case 'find':
        return findRoom(env, route.code);
      default:
        return roomStub(env, route.code).fetch(request);
    }
  },
} satisfies ExportedHandler<WorkerEnv>;
