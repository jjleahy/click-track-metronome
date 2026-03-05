import type { Measure } from './Exercise';
import type { NoteType } from '../utils/noteGlyphs';

export interface AccelRitZone {
  type: 'start' | 'end' | 'through' | 'single';
  color: 'red' | 'blue' | 'gray';
  sourceIndex: number; // measure index where gradualTempo originates (for deletion)
}

export interface ResolvedBeat {
  index: number;
  subdivisions: number;
  noteType: NoteType;
  x: number;              // px from measure left edge
  tempoDurationMs: number; // tempo-derived duration at 100% speed, ignoring holds
  durationMs: number;     // actual playback duration at 100% speed (= tempoDurationMs unless hold overrides)
  startMs: number;        // cumulative from exercise start, at 100% speed
  hold: number | null;    // hold duration in seconds, or null for normal playback
  geoRatio: number | null; // per-beat geometric tempo multiplier within a gradual span; null outside any span
}

export interface ResolvedMeasure {
  index: number;
  source: Measure;
  meter: [number, number];
  tempo: number;
  effectiveTempo: number;  // internal (quarter-note) tempo at first beat, accounting for accel/rit interpolation
  tempoImplied: boolean;
  label: string | number;
  labelImplied: boolean;
  width: number;           // px
  xOffset: number;         // px from scroll content left (after clef)
  beats: ResolvedBeat[];
  startMs: number;         // cumulative from exercise start
  durationMs: number;      // total measure duration at 100% speed
  accelRitEnding: AccelRitZone | null;   // left zone (TIME_SIG_WIDTH area) — span terminates or passes through
  accelRitStarting: AccelRitZone | null; // right zone (note area) — span begins, passes through, or is single
}
