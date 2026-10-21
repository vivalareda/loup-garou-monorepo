import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameRuntime } from '@/game-runtime';
import { silentNarrator } from '@/segments/narrator';
import { DashboardNarrator } from '@/server/dashboard-narrator';
import { fakeSocket, newHost } from './helpers/fake-socket';

describe('createGameRuntime', () => {
  it('wires a dashboard narrator to the client that registers', async () => {
    const host = newHost();
    const narrator = new DashboardNarrator(host);
    createGameRuntime({ host, narrator, adminEvents: false });
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
    createGameRuntime({ host, narrator, adminEvents: false });
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

    const runtime = createGameRuntime({
      host,
      narrator: silentNarrator,
      adminEvents: false,
    });

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

  it.each([
    [true, 1],
    [false, 0],
  ])(
    'with adminEvents %s, admin:start-game starts %i game',
    (adminEvents, started) => {
      const host = newHost();

      const runtime = createGameRuntime({
        host,
        narrator: silentNarrator,
        adminEvents,
      });

      for (const name of ['A', 'B', 'C', 'D']) {
        const player = fakeSocket();
        host.accept(player.socket);
        player.send('player:join', name);
      }

      const dashboard = fakeSocket();
      host.accept(dashboard.socket);

      dashboard.send('admin:start-game');
      expect(Number(runtime.segmentsManager.hasStarted())).toBe(started);
    }
  );
});

describe('a finished game', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('leaves no deadline or discussion timer running', async () => {
    vi.useFakeTimers();
    const host = newHost();

    const runtime = createGameRuntime({
      host,
      narrator: silentNarrator,
      adminEvents: false,
    });

    for (const name of ['A', 'B', 'C', 'D', 'E', 'F']) {
      const player = fakeSocket();
      host.accept(player.socket);
      player.send('player:join', name);
    }

    expect(runtime.segmentsManager.hasStarted()).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.segmentsManager.getRemainingDeadlineMs()).not.toBeNull();

    for (const player of runtime.game.getAlivePlayers()) {
      if (player.getRole() !== 'WEREWOLF') {
        player.kill();
      }
    }

    expect(runtime.segmentsManager.isGameOver()).toBe(true);
    expect(runtime.segmentsManager.getRemainingDeadlineMs()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
