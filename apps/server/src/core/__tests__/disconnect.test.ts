import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import type { SocketType } from '@/server/sockets';

describe('Game.handleDisconnect', () => {
  let game: Game;
  let deathManager: DeathManager;
  let mockIo: SocketType;
  // Per-socket emit spies so we can prove which sid received what.
  let socketEmit: Map<string, ReturnType<typeof vi.fn>>;
  let ioEmitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    socketEmit = new Map();
    ioEmitSpy = vi.fn();
    mockIo = {
      to: vi.fn((sid: string) => {
        let emit = socketEmit.get(sid);
        if (!emit) {
          emit = vi.fn();
          socketEmit.set(sid, emit);
        }
        return { emit };
      }),
      emit: ioEmitSpy,
    } as unknown as SocketType;
    deathManager = new DeathManager();
    game = new Game(mockIo, deathManager);
  });

  const addPlayer = (
    name: string,
    sid: string,
    role: Parameters<ReturnType<typeof game.addPlayer>['setRole']>[0]
  ) => {
    const player = game.addPlayer(name, sid);
    player.setRole(role);
    game.setPlayerTeams(player);
    return player;
  };

  it('treats disconnect of an alive player as death (emits once each)', () => {
    const p = addPlayer('Alice', 'a-sid', 'VILLAGER');

    game.handleDisconnect('a-sid');

    expect(p.isAlive).toBe(false);
    // alert:player-is-dead is sent to the disconnected socket
    expect(socketEmit.get('a-sid')).toHaveBeenCalledWith('alert:player-is-dead');
    // lobby:player-died is broadcast to everyone
    expect(ioEmitSpy).toHaveBeenCalledWith('lobby:player-died', 'a-sid');
  });

  it('clears a werewolf vote on disconnect so the phase does not deadlock', () => {
    const w1 = addPlayer('W1', 'w1-sid', 'WEREWOLF');
    const w2 = addPlayer('W2', 'w2-sid', 'WEREWOLF');
    addPlayer('V', 'v-sid', 'VILLAGER');

    game.handleWerewolfVote('w1-sid', 'v-sid');
    // w1 disconnects after voting
    game.handleDisconnect('w1-sid');

    // w1's stale vote is gone
    expect(game.getWerewolfVoteTallies()['v-sid']).toBeUndefined();
    // Only w2 remains and hasn't voted → not all agreed
    expect(game.hasAllWerewolvesAgreed()).toBe(false);

    // w2 now agrees on the same target → phase completes without w1
    game.handleWerewolfVote('w2-sid', 'v-sid');
    expect(game.hasAllWerewolvesAgreed()).toBe(true);

    expect(w1.isAlive).toBe(false);
    expect(w2.isAlive).toBe(true);
  });

  it('clears a day vote on disconnect so hasAllPlayersVoted stays correct', () => {
    addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'VILLAGER');
    addPlayer('C', 'c-sid', 'WEREWOLF');
    addPlayer('D', 'd-sid', 'WEREWOLF');

    // Two alive voters vote; B disconnects before voting
    game.handleDayVote('a-sid', 'c-sid');
    game.handleDisconnect('b-sid');

    // b-sid is dead (expectedVoters drops to 3); its stale vote (none)
    // isn't counted. A has voted, C and D haven't → not all voted.
    expect(game.hasAllPlayersVoted()).toBe(false);

    game.handleDayVote('c-sid', 'a-sid');
    game.handleDayVote('d-sid', 'a-sid');
    // Now all 3 alive players have voted (b is dead)
    expect(game.hasAllPlayersVoted()).toBe(true);
  });

  it('queues partner suicide when a lover disconnects', () => {
    addPlayer('L1', 'l1-sid', 'VILLAGER');
    addPlayer('L2', 'l2-sid', 'VILLAGER');
    addPlayer('V', 'v-sid', 'VILLAGER');
    addPlayer('W', 'w-sid', 'WEREWOLF');

    game.setLovers(['l1-sid', 'l2-sid']);

    game.handleDisconnect('l1-sid');

    // The partner's PARTNER_SUICIDE is now in the death queue
    expect(game.isOneOfLoversInDeathQueue()).toBe(true);
  });

  it('is idempotent — disconnecting an already-dead player emits nothing new', () => {
    const p = addPlayer('Alice', 'a-sid', 'VILLAGER');

    // Kill once
    game.handleDisconnect('a-sid');
    const firstDeathEmits = ioEmitSpy.mock.calls.filter(
      (c) => c[0] === 'lobby:player-died'
    ).length;
    const firstSocketEmits = socketEmit.get('a-sid')?.mock.calls.filter(
      (c) => c[0] === 'alert:player-is-dead'
    ).length;

    // Second disconnect (adapter double-fire)
    game.handleDisconnect('a-sid');

    const secondDeathEmits = ioEmitSpy.mock.calls.filter(
      (c) => c[0] === 'lobby:player-died'
    ).length;
    const secondSocketEmits = socketEmit.get('a-sid')?.mock.calls.filter(
      (c) => c[0] === 'alert:player-is-dead'
    ).length;

    expect(p.isAlive).toBe(false);
    expect(firstDeathEmits).toBe(1);
    expect(secondDeathEmits).toBe(firstDeathEmits);
    expect(secondSocketEmits).toBe(firstSocketEmits);
  });

  it('ignores an unknown socket id without throwing', () => {
    expect(() => game.handleDisconnect('not-a-real-sid')).not.toThrow();
    expect(ioEmitSpy).not.toHaveBeenCalledWith(
      'lobby:player-died',
      'not-a-real-sid'
    );
  });
});
