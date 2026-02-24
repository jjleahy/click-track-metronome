import { describe, it, expect } from 'vitest';
import {
  numberToBravura,
  bravuraToNumber,
  noteForBeat,
  noteWidthForType,
  computeMeasureWidth,
} from '../../src/utils/noteGlyphs';

// ---------------------------------------------------------------------------
// numberToBravura
// ---------------------------------------------------------------------------
describe('numberToBravura', () => {
  it('converts single digits to Bravura glyphs', () => {
    expect(numberToBravura(0)).toBe('\uE080');
    expect(numberToBravura(4)).toBe('\uE084');
    expect(numberToBravura(9)).toBe('\uE089');
  });

  it('converts multi-digit numbers', () => {
    expect(numberToBravura(12)).toBe('\uE081\uE082');
    expect(numberToBravura(16)).toBe('\uE081\uE086');
    expect(numberToBravura(19)).toBe('\uE081\uE089');
  });

  it('returns empty string for out-of-range values', () => {
    expect(numberToBravura(-1)).toBe('');
    expect(numberToBravura(20)).toBe('');
    expect(numberToBravura(1.5)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// bravuraToNumber
// ---------------------------------------------------------------------------
describe('bravuraToNumber', () => {
  it('parses single Bravura digit glyphs', () => {
    expect(bravuraToNumber('\uE084')).toBe(4);
    expect(bravuraToNumber('\uE080')).toBe(0);
  });

  it('parses multi-glyph strings', () => {
    expect(bravuraToNumber('\uE081\uE082')).toBe(12);
    expect(bravuraToNumber('\uE081\uE086')).toBe(16);
  });

  it('returns null for empty string', () => {
    expect(bravuraToNumber('')).toBeNull();
  });

  it('returns null for non-Bravura characters', () => {
    expect(bravuraToNumber('4')).toBeNull();
    expect(bravuraToNumber('abc')).toBeNull();
  });

  it('round-trips with numberToBravura', () => {
    for (let n = 0; n <= 19; n++) {
      expect(bravuraToNumber(numberToBravura(n))).toBe(n);
    }
  });
});

// ---------------------------------------------------------------------------
// noteForBeat
// ---------------------------------------------------------------------------
describe('noteForBeat', () => {
  it('maps standard durations in 4/4', () => {
    // 1 subdivision in denominator=4 → 1/4 → quarter
    expect(noteForBeat(4, 1)).toBe('quarter');
    // 2 subdivisions in denominator=4 → 2/4 = 1/2 → half
    expect(noteForBeat(4, 2)).toBe('half');
    // 4 subdivisions in denominator=4 → 4/4 = 1 → whole
    expect(noteForBeat(4, 4)).toBe('whole');
  });

  it('maps compound meter beats (6/8 style)', () => {
    // 3 subdivisions in denominator=8 → 3/8 → dotted-quarter
    expect(noteForBeat(8, 3)).toBe('dotted-quarter');
  });

  it('maps dotted-half (3/4)', () => {
    expect(noteForBeat(4, 3)).toBe('dotted-half');
  });

  it('maps eighth note', () => {
    expect(noteForBeat(8, 1)).toBe('eighth');
  });

  it('maps dotted-eighth (3/16)', () => {
    expect(noteForBeat(16, 3)).toBe('dotted-eighth');
  });

  it('maps sixteenth note', () => {
    expect(noteForBeat(16, 1)).toBe('sixteenth');
  });

  it('maps dotted-sixteenth (3/32)', () => {
    // denominator=32 isn't in valid set, but the math still works
    expect(noteForBeat(32, 3)).toBe('dotted-sixteenth');
  });

  it('returns fallback for non-standard durations', () => {
    // 5 subdivisions in denominator=8 → 5/8, no standard note
    expect(noteForBeat(8, 5)).toBe('fallback');
  });

  it('maps half note in 2/2', () => {
    // 1 subdivision in denominator=2 → 1/2 → half
    expect(noteForBeat(2, 1)).toBe('half');
  });

  it('maps whole note in 1/1', () => {
    expect(noteForBeat(1, 1)).toBe('whole');
  });
});

// ---------------------------------------------------------------------------
// noteWidthForType
// ---------------------------------------------------------------------------
describe('noteWidthForType', () => {
  it('returns positive widths for all note types', () => {
    const types = [
      'whole', 'half', 'dotted-half', 'quarter', 'dotted-quarter',
      'eighth', 'dotted-eighth', 'sixteenth', 'dotted-sixteenth', 'fallback',
    ] as const;
    for (const t of types) {
      expect(noteWidthForType(t)).toBeGreaterThan(0);
    }
  });

  it('dotted variants are wider than non-dotted', () => {
    expect(noteWidthForType('dotted-half')).toBeGreaterThan(noteWidthForType('half'));
    expect(noteWidthForType('dotted-quarter')).toBeGreaterThan(noteWidthForType('quarter'));
    expect(noteWidthForType('dotted-eighth')).toBeGreaterThan(noteWidthForType('eighth'));
  });
});

// ---------------------------------------------------------------------------
// computeMeasureWidth
// ---------------------------------------------------------------------------
describe('computeMeasureWidth', () => {
  const beat = (subdivisions: number) => ({ subdivisions, hold: null });

  it('computes width for 4/4 with 4 quarter notes', () => {
    const beats = [beat(1), beat(1), beat(1), beat(1)];
    const width = computeMeasureWidth(beats, 4);
    // TIME_SIG(40) + GAP(10) + 4×quarter(24) + 3×spacing(24) + GAP(10) + BAR(2)
    // = 40 + 10 + 96 + 72 + 10 + 2 = 230
    expect(width).toBeGreaterThan(100);
  });

  it('wider with more beats', () => {
    const two = [beat(1), beat(1)];
    const four = [beat(1), beat(1), beat(1), beat(1)];
    expect(computeMeasureWidth(four, 4)).toBeGreaterThan(computeMeasureWidth(two, 4));
  });

  it('returns minimum for empty beats', () => {
    expect(computeMeasureWidth([], 4)).toBe(80);
  });

  it('handles compound meter (6/8 with two dotted quarters)', () => {
    const beats = [beat(3), beat(3)];
    const width = computeMeasureWidth(beats, 8);
    expect(width).toBeGreaterThan(80);
  });
});
