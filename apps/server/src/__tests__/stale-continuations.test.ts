import type { Role } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameRuntime, type GameRuntime } from '@/game-runtime';
import type { Narrator } from '@/segments/narrator';
import { DashboardNarrator } from '@/server/dashboard-narrator';
import { type FakeSocket, fakeSocket, newHost } from './helpers/fake-socket';

/** Lets every promise continuation (and 0ms timer) run. */
const flush = () => vi.advanceTimersByTimeAsync(0);

/** A narrator whose clips finish only when the test says so. */
class ManualNarrator implements Narrator {
  readonly clips: { clip: string; finish: () => void }[] = [];

  play(clip: string) {
    return new Promise<void>((finish) => this.clips.push({ clip, finish }));
  }

  async finishAll() {
    while (this.clips.some(Boolean)) {
      for (const pending of this.clips.splice(0)) {
        pending.finish();
      }
      await flush();
    }
  }
}

/** Four players (PLAYER_COUNT=4) join `runtime`'s host, starting the game. */
function joinFour(host: ReturnType<typeof newHost>) {
  const players = new Map<string, FakeSocket>();
  for (const name of ['A', 'B', 'C', 'D']) {
    const player = fakeSocket();
    players.set(host.accept(player.socket).id, player);
    player.send('player:join', name);
  }
  return players;
}

function bySocket(
  runtime: GameRuntime,
  players: Map<string, FakeSocket>,
  role: Role
) {
  const player = [...runtime.game.getPlayerList().values()].find(
    (candidate) => candidate.getRole() === role
  );
  const sid = player?.getSocketId() ?? '';
  const socket = players.get(sid);
  if (!socket) {
    throw new Error(`No ${role} socket`);
  }
  return { sid, socket };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('PLAYER_COUNT', '4');
  vi.stubEnv('LOVER_ALERT_DELAY_MS', '0');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('segment transitions', () => {
  it('advances once when a segment is finished twice while its end clip plays', async () => {
    const host = newHost();
    const narrator = new ManualNarrator();
    const runtime = createGameRuntime({ host, narrator, adminEvents: false });
    const players = joinFour(host);
    await narrator.finishAll();
    const cupid = bySocket(runtime, players, 'CUPID');
    const lovers = [...players.keys()].filter((sid) => sid !== cupid.sid);

    // The pick finishes CUPID; a racing deadline or retry finishes it again
    cupid.socket.send('cupid:lovers-pick', lovers.slice(0, 2));
    runtime.segmentsManager.finishSegment();
    expect(narrator.clips).toHaveLength(1);
    narrator.clips.splice(0).at(0)?.finish();
    await flush();

    expect(runtime.segmentsManager.getCurrentSegmentType()).toBe('LOVERS');
  });

  it('drops a transition whose end clip outlives a reset (Node r key)', async () => {
    const host = newHost();
    const narrator = new ManualNarrator();
    const runtime = createGameRuntime({ host, narrator, adminEvents: false });
    const players = joinFour(host);
    await narrator.finishAll();
    const cupid = bySocket(runtime, players, 'CUPID');
    const [first, second] = [...players.keys()].filter(
      (sid) => sid !== cupid.sid
    );
    cupid.socket.send('cupid:lovers-pick', [first, second]);
    // CUPID's end clip is playing
    expect(narrator.clips).toHaveLength(1);

    runtime.reset();
    await narrator.finishAll();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(runtime.segmentsManager.getCurrentSegmentType()).toBe('LOBBY');
    expect(runtime.segmentsManager.getRemainingDeadlineMs()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

/**
 * A game narrated by a dashboard tab, driven to the night's dawn: the
 * cupid pairs the wolf with the hunter, the wolf votes for the witch
 * TWICE (the second agreeing vote lands while WEREWOLF's end clip
 * plays), the witch skips her heal and poisons the cupid. Dawn then
 * leaves the wolf and the hunter: a werewolf win.
 */
async function playToDawn(stopAtDawn: boolean) {
  const host = newHost();
  const narrator = new DashboardNarrator(host);
  const runtime = createGameRuntime({ host, narrator, adminEvents: false });
  const dashboard = fakeSocket();
  host.accept(dashboard.socket);
  dashboard.send('narrator:register');
  const players = joinFour(host);
  const phase = () => runtime.segmentsManager.getCurrentSegmentType();
  const reached = (expected: string) => {
    if (phase() !== expected) {
      throw new Error(`Expected ${expected}, the game is at ${phase()}`);
    }
  };

  // Acks the dashboard's clips until the game waits on a player, is over
  // (its victory clip stays pending) or, with stopAtDawn, reaches DAY
  let acked = 0;
  const clips = () =>
    dashboard.frames.filter((frame) => frame.event === 'narrator:play');
  const playUntilInput = async () => {
    await flush();
    while (
      acked < clips().length &&
      !runtime.segmentsManager.hasFinished() &&
      !(stopAtDawn && phase() === 'DAY')
    ) {
      dashboard.send('narrator:done', clips()[acked]?.args?.[0]);
      acked++;
      await flush();
    }
  };

  const wolf = bySocket(runtime, players, 'WEREWOLF');
  const witch = bySocket(runtime, players, 'WITCH');
  const hunter = bySocket(runtime, players, 'HUNTER');
  const cupid = bySocket(runtime, players, 'CUPID');

  await playUntilInput();
  cupid.socket.send('cupid:lovers-pick', [wolf.sid, hunter.sid]);
  await playUntilInput();
  wolf.socket.send('alert:lover-closed-alert');
  hunter.socket.send('alert:lover-closed-alert');
  await playUntilInput();
  reached('WEREWOLF');

  wolf.socket.send('werewolf:player-voted', witch.sid);
  wolf.socket.send('werewolf:player-voted', witch.sid);
  await playUntilInput();
  reached('WITCH-HEAL');

  witch.socket.send('witch:skipped-heal');
  await playUntilInput();
  witch.socket.send('witch:poisoned-player', cupid.sid);
  await playUntilInput();

  /** Everyone leaves, narrator last (the Worker's order), then the reset. */
  const abandon = () => {
    for (const player of players.values()) {
      player.drop();
    }
    dashboard.drop();
    runtime.reset();
  };
  return { runtime, dashboard, phase, abandon };
}

describe('a game reset while its narration is pending', () => {
  it('won at dawn: leaves an empty lobby with no deadline or timer', async () => {
    const { runtime, phase, abandon } = await playToDawn(false);
    expect(runtime.segmentsManager.hasFinished()).toBe(true);
    expect(runtime.segmentsManager.getRemainingDeadlineMs()).toBeNull();

    // The victory clip is still pending when the empty room resets
    abandon();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(phase()).toBe('LOBBY');
    expect(runtime.game.getPlayerList().size).toBe(0);
    expect(runtime.segmentsManager.getRemainingDeadlineMs()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('mid-dawn: the dawn resolution stops at its pending clip', async () => {
    const { runtime, phase, abandon } = await playToDawn(true);
    expect(phase()).toBe('DAY');
    const dayAction = vi.spyOn(
      runtime.segmentsManager.getGameActions(),
      'dayAction'
    );

    // The narrator leaving finishes the dawn clip; the reset follows
    abandon();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(phase()).toBe('LOBBY');
    expect(runtime.game.getPlayerList().size).toBe(0);
    expect(dayAction).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
