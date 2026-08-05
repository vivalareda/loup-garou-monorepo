import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import { SpecialScenarios } from '@/core/special-scenarios';
import type { Player } from '@/core/player';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { EventsActions } from '@/server/events-actions';
import type { SocketType } from '@/server/sockets';

vi.mock('sound-play', () => ({
  default: { play: vi.fn().mockResolvedValue(undefined) },
}));

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('Night dawn death scenarios', () => {
  let mockIo: SocketType;
  let emitSpy: ReturnType<typeof vi.fn>;
  let game: Game;
  let deathManager: DeathManager;
  let audioManager: AudioManager;
  let segmentsManager: SegmentsManager;
  let eventsActions: EventsActions;
  let playAudioSpy: MockInstance;

  beforeEach(() => {
    emitSpy = vi.fn();
    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: emitSpy,
    } as unknown as SocketType;

    deathManager = new DeathManager();
    game = new Game(mockIo, deathManager);
    audioManager = new AudioManager(deathManager);
    segmentsManager = new SegmentsManager(
      game,
      mockIo,
      audioManager,
      new SpecialScenarios(game, audioManager)
    );
    eventsActions = new EventsActions(game, segmentsManager, mockIo);

    playAudioSpy = vi.spyOn(audioManager, 'playAudio');
  });

  const addPlayer = (
    name: string,
    sid: string,
    role: Parameters<Player['setRole']>[0]
  ) => {
    const player = game.addPlayer(name, sid);
    player.setRole(role);
    game.setPlayerTeams(player);
    if (role === 'HUNTER' || role === 'WITCH' || role === 'CUPID') {
      game.setSpecialRolePlayer(player);
    }
    return player;
  };

  const jumpToDay = () => {
    const daySegmentIndex = segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    segmentsManager.currentSegment = daySegmentIndex;
  };

  const playedAudio = () => playAudioSpy.mock.calls.map((call) => call[0]);

  it('plain night death (Branch D + queue cascade)', async () => {
    const victim = addPlayer('VillagerA', 'a-id', 'VILLAGER');
    const villagerB = addPlayer('VillagerB', 'b-id', 'VILLAGER');
    addPlayer('VillagerC', 'c-id', 'VILLAGER');
    addPlayer('Werewolf', 'w-id', 'WEREWOLF');
    game.addPendingDeath('a-id', 'WEREWOLVES');

    jumpToDay();
    segmentsManager.playSegment();
    await tick();

    expect(victim.isAlive).toBe(false);
    expect(villagerB.isAlive).toBe(true);
    expect(game.getDeathQueue()).toHaveLength(0);
    expect(playedAudio()).toEqual([
      'Night-end/Wake-up-everyone',
      'Night-end/one-death',
      'day-vote-start',
    ]);
  });

  it('no deaths at all (Branch D)', async () => {
    addPlayer('VillagerA', 'a-id', 'VILLAGER');
    addPlayer('VillagerB', 'b-id', 'VILLAGER');
    addPlayer('VillagerC', 'c-id', 'VILLAGER');
    addPlayer('Werewolf', 'w-id', 'WEREWOLF');

    jumpToDay();
    segmentsManager.playSegment();
    await tick();

    expect(playedAudio()).toContain('Night-end/no-death');
    expect(game.getAlivePlayers().length).toBe(4);
  });

  it('lover dies, partner not hunter (Branch C)', async () => {
    const loverA = addPlayer('LoverA', 'a-id', 'VILLAGER');
    const loverB = addPlayer('LoverB', 'b-id', 'VILLAGER');
    addPlayer('VillagerC', 'c-id', 'VILLAGER');
    addPlayer('VillagerD', 'd-id', 'VILLAGER');
    addPlayer('Werewolf', 'w-id', 'WEREWOLF');
    game.setLovers(['a-id', 'b-id']);
    game.addPendingDeath('a-id', 'WEREWOLVES');

    jumpToDay();
    segmentsManager.playSegment();
    await tick();

    expect(loverA.isAlive).toBe(false);
    expect(loverB.isAlive).toBe(false);
    expect(game.getDeathQueue()).toHaveLength(0);
    expect(playedAudio().slice(0, 2)).toEqual([
      'Night-end/Wake-up-everyone',
      'Special-death/pre-day-vote-lover-2',
    ]);
  });

  it('hunter (not lover) dies (Branch A)', async () => {
    const hunter = addPlayer('Hunter', 'h-id', 'HUNTER');
    const victim = addPlayer('VillagerA', 'a-id', 'VILLAGER');
    addPlayer('VillagerB', 'b-id', 'VILLAGER');
    addPlayer('VillagerC', 'c-id', 'VILLAGER');
    addPlayer('Werewolf', 'w-id', 'WEREWOLF');

    game.addPendingDeath('h-id', 'WEREWOLVES');

    jumpToDay();
    segmentsManager.playSegment();
    await tick();

    expect(emitSpy.mock.calls.map((c) => c[0])).toContain(
      'hunter:pick-required'
    );
    expect(hunter.isAlive).toBe(true);
    expect(playedAudio()).toEqual([
      'Night-end/Wake-up-everyone',
      'Night-end/Deaths',
      'Hunter/Hunter',
    ]);

    eventsActions.submitHunterPick('a-id');
    await tick();

    expect(victim.isAlive).toBe(false);
    expect(hunter.isAlive).toBe(false);
    expect(game.getDeathQueue()).toHaveLength(0);
  });

  it('lover dies, surviving partner is the hunter (Branch B)', async () => {
    const lover = addPlayer('Lover', 'l-id', 'VILLAGER');
    const hunterPartner = addPlayer('HunterPartner', 'h-id', 'HUNTER');
    const victim = addPlayer('Victim', 'v-id', 'VILLAGER');
    addPlayer('Villager', 'x-id', 'VILLAGER');
    addPlayer('Werewolf', 'w-id', 'WEREWOLF');
    game.setLovers(['l-id', 'h-id']);
    game.addPendingDeath('l-id', 'WEREWOLVES');

    jumpToDay();
    segmentsManager.playSegment();
    await tick();

    expect(emitSpy.mock.calls.map((c) => c[0])).toContain(
      'hunter:pick-required'
    );
    expect(hunterPartner.isAlive).toBe(true);
    expect(playedAudio().slice(0, 3)).toEqual([
      'Night-end/Wake-up-everyone',
      'Special-death/pre-day-vote-lover-2',
      'Pre-day-vote/Second-lover-hunter',
    ]);

    eventsActions.submitHunterPick('v-id');
    await tick();

    expect(victim.isAlive).toBe(false);
    // lover (l-id) dies — queued death processed by dayAction.
    // hunterPartner (h-id) survives: isHunterInLove() overwrites
    // l-id's queue cause from WEREWOLVES to PARTNER_SUICIDE, which
    // suppresses the grief-death cascade in processPendingDeaths
    // pass 1. Known quirk, preserved identically by the port.
    expect(lover.isAlive).toBe(false);
    expect(hunterPartner.isAlive).toBe(true);
    expect(game.getDeathQueue()).toHaveLength(0);
  });

  it('pick with nothing pending returns false', () => {
    addPlayer('Villager', 'a-id', 'VILLAGER');
    addPlayer('Werewolf', 'w-id', 'WEREWOLF');
    expect(eventsActions.submitHunterPick('anyone')).toBe(false);
  });
});