import { hasAccess } from './access-token';
import { isWebSocketUpgrade, routeRoom, upgradeRequired } from './room-route';

export { GameRoom } from './game-room';

/** `ACCESS_TOKEN` is a secret (or `--var`), so it is not in `Env`. */
type WorkerEnv = Env & { ACCESS_TOKEN?: string };

/**
 * Routes `/room/<code>` WebSocket upgrades to that room's Durable Object.
 * Bad codes, plain requests and (when `ACCESS_TOKEN` is set) a missing or
 * wrong `?token=` are refused here, before any Durable Object exists.
 * The dashboard's static files are served by the assets layer before the
 * Worker runs; anything else that reaches it is passed on to them.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = routeRoom(url.pathname);
    if (route.kind === 'other') {
      return env.ASSETS.fetch(request);
    }
    if (route.kind === 'bad-code') {
      return new Response(
        'Invalid room code: use 1-64 letters, digits, - or _',
        { status: 400 }
      );
    }
    if (!isWebSocketUpgrade(request)) {
      return upgradeRequired();
    }
    if (!(await hasAccess(url, env.ACCESS_TOKEN))) {
      return new Response('Missing or wrong access token', { status: 401 });
    }
    const room = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(route.code));
    return room.fetch(request);
  },
} satisfies ExportedHandler<WorkerEnv>;
