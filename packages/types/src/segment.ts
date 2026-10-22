export const segments = [
  'CUPID',
  'LOVERS',
  'SEER',
  'WEREWOLF',
  'WITCH',
  'HUNTER',
  'DAY',
] as const;

type WitchPhase = 'HEAL' | 'POISON';

type BaseSegment = (typeof segments)[number];

export type SegmentType = Exclude<BaseSegment, 'WITCH'> | `WITCH-${WitchPhase}`;
