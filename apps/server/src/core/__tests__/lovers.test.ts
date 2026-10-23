import { describe, expect, it, vi } from 'vitest';
import { Lovers } from '@/core/lovers';
import { Player } from '@/core/player';
import type { Broadcaster } from '@/server/broadcaster';

const io = {
  to: vi.fn().mockReturnThis(),
  emit: vi.fn(),
} satisfies Broadcaster;

function couple() {
  const romeo = new Player('Romeo', 'romeo-sid', io);
  const juliet = new Player('Juliet', 'juliet-sid', io);
  const lovers = new Lovers();

  lovers.set([romeo, juliet]);

  return { lovers, romeo, juliet };
}

describe('Lovers', () => {
  it('returns each lover as the partner of the other', () => {
    const { lovers, romeo, juliet } = couple();

    expect(lovers.getPartner(romeo)).toBe(juliet);
    expect(lovers.getPartner(juliet)).toBe(romeo);
  });

  it('gives a player outside the couple no partner', () => {
    const { lovers } = couple();
    const outsider = new Player('Mercutio', 'mercutio-sid', io);

    expect(lovers.isLover(outsider)).toBe(false);
    expect(lovers.getPartner(outsider)).toBeUndefined();
  });

  it('identifies lovers by socket ID, not object identity', () => {
    const { lovers, juliet } = couple();
    const sameSocketRomeo = new Player('Romeo', 'romeo-sid', io);

    expect(lovers.isLover(sameSocketRomeo)).toBe(true);
    expect(lovers.getPartner(sameSocketRomeo)).toBe(juliet);
  });

  it('forgets the couple on clear', () => {
    const { lovers, romeo } = couple();

    lovers.clear();

    expect(lovers.get()).toHaveLength(0);
    expect(lovers.isLover(romeo)).toBe(false);
  });
});
