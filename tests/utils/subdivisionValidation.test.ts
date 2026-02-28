import { describe, it, expect } from 'vitest';
import {
  isMeasureValid,
  applySubdivisionChange,
  measureValidationStatus,
  shouldAutoInsertBeat,
} from '../../src/utils/subdivisionValidation';
import type { Beat } from '../../src/models/Exercise';

function beats(...subs: number[]): Beat[] {
  return subs.map((subdivisions) => ({ subdivisions, hold: null }));
}

describe('isMeasureValid', () => {
  it('returns true for valid 4/4 [1,1,1,1]', () => {
    expect(isMeasureValid(beats(1, 1, 1, 1), 4)).toBe(true);
  });

  it('returns false for underfill (3 beats in 4/4)', () => {
    expect(isMeasureValid(beats(1, 1, 1), 4)).toBe(false);
  });

  it('returns false for overflow (sum > numerator)', () => {
    expect(isMeasureValid(beats(1, 1, 1, 2), 4)).toBe(false);
  });

  it('returns true for valid 6/8 [3,3]', () => {
    expect(isMeasureValid(beats(3, 3), 6)).toBe(true);
  });

  it('returns false for empty beats array', () => {
    expect(isMeasureValid([], 4)).toBe(false);
  });
});

describe('applySubdivisionChange', () => {
  it('no overflow: returns updated beats unchanged', () => {
    // 8/8 [3,3,2] change index 0 to 3 → [3,3,2] (sum = 8)
    const result = applySubdivisionChange(beats(3, 3, 2), 0, 3, 8);
    expect(result.map((b) => b.subdivisions)).toEqual([3, 3, 2]);
  });

  it('trims one beat from right when overflow', () => {
    // 8/8 [3,3,2] change index 0 to 4 → 4+3+2=9 > 8, trim last → [4,3] (sum=7)
    const result = applySubdivisionChange(beats(3, 3, 2), 0, 4, 8);
    expect(result.map((b) => b.subdivisions)).toEqual([4, 3]);
  });

  it('trims down to changedIndex+1 when large value', () => {
    // 6/8 [3,3] change index 1 to 5 → 3+5=8 > 6, nothing to trim right of index 1 → [3,5]
    const result = applySubdivisionChange(beats(3, 3), 1, 5, 6);
    expect(result.map((b) => b.subdivisions)).toEqual([3, 5]);
  });

  it('trims multiple beats when needed', () => {
    // 4/4 [1,1,1,1] change index 0 to 3 → 3+1+1+1=6 > 4, trim: 3+1+1=5>4, 3+1=4 → [3,1]
    const result = applySubdivisionChange(beats(1, 1, 1, 1), 0, 3, 4);
    expect(result.map((b) => b.subdivisions)).toEqual([3, 1]);
  });

  it('zero value causes underfill (no trimming needed)', () => {
    // 4/4 [1,1,1,1] change index 0 to 0 → [0,1,1,1] sum=3 < 4, no trim
    const result = applySubdivisionChange(beats(1, 1, 1, 1), 0, 0, 4);
    expect(result.map((b) => b.subdivisions)).toEqual([0, 1, 1, 1]);
  });

  it('preserves hold values on unchanged beats', () => {
    const input: Beat[] = [
      { subdivisions: 3, hold: 2.5 },
      { subdivisions: 3, hold: null },
    ];
    const result = applySubdivisionChange(input, 0, 3, 6);
    expect(result[0].hold).toBe(2.5);
    expect(result[1].hold).toBe(null);
  });
});

describe('measureValidationStatus', () => {
  it('returns valid when sum equals numerator', () => {
    expect(measureValidationStatus(beats(1, 1, 1, 1), 4)).toBe('valid');
  });

  it('returns underfill when sum < numerator', () => {
    expect(measureValidationStatus(beats(1, 1), 4)).toBe('underfill');
  });

  it('returns overfill when sum > numerator', () => {
    expect(measureValidationStatus(beats(3, 3), 4)).toBe('overfill');
  });

  it('returns underfill when any beat has subdivisions === 0', () => {
    // sum is 4 but a beat is 0, so treat as underfill
    expect(measureValidationStatus(beats(0, 1, 1, 1, 1), 4)).toBe('underfill');
  });

  it('returns underfill for empty beats array', () => {
    expect(measureValidationStatus([], 4)).toBe('underfill');
  });
});

describe('shouldAutoInsertBeat', () => {
  it('returns true when underfilled with no zero-beats', () => {
    expect(shouldAutoInsertBeat(beats(1, 1), 4)).toBe(true);
  });

  it('returns false when underfilled but a beat is already 0', () => {
    expect(shouldAutoInsertBeat(beats(0, 1, 1), 4)).toBe(false);
  });

  it('returns false when measure is valid', () => {
    expect(shouldAutoInsertBeat(beats(1, 1, 1, 1), 4)).toBe(false);
  });

  it('returns false when measure is overfilled', () => {
    expect(shouldAutoInsertBeat(beats(3, 3), 4)).toBe(false);
  });
});
