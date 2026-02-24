// SMuFL / Bravura glyph constants and note-type resolution utilities.

import type { Beat } from '../models/Exercise';
import {
  TIME_SIG_WIDTH,
  SPACE_AFTER_TIMESIG,
  NOTE_SPACING,
  SPACE_AFTER_NOTES,
  BARLINE_WIDTH,
  NOTE_WIDTH_WHOLE,
  NOTE_WIDTH_HALF,
  NOTE_WIDTH_QUARTER,
  NOTE_WIDTH_FLAGGED,
  DOT_EXTRA_WIDTH,
} from '../components/ScoreEditor/staffConstants';

// --- SMuFL time-signature digits (U+E080 .. U+E089) ---
const TIMESIG_DIGITS = [
  '\uE080', '\uE081', '\uE082', '\uE083', '\uE084',
  '\uE085', '\uE086', '\uE087', '\uE088', '\uE089',
];

// --- Noteheads ---
export const NOTEHEAD_WHOLE = '\uE0A2';
export const NOTEHEAD_HALF  = '\uE0A3';
export const NOTEHEAD_BLACK = '\uE0A4'; // quarter, eighth, sixteenth

// --- Flags ---
export const FLAG_8TH_UP  = '\uE240';
export const FLAG_16TH_UP = '\uE242';

// --- Augmentation dot ---
export const AUG_DOT = '\uE1E7';

// ---------------------------------------------------------------------------
// Time-signature digit conversion
// ---------------------------------------------------------------------------

/** Convert a number (0–19) to a string of Bravura time-sig digit glyphs. */
export function numberToBravura(n: number): string {
  if (n < 0 || n > 19 || !Number.isInteger(n)) return '';
  return String(n)
    .split('')
    .map((ch) => TIMESIG_DIGITS[Number(ch)])
    .join('');
}

/** Parse a string of Bravura time-sig digit glyphs back to a number, or null. */
export function bravuraToNumber(s: string): number | null {
  if (s.length === 0) return null;
  let result = '';
  for (const ch of s) {
    const idx = TIMESIG_DIGITS.indexOf(ch);
    if (idx === -1) return null;
    result += String(idx);
  }
  const n = Number(result);
  return Number.isInteger(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Note-type resolution
// ---------------------------------------------------------------------------

export type NoteType =
  | 'whole'
  | 'half'
  | 'dotted-half'
  | 'quarter'
  | 'dotted-quarter'
  | 'eighth'
  | 'dotted-eighth'
  | 'sixteenth'
  | 'dotted-sixteenth'
  | 'fallback';

/**
 * Map a beat's duration (subdivisions / denominator, as fraction of a whole note)
 * to a standard note type.
 *
 * Examples:
 *   4/4 time, 1 subdivision per beat → 1/4 → quarter
 *   6/8 time, 3 subdivisions per beat → 3/8 → dotted-quarter
 *   3/4 time, 3 subdivisions per beat → 3/4 → dotted-half
 */
export function noteForBeat(denominator: number, subdivisions: number): NoteType {
  const duration = subdivisions / denominator;
  const map: [number, NoteType][] = [
    [1,     'whole'],
    [3 / 4, 'dotted-half'],
    [1 / 2, 'half'],
    [3 / 8, 'dotted-quarter'],
    [1 / 4, 'quarter'],
    [3 / 16, 'dotted-eighth'],
    [1 / 8, 'eighth'],
    [3 / 32, 'dotted-sixteenth'],
    [1 / 16, 'sixteenth'],
  ];
  for (const [dur, type] of map) {
    if (Math.abs(duration - dur) < 1e-9) return type;
  }
  return 'fallback';
}

// ---------------------------------------------------------------------------
// Note-width helpers
// ---------------------------------------------------------------------------

/** Pixel width for a given note type (glyph only, not including spacing). */
export function noteWidthForType(noteType: NoteType): number {
  switch (noteType) {
    case 'whole':
      return NOTE_WIDTH_WHOLE;
    case 'half':
      return NOTE_WIDTH_HALF;
    case 'dotted-half':
      return NOTE_WIDTH_HALF + DOT_EXTRA_WIDTH;
    case 'quarter':
      return NOTE_WIDTH_QUARTER;
    case 'dotted-quarter':
      return NOTE_WIDTH_QUARTER + DOT_EXTRA_WIDTH;
    case 'eighth':
      return NOTE_WIDTH_FLAGGED;
    case 'dotted-eighth':
      return NOTE_WIDTH_FLAGGED + DOT_EXTRA_WIDTH;
    case 'sixteenth':
      return NOTE_WIDTH_FLAGGED;
    case 'dotted-sixteenth':
      return NOTE_WIDTH_FLAGGED + DOT_EXTRA_WIDTH;
    case 'fallback':
      return NOTE_WIDTH_QUARTER; // same as quarter for layout
  }
}

// ---------------------------------------------------------------------------
// Note x-position computation
// ---------------------------------------------------------------------------

export interface NotePosition {
  x: number;
  noteType: NoteType;
  subdivisions: number;
}

/**
 * Compute the x-position and note type for each beat in a measure.
 *
 * Positions start after the time-sig area and advance by each note's width
 * plus inter-note spacing.
 */
export function computeNotePositions(beats: Beat[], denominator: number): NotePosition[] {
  const positions: NotePosition[] = [];
  let nx = TIME_SIG_WIDTH + SPACE_AFTER_TIMESIG;
  for (let i = 0; i < beats.length; i++) {
    const noteType = noteForBeat(denominator, beats[i].subdivisions);
    positions.push({ x: nx, noteType, subdivisions: beats[i].subdivisions });
    nx += noteWidthForType(noteType);
    if (i < beats.length - 1) nx += NOTE_SPACING;
  }
  return positions;
}

// ---------------------------------------------------------------------------
// Measure-width computation
// ---------------------------------------------------------------------------

/** Minimum measure width floor (prevents degenerate narrow measures). */
const MIN_MEASURE_WIDTH = 80;

/**
 * Compute the total pixel width of a measure based on its beats and denominator.
 *
 * Layout: [time-sig] [gap] [note₁] [spacing] [note₂] ... [noteₙ] [gap] [barline]
 */
export function computeMeasureWidth(beats: Beat[], denominator: number): number {
  if (beats.length === 0) return MIN_MEASURE_WIDTH;

  let notesWidth = 0;
  for (let i = 0; i < beats.length; i++) {
    const nt = noteForBeat(denominator, beats[i].subdivisions);
    notesWidth += noteWidthForType(nt);
    if (i < beats.length - 1) {
      notesWidth += NOTE_SPACING;
    }
  }

  const total =
    TIME_SIG_WIDTH +
    SPACE_AFTER_TIMESIG +
    notesWidth +
    SPACE_AFTER_NOTES +
    BARLINE_WIDTH;

  return Math.max(total, MIN_MEASURE_WIDTH);
}
