import { describe, it, expect } from 'vitest';
import { resolveMeasureLabels } from '../../src/utils/measureLabels';
import type { Measure } from '../../src/models/Exercise';

function makeMeasure(rehearsalNumber: string | number | null): Measure {
  return {
    meter: [4, 4],
    beats: [],
    tempo: null,
    rehearsalNumber,
    gradualTempo: null,
  };
}

describe('resolveMeasureLabels', () => {
  it('auto-numbers from 1 when no explicit labels', () => {
    const measures = [makeMeasure(null), makeMeasure(null), makeMeasure(null)];
    expect(resolveMeasureLabels(measures)).toEqual([1, 2, 3]);
  });

  it('uses explicit rehearsal numbers', () => {
    const measures = [makeMeasure(null), makeMeasure('80a'), makeMeasure(null)];
    expect(resolveMeasureLabels(measures)).toEqual([1, '80a', 2]);
  });

  it('resumes numeric counting after string label', () => {
    // 1, II, III, IV, 2 — roman numerals are strings; after IV, resolves to 2
    const measures = [
      makeMeasure(1),
      makeMeasure('II'),
      makeMeasure('III'),
      makeMeasure('IV'),
      makeMeasure(null),
    ];
    expect(resolveMeasureLabels(measures)).toEqual([1, 'II', 'III', 'IV', 2]);
  });
});
