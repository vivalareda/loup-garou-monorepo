export const segments = [
  'CUPID',
  'LOVERS',
  'WEREWOLF',
  'WITCH',
  'SEER',
  'DAY',
] as const;

export type SegmentType = (typeof segments)[number];

export type Segment = {
  type: SegmentType;
  audioFiles: string[];
  action: () => void;
  skip: boolean;
};
