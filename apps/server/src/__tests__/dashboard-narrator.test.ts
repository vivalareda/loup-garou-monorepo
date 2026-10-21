import { Schema } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardNarrator } from '@/server/dashboard-narrator';
import { RecordingIO } from '@/simulation/recording-io';

/** Whether `promise` has settled once pending microtasks have run. */
const hasSettled = async (promise: Promise<void>) => {
  let settled = false;
  promise.then(() => {
    settled = true;
  });
  await vi.advanceTimersByTimeAsync(0);

  return settled;
};

const decodeClipId = Schema.decodeUnknownSync(Schema.String);

describe('DashboardNarrator', () => {
  let io: RecordingIO;
  let narrator: DashboardNarrator;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockReturnValue();
    vi.spyOn(console, 'warn').mockReturnValue();
    io = new RecordingIO();
    narrator = new DashboardNarrator(io, 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** The id of the clip last sent to the narrator tab (throws if none). */
  const lastClipId = () =>
    decodeClipId(io.eventsOf('narrator:play').at(-1)?.args[0]);

  it('skips clips when no narrator is registered', async () => {
    await narrator.play('Intro');
    expect(io.emitted('narrator:play')).toBe(false);
  });

  it('sends the clip only to the narrator and waits for done', async () => {
    narrator.attach('dash');
    const playing = narrator.play('Werewolves/Werewolves-1');

    expect(io.eventsOf('narrator:play')).toEqual([
      {
        scope: 'dash',
        event: 'narrator:play',
        args: [expect.any(String), 'Werewolves/Werewolves-1'],
      },
    ]);
    expect(await hasSettled(playing)).toBe(false);

    narrator.complete('dash', lastClipId());
    expect(await hasSettled(playing)).toBe(true);
  });

  it('ignores a done for an unknown clip', async () => {
    narrator.attach('dash');
    const playing = narrator.play('Intro');

    narrator.complete('dash', `${lastClipId()}-unknown`);
    expect(await hasSettled(playing)).toBe(false);

    narrator.complete('dash', lastClipId());
    expect(await hasSettled(playing)).toBe(true);
  });

  it('moves on when the narrator never answers', async () => {
    narrator.attach('dash');
    const playing = narrator.play('Intro');
    await vi.advanceTimersByTimeAsync(1000);
    await expect(playing).resolves.toBeUndefined();
  });

  it('releases clips in flight when the narrator disconnects', async () => {
    narrator.attach('dash');
    const playing = narrator.play('Intro');

    narrator.detach('someone-else');
    expect(await hasSettled(playing)).toBe(false);

    narrator.detach('dash');
    expect(await hasSettled(playing)).toBe(true);

    await narrator.play('Witch/Witch-end');
    expect(io.eventsOf('narrator:play')).toHaveLength(1);
  });

  it('ignores a done from a socket the clip was not sent to', async () => {
    narrator.attach('dash');
    const playing = narrator.play('Intro');

    narrator.complete('player', lastClipId());
    expect(await hasSettled(playing)).toBe(false);

    narrator.complete('dash', lastClipId());
    expect(await hasSettled(playing)).toBe(true);
  });

  it("releases a replaced narrator's clips when it leaves", async () => {
    narrator.attach('old-tab');
    const playing = narrator.play('Intro');

    // The tab reconnects under a new socket id before the old one drops
    narrator.attach('new-tab');
    expect(await hasSettled(playing)).toBe(false);

    narrator.detach('old-tab');
    expect(await hasSettled(playing)).toBe(true);

    const next = narrator.play('Witch/Witch-end');
    expect(io.eventsOf('narrator:play').at(-1)?.scope).toBe('new-tab');
    narrator.complete('new-tab', lastClipId());
    await next;
  });
});
