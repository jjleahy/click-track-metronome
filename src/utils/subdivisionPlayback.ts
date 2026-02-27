/**
 * Computes how many evenly-spaced sub-beats fit within one big beat at the
 * given subdivision level.
 *
 * @param beatSubdivisions  - the number of denominator units in this big beat
 * @param denominator       - the time signature denominator (e.g. 4, 8, 16)
 * @param level             - 'eighths' or 'sixteenths'
 * @returns integer sub-beat count if it divides evenly and is ≥ 2, else null
 */
export function computeSubBeatCount(
  beatSubdivisions: number,
  denominator: number,
  level: 'eighths' | 'sixteenths',
): number | null {
  const divisor = level === 'eighths' ? 8 : 16;
  const count = (divisor * beatSubdivisions) / denominator;
  if (!Number.isInteger(count) || count < 2) return null;
  return count;
}
