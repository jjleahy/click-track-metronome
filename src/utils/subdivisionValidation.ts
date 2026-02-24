import type { Beat } from '../models/Exercise';

/**
 * Returns true when the sum of beat subdivisions equals the meter numerator.
 */
export function isMeasureValid(beats: Beat[], numerator: number): boolean {
  return beats.reduce((sum, b) => sum + b.subdivisions, 0) === numerator;
}

/**
 * Returns a new beats array where beats[changedIndex].subdivisions = newValue,
 * then trims beats from the right (indices > changedIndex) until sum <= numerator
 * or no more beats remain to trim. Never modifies beats at index <= changedIndex.
 */
export function applySubdivisionChange(
  beats: Beat[],
  changedIndex: number,
  newValue: number,
  numerator: number
): Beat[] {
  const result: Beat[] = beats.map((b, i) =>
    i === changedIndex ? { ...b, subdivisions: newValue } : { ...b }
  );

  // Trim from right until sum <= numerator
  while (result.length > changedIndex + 1) {
    const sum = result.reduce((s, b) => s + b.subdivisions, 0);
    if (sum <= numerator) break;
    result.pop();
  }

  return result;
}
