import { describe, it, expect } from 'vitest';
import { defaultBeats } from '../../src/utils/subdivisionDefaults';

describe('defaultBeats', () => {
  it('returns four quarter beats for 4/4', () => {
    const beats = defaultBeats(4, 4);
    expect(beats).toHaveLength(4);
    expect(beats.every(b => b.subdivisions === 1)).toBe(true);
  });

  it('returns two dotted-quarter beats for 6/8', () => {
    const beats = defaultBeats(6, 8);
    expect(beats).toEqual([
      { subdivisions: 3, hold: null, highlightSubdivisions: 0, highlights: [] },
      { subdivisions: 3, hold: null, highlightSubdivisions: 0, highlights: [] },
    ]);
  });

  it('returns 3+2 grouping for 5/8', () => {
    const beats = defaultBeats(5, 8);
    expect(beats).toEqual([
      { subdivisions: 3, hold: null, highlightSubdivisions: 0, highlights: [] },
      { subdivisions: 2, hold: null, highlightSubdivisions: 0, highlights: [] },
    ]);
  });

  it('infers groupings for unusual meters', () => {
    const beats = defaultBeats(11, 8); // no entry in defaults
    const total = beats.reduce((sum, b) => sum + b.subdivisions, 0);
    expect(total).toBe(11);
  });
});
