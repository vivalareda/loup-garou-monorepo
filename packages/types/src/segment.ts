export const segments = [
  'CUPID',
  'LOVERS',
  'WEREWOLF',
  'WITCH',
  // 'SEER',
  'DAY',
] as const;

type WitchPhase = 'HEAL' | 'POISON';
type BaseSegment = (typeof segments)[number];

export type SegmentType = Exclude<BaseSegment, 'WITCH'> | `WITCH-${WitchPhase}`;

export type Segment = {
  type: SegmentType;
  action: () => void;
  skip: boolean;
};
