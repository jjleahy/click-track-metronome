import type { Beat } from '../models/Exercise';

/**
 * Returns true when the sum of beat subdivisions equals the meter numerator.
 */
export function isMeasureValid(beats: Beat[], numerator: number): boolean {
  return beats.reduce((sum, b) => sum + b.subdivisions, 0) === numerator;
}

export type ValidationStatus = 'valid' | 'underfill' | 'overfill';

/**
 * Returns whether the measure is valid, underfilled, or overfilled.
 * Any beat with subdivisions === 0 is treated as underfill regardless of sum.
 */
export function measureValidationStatus(beats: Beat[], numerator: number): ValidationStatus {
  if (beats.some(b => b.subdivisions === 0)) return 'underfill';
  const sum = beats.reduce((s, b) => s + b.subdivisions, 0);
  if (sum < numerator) return 'underfill';
  if (sum > numerator) return 'overfill';
  return 'valid';
}

/**
 * Returns true when the measure is underfilled and no beat already has subdivisions === 0,
 * meaning we should auto-insert a placeholder beat at the end.
 */
export function shouldAutoInsertBeat(beats: Beat[], numerator: number): boolean {
  const status = measureValidationStatus(beats, numerator);
  if (status !== 'underfill') return false;
  return !beats.some(b => b.subdivisions === 0);
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
