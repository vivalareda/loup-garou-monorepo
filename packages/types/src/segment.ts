export const segments = [
  'CUPID',
  'LOVERS',
  'WEREWOLF',
  'WITCH',
  'HUNTER',
  // 'SEER',
  'DAY_VOTE',
] as const;

export type SegmentType = (typeof segments)[number];

export type Segment = {
  type: SegmentType;
  skip: boolean;
};
