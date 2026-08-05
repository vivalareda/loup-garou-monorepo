import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import { SpecialScenarios } from '@/core/special-scenarios';
import type { Player } from '@/core/player';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { EventsActions } from '@/server/events-actions';
import type { SocketType } from '@/server/sockets';

// Never play real audio in tests — sound.play blocks until the mp3 finishes
vi.mock('sound-play', () => ({
  default: { play: vi.fn().mockResolvedValue(undefined) },
}));

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('Post day-vote death scenarios (notes.md)', () => {
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

  const addPlayer = (name: string, sid: string, role: Parameters<Player['setRole']>[0]) => {
    const player = game.addPlayer(name, sid);
    player.setRole(role);
    game.setPlayerTeams(player);
    if (role === 'HUNTER' || role === 'WITCH' || role === 'CUPID') {
      game.setSpecialRolePlayer(player);
    }
    return player;
  };

  const targetedSockets = () =>
    (mockIo.to as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[0]
    );
  const playedAudio = () => playAudioSpy.mock.calls.map((call) => call[0]);

  it('village killed hunter → pauses for revenge pick, then kills the target', async () => {
    const hunter = addPlayer('Hunter', 'h-id', 'HUNTER');
    const villagerA = addPlayer('VillagerA', 'a-id', 'VILLAGER');
    const villagerB = addPlayer('VillagerB', 'b-id', 'VILLAGER');
    const werewolf = addPlayer('Werewolf', 'w-id', 'WEREWOLF');

    eventsActions.handleDayVote('a-id', 'h-id');
    eventsActions.handleDayVote('b-id', 'h-id');
    eventsActions.handleDayVote('w-id', 'h-id');
    const resolution = eventsActions.handleDayVote('h-id', 'a-id');
    await tick();

    // Hunter is dead and the flow is parked, waiting for his pick
    expect(hunter.isAlive).toBe(false);
    expect(targetedSockets()).toContain('h-id');
    expect(werewolf.isAlive).toBe(true);

    const consumed = eventsActions.submitHunterPick('w-id');
    expect(consumed).toBe(true);
    await resolution;

    expect(werewolf.isAlive).toBe(false);
    expect(villagerA.isAlive).toBe(true);
    expect(villagerB.isAlive).toBe(true);
    // Shooting the last werewolf ends the game for the villagers
    expect(playedAudio()).toEqual([
      'Day-vote/Vote-Death',
      'Day-vote/Hunter',
      'End-game/Villagers-won',
    ]);
  });

  it('village killed lover → partner dies of grief', async () => {
    const loverA = addPlayer('LoverA', 'a-id', 'VILLAGER');
    const loverB = addPlayer('LoverB', 'b-id', 'VILLAGER');
    addPlayer('VillagerC', 'c-id', 'VILLAGER');
    const werewolf = addPlayer('Werewolf', 'w-id', 'WEREWOLF');
    game.setLovers(['a-id', 'b-id']);

    eventsActions.handleDayVote('b-id', 'a-id');
    eventsActions.handleDayVote('c-id', 'a-id');
    eventsActions.handleDayVote('w-id', 'a-id');
    await eventsActions.handleDayVote('a-id', 'w-id');

    expect(loverA.isAlive).toBe(false);
    expect(loverB.isAlive).toBe(false);
    expect(werewolf.isAlive).toBe(true);
    // One villager vs one werewolf left → werewolves win
    expect(playedAudio()).toEqual([
      'Day-vote/Vote-Death',
      'Day-vote/Lover',
      'End-game/Werewolves-won',
    ]);
  });

  it('village killed lover which is the hunter → partner grieves AND hunter shoots', async () => {
    const hunterLover = addPlayer('HunterLover', 'h-id', 'HUNTER');
    const partner = addPlayer('Partner', 'p-id', 'VILLAGER');
    const villager = addPlayer('Villager', 'c-id', 'VILLAGER');
    const werewolf = addPlayer('Werewolf', 'w-id', 'WEREWOLF');
    game.setLovers(['h-id', 'p-id']);

    eventsActions.handleDayVote('p-id', 'h-id');
    eventsActions.handleDayVote('c-id', 'h-id');
    eventsActions.handleDayVote('w-id', 'h-id');
    const resolution = eventsActions.handleDayVote('h-id', 'c-id');
    await tick();

    // Both lovers are dead before the hunter takes his shot
    expect(hunterLover.isAlive).toBe(false);
    expect(partner.isAlive).toBe(false);
    expect(targetedSockets()).toContain('h-id');

    eventsActions.submitHunterPick('w-id');
    await resolution;

    expect(werewolf.isAlive).toBe(false);
    expect(villager.isAlive).toBe(true);
    expect(playedAudio()).toEqual([
      'Day-vote/Vote-Death',
      'Day-vote/Lover',
      'Day-vote/Hunter',
      'End-game/Villagers-won',
    ]);
  });

  it('village killed lover whose partner is the hunter → grieving hunter shoots', async () => {
    const lover = addPlayer('Lover', 'l-id', 'VILLAGER');
    const hunterPartner = addPlayer('HunterPartner', 'h-id', 'HUNTER');
    const villager = addPlayer('Villager', 'c-id', 'VILLAGER');
    const werewolf = addPlayer('Werewolf', 'w-id', 'WEREWOLF');
    game.setLovers(['l-id', 'h-id']);

    eventsActions.handleDayVote('h-id', 'l-id');
    eventsActions.handleDayVote('c-id', 'l-id');
    eventsActions.handleDayVote('w-id', 'l-id');
    const resolution = eventsActions.handleDayVote('l-id', 'c-id');
    await tick();

    expect(lover.isAlive).toBe(false);
    expect(hunterPartner.isAlive).toBe(false);
    expect(targetedSockets()).toContain('h-id');

    eventsActions.submitHunterPick('w-id');
    await resolution;

    expect(werewolf.isAlive).toBe(false);
    expect(villager.isAlive).toBe(true);
    expect(playedAudio()).toEqual([
      'Day-vote/Vote-Death',
      'Day-vote/Lover',
      'Day-vote/Hunter',
      'End-game/Villagers-won',
    ]);
  });

  it("hunter's revenge target can itself be a lover → grief cascades", async () => {
    const hunter = addPlayer('Hunter', 'h-id', 'HUNTER');
    const loverA = addPlayer('LoverA', 'a-id', 'VILLAGER');
    const loverB = addPlayer('LoverB', 'b-id', 'VILLAGER');
    const werewolf = addPlayer('Werewolf', 'w-id', 'WEREWOLF');
    game.setLovers(['a-id', 'b-id']);

    eventsActions.handleDayVote('a-id', 'h-id');
    eventsActions.handleDayVote('b-id', 'h-id');
    eventsActions.handleDayVote('w-id', 'h-id');
    const resolution = eventsActions.handleDayVote('h-id', 'a-id');
    await tick();

    eventsActions.submitHunterPick('a-id');
    await resolution;

    expect(hunter.isAlive).toBe(false);
    expect(loverA.isAlive).toBe(false);
    expect(loverB.isAlive).toBe(false);
    expect(werewolf.isAlive).toBe(true);
  });

  it('day vote tie → nobody dies and the game moves on', async () => {
    const villagerA = addPlayer('VillagerA', 'a-id', 'VILLAGER');
    const villagerB = addPlayer('VillagerB', 'b-id', 'VILLAGER');
    const villagerC = addPlayer('VillagerC', 'c-id', 'VILLAGER');
    const werewolf = addPlayer('Werewolf', 'w-id', 'WEREWOLF');

    eventsActions.handleDayVote('a-id', 'w-id');
    eventsActions.handleDayVote('b-id', 'w-id');
    eventsActions.handleDayVote('c-id', 'a-id');
    await eventsActions.handleDayVote('w-id', 'a-id');

    expect(villagerA.isAlive).toBe(true);
    expect(villagerB.isAlive).toBe(true);
    expect(villagerC.isAlive).toBe(true);
    expect(werewolf.isAlive).toBe(true);

    const tieCall = emitSpy.mock.calls.find(
      (call) => call[0] === 'day:vote-tie'
    );
    expect(tieCall?.[1]).toEqual(
      expect.arrayContaining(['VillagerA', 'Werewolf'])
    );
  });

  it('hunter pick with no pending day-vote resolution falls back to the night flow', () => {
    expect(eventsActions.submitHunterPick('anyone')).toBe(false);
  });

  it('hunter revenge times out after 60s and skips the revenge kill', async () => {
    vi.useFakeTimers();

    try {
      const hunter = addPlayer('Hunter', 'h-id', 'HUNTER');
      const villagerA = addPlayer('VillagerA', 'a-id', 'VILLAGER');
      const villagerB = addPlayer('VillagerB', 'b-id', 'VILLAGER');
      const werewolf = addPlayer('Werewolf', 'w-id', 'WEREWOLF');
      vi.spyOn(segmentsManager, 'advanceSegment').mockResolvedValue(undefined);

      eventsActions.handleDayVote('a-id', 'h-id');
      eventsActions.handleDayVote('b-id', 'h-id');
      eventsActions.handleDayVote('w-id', 'h-id');
      const resolution = eventsActions.handleDayVote('h-id', 'a-id');
      await vi.advanceTimersByTimeAsync(60_000);
      await resolution;

      expect(hunter.isAlive).toBe(false);
      expect(werewolf.isAlive).toBe(true);
      expect(villagerA.isAlive).toBe(true);
      expect(villagerB.isAlive).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
