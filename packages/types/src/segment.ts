export const SEGMENTS = [
  'CUPID',
  'LOVERS',
  'WEREWOLF',
  'WITCH',
  'SEER',
  'DAY',
] as const;

export type SegmentType = (typeof SEGMENTS)[number];

export type Segment = {
  type: SegmentType;
  audioFiles: string[];
  action: () => void;
  onFirstNightOnly?: boolean;
  skip: boolean;
};
