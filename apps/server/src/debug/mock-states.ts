import type { SegmentType } from '@repo/types';

export type SegmentState = {
  type: SegmentType | 'LOVERS_REVEAL' | 'SEER';
  skip: boolean;
};

export const mockSegmentStates: SegmentState[] = [
  { type: 'CUPID', skip: false },
  { type: 'LOVERS_REVEAL', skip: false },
  { type: 'WEREWOLF', skip: false },
  { type: 'WITCH-HEAL', skip: false },
  { type: 'WITCH-POISON', skip: false },
  { type: 'SEER', skip: false },
  { type: 'HUNTER', skip: false },
  { type: 'DAY_VOTE', skip: false },
];
