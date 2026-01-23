import { describe, expect, it } from 'vitest';
import type { SegmentState } from '../mock-states.js';
import { mockSegmentStates } from '../mock-states.js';

describe('mockSegmentStates', () => {
  it('should export an array of segment states', () => {
    expect(mockSegmentStates).toBeDefined();
    expect(Array.isArray(mockSegmentStates)).toBe(true);
  });

  it('should contain all required segment types', () => {
    const segmentTypes = mockSegmentStates.map((s) => s.type);
    expect(segmentTypes).toContain('CUPID');
    expect(segmentTypes).toContain('LOVERS_REVEAL');
    expect(segmentTypes).toContain('WEREWOLF');
    expect(segmentTypes).toContain('WITCH-HEAL');
    expect(segmentTypes).toContain('WITCH-POISON');
    expect(segmentTypes).toContain('SEER');
    expect(segmentTypes).toContain('HUNTER');
    expect(segmentTypes).toContain('DAY_VOTE');
  });

  it('should have 8 segment states', () => {
    expect(mockSegmentStates).toHaveLength(8);
  });

  it('should have all segments with skip set to false', () => {
    for (const segment of mockSegmentStates) {
      expect(segment.skip).toBe(false);
    }
  });

  it('should have properly typed segment states', () => {
    const segmentState: SegmentState = {
      type: 'CUPID',
      skip: false,
    };
    expect(segmentState.type).toBe('CUPID');
    expect(segmentState.skip).toBe(false);
  });

  it('should support all segment types in SegmentState type', () => {
    const segmentTypes = [
      'CUPID',
      'LOVERS_REVEAL',
      'WEREWOLF',
      'WITCH-HEAL',
      'WITCH-POISON',
      'SEER',
      'HUNTER',
      'DAY_VOTE',
    ] as const;

    for (const type of segmentTypes) {
      const segment: SegmentState = { type, skip: false };
      expect(segment.type).toBe(type);
    }
  });

  it('should support skip property variation', () => {
    const skippedSegment: SegmentState = {
      type: 'WEREWOLF',
      skip: true,
    };
    expect(skippedSegment.skip).toBe(true);
  });
});
