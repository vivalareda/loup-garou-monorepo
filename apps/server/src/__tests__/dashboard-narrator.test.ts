import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardNarrator } from '@/server/dashboard-narrator';
import { RecordingIO } from '@/simulation/recording-io';

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

  const lastClipId = () =>
    io.eventsOf('narrator:play').at(-1)?.args[0] as string;

  it('skips clips when no narrator is registered', async () => {
    await narrator.play('Intro');
    expect(io.emitted('narrator:play')).toBe(false);
  });

  it('sends the clip only to the narrator and waits for done', async () => {
    narrator.attach('dash');
    let finished = false;
    const playing = narrator.play('Werewolves/Werewolves-1').then(() => {
      finished = true;
    });

    expect(io.eventsOf('narrator:play')).toEqual([
      {
        scope: 'dash',
        event: 'narrator:play',
        args: ['0', 'Werewolves/Werewolves-1'],
      },
    ]);
    await Promise.resolve();
    expect(finished).toBe(false);

    narrator.complete('dash', lastClipId());
    await playing;
    expect(finished).toBe(true);
  });

  it('ignores a done for an unknown clip', async () => {
    narrator.attach('dash');
    let finished = false;
    narrator.play('Intro').then(() => {
      finished = true;
    });

    narrator.complete('dash', '999');
    await Promise.resolve();
    expect(finished).toBe(false);
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
    narrator.detach('dash');
    await playing;

    await narrator.play('Witch/Witch-end');
    expect(io.eventsOf('narrator:play')).toHaveLength(1);
  });

  it('ignores a done from a socket the clip was not sent to', async () => {
    narrator.attach('dash');
    let finished = false;
    narrator.play('Intro').then(() => {
      finished = true;
    });

    narrator.complete('player', lastClipId());
    await Promise.resolve();
    expect(finished).toBe(false);
  });

  it("releases a replaced narrator's clips when it leaves", async () => {
    narrator.attach('old-tab');
    const playing = narrator.play('Intro');

    // The tab reconnects under a new socket id before the old one drops
    narrator.attach('new-tab');
    narrator.detach('old-tab');
    await playing;

    narrator.play('Witch/Witch-end');
    expect(io.eventsOf('narrator:play').at(-1)?.scope).toBe('new-tab');
  });
});
