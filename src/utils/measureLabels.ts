import type { Measure } from '../models/Exercise';

/**
 * Resolves the display label for every measure by walking left to right.
 *
 * Rules:
 * 1. If the measure has an explicit rehearsalNumber, use it.
 * 2. Otherwise, find the nearest prior measure with a numeric value and add 1.
 * 3. If no prior numeric value exists, default to 1.
 */
export function resolveMeasureLabels(measures: Measure[]): (string | number)[] {
  const labels: (string | number)[] = [];
  let lastNumeric = 0; // tracks last resolved numeric label (0 = none yet)

  for (const m of measures) {
    if (m.rehearsalNumber !== null) {
      labels.push(m.rehearsalNumber);
      if (typeof m.rehearsalNumber === 'number') {
        lastNumeric = m.rehearsalNumber;
      }
    } else {
      const implied = lastNumeric + 1;
      labels.push(implied);
      lastNumeric = implied;
    }
  }

  return labels;
}
