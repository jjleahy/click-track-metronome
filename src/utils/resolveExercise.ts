import type { Measure } from '../models/Exercise';
import type { ResolvedMeasure, ResolvedBeat, AccelRitZone } from '../models/ResolvedMeasure';
import { resolveTempoMap } from './tempoMap';
import { resolveMeasureLabels } from './measureLabels';
import { computeNotePositions, computeMeasureWidth } from './noteGlyphs';
import { tempoFromBeatDuration } from './tempoConversion';

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

  const resolved: ResolvedMeasure[] = measures.map((m, i) => {
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
      const tempoDurationMs = beat.subdivisions * (60000 / tempo) * (4 / denominator);
      const startMs = cumulativeMs;
      cumulativeMs += tempoDurationMs;

      return {
        index: bi,
        subdivisions: beat.subdivisions,
        noteType: notePositions[bi].noteType,
        x: notePositions[bi].x,
        tempoDurationMs,
        durationMs: tempoDurationMs,
        startMs,
        hold: beat.hold,
        geoRatio: null,
      };
    });

    const durationMs = cumulativeMs - measureStartMs;
    cumulativeX += width;

    return {
      index: i,
      source: m,
      meter: m.meter,
      tempo,
      effectiveTempo: tempo,
      tempoImplied: m.tempo === null,
      label: labels[i],
      labelImplied: m.rehearsalNumber === null,
      width,
      xOffset,
      beats,
      startMs: measureStartMs,
      durationMs,
      accelRitEnding: null,
      accelRitStarting: null,
    };
  });

  // Second pass: compute accel/rit zone info
  for (let i = 0; i < measures.length; i++) {
    const m = measures[i];
    if (m.gradualTempo === null) continue;

    const gt = m.gradualTempo;
    const startTempo = tempoMap[i].tempo;

    if (gt.measureLength === 0) {
      // Single-measure span
      const arrivalTempo = gt.endTempo ?? startTempo;
      const color = accelRitColor(startTempo, arrivalTempo);
      resolved[i].accelRitStarting = { type: 'single', color, sourceIndex: i };
    } else {
      const arrivalIndex = i + gt.measureLength;
      const arrivalTempo = arrivalIndex < measures.length ? tempoMap[arrivalIndex].tempo : startTempo;
      const color = accelRitColor(startTempo, arrivalTempo);

      resolved[i].accelRitStarting = { type: 'start', color, sourceIndex: i };

      for (let j = i + 1; j < arrivalIndex && j < measures.length; j++) {
        resolved[j].accelRitEnding = { type: 'through', color, sourceIndex: i };
        resolved[j].accelRitStarting = { type: 'through', color, sourceIndex: i };
      }

      if (arrivalIndex < measures.length) {
        resolved[arrivalIndex].accelRitEnding = { type: 'end', color, sourceIndex: i };
      }
    }
  }

  // Pass 3a: Apply geometric tempo interpolation to gradual tempo spans
  for (let i = 0; i < measures.length; i++) {
    const m = measures[i];
    if (m.gradualTempo === null) continue;

    const gt = m.gradualTempo;
    const startTempo = tempoMap[i].tempo;

    let endTempo: number;
    let spanEnd: number; // exclusive: first measure after the span

    if (gt.measureLength === 0) {
      endTempo = gt.endTempo ?? startTempo;
      spanEnd = i + 1;
    } else {
      const arrivalIndex = i + gt.measureLength;
      endTempo = arrivalIndex < measures.length
        ? tempoMap[arrivalIndex].tempo
        : startTempo;
      spanEnd = Math.min(arrivalIndex, measures.length);
    }

    // Collect all beats in span, tracking which measure each beat belongs to
    const spanBeats: { rb: ResolvedBeat; denominator: number; measureIdx: number }[] = [];
    for (let j = i; j < spanEnd; j++) {
      const [, denom] = measures[j].meter;
      for (const rb of resolved[j].beats) {
        spanBeats.push({ rb, denominator: denom, measureIdx: j });
      }
    }

    const N = spanBeats.length;
    if (N <= 1) continue;

    const ratio = endTempo / startTempo;
    const perBeatRatio = Math.pow(ratio, 1 / (N - 1));
    for (let k = 0; k < N; k++) {
      const { rb, denominator } = spanBeats[k];
      rb.geoRatio = perBeatRatio;
      const t = k / (N - 1);
      const interpolatedTempo = startTempo * Math.pow(ratio, t);
      // Always set tempoDurationMs from interpolated tempo (ignores holds)
      rb.tempoDurationMs = rb.subdivisions * (60000 / interpolatedTempo) * (4 / denominator);
    }

    // Update effectiveTempo for each measure in the span using its first beat's tempoDurationMs
    for (let j = i; j < spanEnd; j++) {
      const rm = resolved[j];
      const firstBeat = rm.beats[0];
      if (firstBeat) {
        rm.effectiveTempo = tempoFromBeatDuration(
          firstBeat.tempoDurationMs,
          firstBeat.subdivisions,
          rm.meter[1],
        );
      }
    }
  }

  // Pass 3b: Derive durationMs from tempoDurationMs, with hold overrides
  for (const rm of resolved) {
    for (const rb of rm.beats) {
      rb.durationMs = rb.hold !== null ? rb.hold * 1000 : rb.tempoDurationMs;
    }
  }

  // Pass 3c: Recompute all startMs from adjusted durations
  let cumMs = 0;
  for (const rm of resolved) {
    rm.startMs = cumMs;
    for (const rb of rm.beats) {
      rb.startMs = cumMs;
      cumMs += rb.durationMs;
    }
    rm.durationMs = cumMs - rm.startMs;
  }

  return resolved;
}

function accelRitColor(startTempo: number, endTempo: number): AccelRitZone['color'] {
  if (startTempo < endTempo) return 'red';
  if (startTempo > endTempo) return 'blue';
  return 'gray';
}

/**
 * Compute the set of measure indices whose ending zone is a valid landing target
 * for an accel/rit span starting at startIndex.
 *
 * The starting zone of startIndex itself is always valid for a single-measure span
 * (handled by the component directly, not included in this set).
 */
export function computeLandingTargets(
  resolved: ResolvedMeasure[],
  startIndex: number,
): Set<number> {
  const targets = new Set<number>();
  for (let i = startIndex + 1; i < resolved.length; i++) {
    if (resolved[i].accelRitEnding !== null) break; // occupied ending zone — stop
    targets.add(i);
    if (resolved[i].accelRitStarting !== null) break; // can't pass through occupied starting zone
    if (resolved[i].source.tempo !== null) break; // explicit tempo — valid arrival but can't span past
  }
  return targets;
}
