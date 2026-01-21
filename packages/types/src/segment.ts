export const segments = [
  'CUPID',
  'LOVERS',
  'WEREWOLF',
  'WITCH',
  'HUNTER',
  // 'SEER',
  'DAY_VOTE',
] as const;

type WitchPhase = 'HEAL' | 'POISON';
type BaseSegment = (typeof segments)[number];

export type SegmentType = Exclude<BaseSegment, 'WITCH'> | `WITCH-${WitchPhase}`;

export type Segment = {
  type: SegmentType;
  skip: boolean;
};
