import { isWebSocketUpgrade, routeRoom, upgradeRequired } from './room-route';

export { GameRoom } from './game-room';

/**
 * Routes `/room/<code>` WebSocket upgrades to that room's Durable Object.
 * The dashboard's static files are served by the assets layer before the
 * Worker runs; anything else that reaches it is passed on to them.
 */
export default {
  fetch(request, env) {
    const route = routeRoom(new URL(request.url).pathname);
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
    const room = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(route.code));
    return room.fetch(request);
  },
} satisfies ExportedHandler<Env>;
