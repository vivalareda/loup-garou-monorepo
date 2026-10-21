import type { Role } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameRuntime, type GameRuntime } from '@/game-runtime';
import type { Narrator } from '@/segments/narrator';
import { DashboardNarrator } from '@/server/dashboard-narrator';
import { type FakeSocket, fakeSocket, newHost } from './helpers/fake-socket';

/** Lets every promise continuation (and 0ms timer) run. */
const flush = () => vi.advanceTimersByTimeAsync(0);

/** Whether `promise` has settled yet, asked as often as needed. */
function trackSettled<T>(promise: Promise<T>) {
  let settled = false;
  promise.then(() => {
    settled = true;
  });

  return () => settled;
}

/** A narrator whose clips finish only when the test says so. */
class ManualNarrator implements Narrator {
  readonly clips: { clip: string; finish: () => void }[] = [];
  /** Every clip ever requested, in order. */
  readonly requested: string[] = [];

  play(clip: string) {
    this.requested.push(clip);

    return new Promise<void>((finish) => this.clips.push({ clip, finish }));
  }

  /** Finishes only the clips pending right now. */
  async finishPending() {
    for (const pending of this.clips.splice(0)) {
      pending.finish();
    }

    await flush();
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
  vi.restoreAllMocks();
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

  const reachedStop = () =>
    runtime.segmentsManager.hasFinished() || (stopAtDawn && phase() === 'DAY');

  const playUntilInput = async () => {
    await flush();

    while (acked < clips().length && !reachedStop()) {
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

/** A started 4-player game narrated clip by clip by the test. */
function manualGame() {
  const host = newHost();
  const narrator = new ManualNarrator();
  const runtime = createGameRuntime({ host, narrator, adminEvents: false });

  // The runtime keeps its EventsActions private to GameEvents; the hunter
  // pick tests drive the resolutions through it directly
  const eventsActions = runtime.events['eventsActions'];

  /** (Re)fills the room: a new game starts, its intro narrated. */
  const start = async () => {
    const players = joinFour(host);
    await narrator.finishAll();
    const hunter = bySocket(runtime, players, 'HUNTER');

    const target = [...players.keys()].find(
      (sid) => sid !== hunter.sid && runtime.game.getPlayerBySocketId(sid)
    );

    return { hunter, target: target ?? '' };
  };

  return { runtime, narrator, eventsActions, start };
}

describe('a hunter pick pending across a reset', () => {
  it.each([
    ['dawn', 'night'],
    ['day vote', 'day'],
  ])(
    "%s: the old pick is cancelled and the next game's hunter can pick",
    async (_, path) => {
      const { runtime, narrator, eventsActions, start } = manualGame();
      // The day vote ends by advancing out of DAY; these games are still
      // in CUPID (no lovers picked), so keep them there
      vi.spyOn(runtime.segmentsManager, 'advanceSegment').mockResolvedValue();

      // Kills the hunter and runs the resolution up to the pick; returns
      // the running resolution (wrapped: awaiting it would wait for a pick)
      const waitForPick = async (hunterSid: string) => {
        const hunter = runtime.game.getPlayerBySocketId(hunterSid);

        if (!hunter) {
          throw new Error('No hunter');
        }

        if (path === 'night') {
          runtime.game.addPendingDeath(hunterSid, 'WEREWOLVES');
        }

        const run =
          path === 'night'
            ? runtime.segmentsManager.nightDawnResolution.run()
            : eventsActions.resolveDayVote(hunter);

        await narrator.finishAll();

        return { run };
      };

      const first = await start();
      const old = await waitForPick(first.hunter.sid);
      expect(eventsActions.hasPendingHunterPick()).toBe(true);

      runtime.reset();
      await flush();
      expect(eventsActions.hasPendingHunterPick()).toBe(false);
      await old.run;
      // Its 60s timeout is cancelled, not just left to fire
      expect(vi.getTimerCount()).toBe(0);

      await vi.advanceTimersByTimeAsync(30_000);
      const second = await start();
      const current = await waitForPick(second.hunter.sid);
      // Past the old pick's 60s: the new one must still be pending
      await vi.advanceTimersByTimeAsync(31_000);
      expect(eventsActions.hasPendingHunterPick()).toBe(true);

      expect(eventsActions.submitHunterPick(second.target)).toBe(true);
      const settled = trackSettled(current.run);

      for (let step = 0; step < 50 && !settled(); step++) {
        await narrator.finishAll();
        await vi.advanceTimersByTimeAsync(10);
      }

      expect(settled()).toBe(true);
      expect(runtime.game.getPlayerBySocketId(second.target)?.isAlive).toBe(
        false
      );
    }
  );
});

describe('a composite narration reset after its first clip', () => {
  it.each([
    ['the DAY start', false],
    ['the hunter death', true],
  ])('%s requests no further clip', async (_, hunterDies) => {
    const { runtime, narrator, eventsActions, start } = manualGame();
    const { hunter } = await start();

    if (hunterDies) {
      runtime.game.addPendingDeath(hunter.sid, 'WEREWOLVES');
    }

    const before = narrator.requested.length;
    const run = runtime.segmentsManager.nightDawnResolution.run();
    await flush();
    expect(narrator.requested.slice(before)).toEqual([
      'Night-end/Wake-up-everyone',
    ]);

    runtime.reset();
    await narrator.finishPending();
    await run;

    expect(narrator.requested.slice(before)).toEqual([
      'Night-end/Wake-up-everyone',
    ]);
    expect(eventsActions.hasPendingHunterPick()).toBe(false);
  });
});
