import { describe, it, expect } from 'vitest';
import { computeSubBeatCount } from './subdivisionPlayback';

describe('computeSubBeatCount', () => {
  // 4/4: quarter beat = 1 subdivision of denominator 4
  it('4/4 quarter beat — eighths → 2', () => {
    expect(computeSubBeatCount(1, 4, 'eighths')).toBe(2);
  });
  it('4/4 quarter beat — sixteenths → 4', () => {
    expect(computeSubBeatCount(1, 4, 'sixteenths')).toBe(4);
  });

  // 6/8: dotted-quarter beat = 3 subdivisions of denominator 8
  it('6/8 dotted-quarter beat — eighths → 3', () => {
    expect(computeSubBeatCount(3, 8, 'eighths')).toBe(3);
  });
  it('6/8 dotted-quarter beat — sixteenths → 6', () => {
    expect(computeSubBeatCount(3, 8, 'sixteenths')).toBe(6);
  });

  // 6/16: dotted-eighth beat = 3 subdivisions of denominator 16
  it('6/16 dotted-eighth beat — eighths → null (1.5, not integer)', () => {
    expect(computeSubBeatCount(3, 16, 'eighths')).toBeNull();
  });
  it('6/16 dotted-eighth beat — sixteenths → 3', () => {
    expect(computeSubBeatCount(3, 16, 'sixteenths')).toBe(3);
  });

  // 3/8: single eighth beat = 1 subdivision of denominator 8
  it('3/8 single eighth beat — eighths → null (count=1, < 2)', () => {
    expect(computeSubBeatCount(1, 8, 'eighths')).toBeNull();
  });
  it('3/8 single eighth beat — sixteenths → 2', () => {
    expect(computeSubBeatCount(1, 8, 'sixteenths')).toBe(2);
  });
});
