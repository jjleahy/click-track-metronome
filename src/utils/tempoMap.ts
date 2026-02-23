import type { Measure } from '../models/Exercise';

export interface ResolvedMeasure {
  index: number;
  tempo: number;           // beats per minute, resolved (never null)
  meter: [number, number];
}

/**
 * Walks measures left to right, resolving inherited tempos.
 * Gradual tempo changes (accel/rit) are not yet applied in Stage 1.
 */
export function resolveTempoMap(measures: Measure[]): ResolvedMeasure[] {
  let currentTempo = 80;
  return measures.map((m, i) => {
    if (m.tempo !== null) {
      currentTempo = m.tempo;
    }
    return { index: i, tempo: currentTempo, meter: m.meter };
  });
}
