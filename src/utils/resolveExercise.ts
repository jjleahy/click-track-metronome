import type { Measure } from '../models/Exercise';
import type { ResolvedMeasure, ResolvedBeat } from '../models/ResolvedMeasure';
import { resolveTempoMap } from './tempoMap';
import { resolveMeasureLabels } from './measureLabels';
import { computeNotePositions, computeMeasureWidth } from './noteGlyphs';

/**
 * Resolve all derived data for an exercise's measures in a single pass.
 *
 * Composes existing utilities (tempo map, labels, note positions, widths)
 * and adds cumulative timing and x-offset data.  All timing values are
 * at 100% playback speed; consumers scale by percentage as needed.
 */
export function resolveExercise(measures: Measure[]): ResolvedMeasure[] {
  const tempoMap = resolveTempoMap(measures);
  const labels = resolveMeasureLabels(measures);

  let cumulativeMs = 0;
  let cumulativeX = 0;

  return measures.map((m, i) => {
    const [, denominator] = m.meter;
    const tempo = tempoMap[i].tempo;
    const width = computeMeasureWidth(m.beats, denominator);
    const notePositions = computeNotePositions(m.beats, denominator);

    const measureStartMs = cumulativeMs;
    const xOffset = cumulativeX;

    const beats: ResolvedBeat[] = m.beats.map((beat, bi) => {
      // Duration formula: subdivisions * (60000 / tempo) * (4 / denominator)
      // This converts quarter-note BPM to ms per subdivision unit, then scales
      // by the number of subdivision units in this beat.
      const durationMs = beat.subdivisions * (60000 / tempo) * (4 / denominator);
      const startMs = cumulativeMs;
      cumulativeMs += durationMs;

      return {
        index: bi,
        subdivisions: beat.subdivisions,
        noteType: notePositions[bi].noteType,
        x: notePositions[bi].x,
        durationMs,
        startMs,
      };
    });

    const durationMs = cumulativeMs - measureStartMs;
    cumulativeX += width;

    return {
      index: i,
      source: m,
      meter: m.meter,
      tempo,
      tempoImplied: m.tempo === null,
      label: labels[i],
      labelImplied: m.rehearsalNumber === null,
      width,
      xOffset,
      beats,
      startMs: measureStartMs,
      durationMs,
    };
  });
}
