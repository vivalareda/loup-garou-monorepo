import type { PendingDeath } from '@repo/types';
import { describe, expect, it, vi } from 'vitest';
import { Game } from '@/core/game';
import type { SocketType } from '@/server/sockets';
import type { DeathManager } from '../death-manager';

describe('GameActions', () => {
  it('should kill lover when player dies', () => {
    const mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketType;

    const mockPendingDeaths: PendingDeath[] = [
      { playerId: 'player1', cause: 'WEREWOLVES' },
    ];

    const mockDeathManager = {
      getPendingDeaths: vi.fn().mockReturnValue(mockPendingDeaths),
    } as unknown as DeathManager;

    const game = new Game(mockIo, mockDeathManager);

    const player1 = game.addPlayer('player1', 'player1');
    const player2 = game.addPlayer('player2', 'player2');

    player1.assignRole('VILLAGER');
    player2.assignRole('VILLAGER');

    game.setLovers(['player1', 'player2']);

    const deathInfos = game.processPendingDeaths();

    expect(deathInfos).toHaveLength(2);
    expect(deathInfos?.[0]?.cause).toBe('WEREWOLVES');
    expect(deathInfos?.[1]?.cause).toBe('PARTNER_SUICIDE');
  });
});
