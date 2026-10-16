import { describe, expect, it } from 'vitest';
import { createGameRuntime } from '@/game-runtime';
import { silentNarrator } from '@/segments/narrator';
import { DashboardNarrator } from '@/server/dashboard-narrator';
import { WebSocketHost, type WebSocketLike } from '@/server/websocket-host';

type Frame = { event?: string; args?: unknown[] };
type Listener = (event: { data: unknown }) => void;

function ignoreClose() {
  // The host closes sockets it drops; nothing to do for a fake
}

/** A connected client socket: the test sends frames, the host's are kept. */
function fakeSocket() {
  const listeners = new Map<string, Listener[]>();
  const frames: Frame[] = [];
  const socket: WebSocketLike = {
    readyState: 1,
    send: (data) => frames.push(JSON.parse(data) as Frame),
    close: ignoreClose,
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
  };
  const fire = (type: string, data?: unknown) => {
    for (const listener of listeners.get(type) ?? []) {
      listener({ data });
    }
  };
  return {
    socket,
    frames,
    send: (event: string, ...args: unknown[]) =>
      fire('message', JSON.stringify({ event, args })),
    drop: () => fire('close'),
  };
}

const newHost = () => new WebSocketHost({ idleTimeoutMs: 0 });

describe('createGameRuntime', () => {
  it('wires a dashboard narrator to the client that registers', async () => {
    const host = newHost();
    const narrator = new DashboardNarrator(host);
    createGameRuntime({ host, narrator });
    const dashboard = fakeSocket();
    host.accept(dashboard.socket);

    dashboard.send('narrator:register');
    let finished = false;
    const playing = narrator.play('Werewolves/Werewolves-1').then(() => {
      finished = true;
    });
    expect(dashboard.frames).toContainEqual({
      event: 'narrator:play',
      args: ['0', 'Werewolves/Werewolves-1'],
    });
    await Promise.resolve();
    expect(finished).toBe(false);

    dashboard.send('narrator:done', '0');
    await playing;
    expect(finished).toBe(true);
  });

  it('stops narrating to a dashboard that disconnects', async () => {
    const host = newHost();
    const narrator = new DashboardNarrator(host);
    createGameRuntime({ host, narrator });
    const dashboard = fakeSocket();
    host.accept(dashboard.socket);
    dashboard.send('narrator:register');

    const playing = narrator.play('clip');
    dashboard.drop();
    await playing;
    await narrator.play('next');
    expect(
      dashboard.frames.filter((frame) => frame.event === 'narrator:play')
    ).toHaveLength(1);
  });

  it('serves the lobby and resets the game in place', () => {
    const host = newHost();
    const runtime = createGameRuntime({ host, narrator: silentNarrator });
    const player = fakeSocket();
    host.accept(player.socket);

    player.send('player:join', 'Alice');
    expect(player.frames[0]).toMatchObject({ event: 'lobby:player-data' });
    expect(runtime.game.getPlayerList().size).toBe(1);

    runtime.reset();
    expect(runtime.game.getPlayerList().size).toBe(0);
    expect(player.frames.at(-1)).toEqual({
      event: 'game:restarted',
      args: [],
    });
  });
});
