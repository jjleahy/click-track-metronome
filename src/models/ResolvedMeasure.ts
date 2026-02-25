import type { Measure } from './Exercise';
import type { NoteType } from '../utils/noteGlyphs';

export interface ResolvedBeat {
  index: number;
  subdivisions: number;
  noteType: NoteType;
  x: number;              // px from measure left edge
  durationMs: number;     // at 100% speed
  startMs: number;        // cumulative from exercise start, at 100% speed
}

export interface ResolvedMeasure {
  index: number;
  source: Measure;
  meter: [number, number];
  tempo: number;
  tempoImplied: boolean;
  label: string | number;
  labelImplied: boolean;
  width: number;           // px
  xOffset: number;         // px from scroll content left (after clef)
  beats: ResolvedBeat[];
  startMs: number;         // cumulative from exercise start
  durationMs: number;      // total measure duration at 100% speed
}
