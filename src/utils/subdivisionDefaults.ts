import type { Beat } from '../models/Exercise';

/**
 * Returns the default beat groupings for a given time signature.
 * Falls back to sensible inference for unusual meters.
 */
export function defaultBeats(numerator: number, denominator: number): Beat[] {
  const key = `${numerator}/${denominator}`;
  const groupings = DEFAULTS[key] ?? inferGroupings(numerator);
  return groupings.map((subdivisions) => ({ subdivisions, hold: null }));
}

const DEFAULTS: Record<string, number[]> = {
  '4/4': [1, 1, 1, 1],
  '3/4': [1, 1, 1],
  '2/4': [1, 1],
  '6/8': [3, 3],
  '9/8': [3, 3, 3],
  '12/8': [3, 3, 3, 3],
  '10/8': [3, 3, 2, 2],
  '5/8': [3, 2],
  '7/8': [2, 2, 3],
  '8/8': [3, 3, 2],
  '2/2': [1, 1],
  '3/2': [1, 1, 1],
};

function inferGroupings(numerator: number): number[] {
  // Prefer groups of 3, then fill remainder with 2s
  const groupings: number[] = [];
  let remaining = numerator;
  while (remaining >= 3) {
    groupings.push(3);
    remaining -= 3;
  }
  if (remaining > 0) {
    groupings.push(remaining);
  }
  return groupings.length > 0 ? groupings : [numerator];
}
