import { describe, it, expect } from 'vitest';
import { firstBeatDuration, toDisplayTempo, toInternalTempo, beatLabel } from './tempoConversion';

describe('firstBeatDuration', () => {
  it('quarter in 4/4: 1/4', () => {
    expect(firstBeatDuration(4, 1)).toBeCloseTo(0.25);
  });
  it('dotted quarter in 6/8: 3/8', () => {
    expect(firstBeatDuration(8, 3)).toBeCloseTo(0.375);
  });
  it('eighth in 3/8: 1/8', () => {
    expect(firstBeatDuration(8, 1)).toBeCloseTo(0.125);
  });
  it('dotted eighth in 6/16: 3/16', () => {
    expect(firstBeatDuration(16, 3)).toBeCloseTo(0.1875);
  });
});

describe('toDisplayTempo / toInternalTempo round-trip', () => {
  it('quarter note 4/4: internal 80 → display 80 → internal 80', () => {
    const display = toDisplayTempo(80, 4, 1);
    expect(display).toBe(80);
    expect(toInternalTempo(display, 4, 1)).toBe(80);
  });

  it('dotted quarter 6/8: internal 120 → display 80 → internal 120', () => {
    // internal 120 qpm, dotted quarter = 3/8 of a whole
    // displayTempo = 120 * 0.25 / 0.375 = 80
    const display = toDisplayTempo(120, 8, 3);
    expect(display).toBe(80);
    expect(toInternalTempo(display, 8, 3)).toBe(120);
  });

  it('eighth in 3/8: internal 60 → display 120 → internal 60', () => {
    // displayTempo = 60 * 0.25 / 0.125 = 120
    const display = toDisplayTempo(60, 8, 1);
    expect(display).toBe(120);
    expect(toInternalTempo(display, 8, 1)).toBe(60);
  });

  it('dotted eighth in 6/16: internal 120 → display 80 → internal 120', () => {
    // displayTempo = 120 * 0.25 / 0.1875 ≈ 160
    const display = toDisplayTempo(120, 16, 3);
    expect(display).toBe(160);
    expect(toInternalTempo(display, 16, 3)).toBe(120);
  });

  it('round-trip preserves value for 4/4 quarter', () => {
    // Quarter note: beatDur = 1/4, so internal = display, always exact
    for (const internal of [40, 60, 80, 100, 120, 160, 200]) {
      expect(toInternalTempo(toDisplayTempo(internal, 4, 1), 4, 1)).toBe(internal);
    }
  });

  it('round-trip preserves value for 6/8 dotted quarter at clean values', () => {
    // beatDur = 3/8; displayTempo = internal * 2/3. Only exact when internal is divisible by 3.
    for (const internal of [60, 90, 120, 150, 180]) {
      expect(toInternalTempo(toDisplayTempo(internal, 8, 3), 8, 3)).toBe(internal);
    }
  });
});

describe('beatLabel', () => {
  it('quarter in 4/4', () => {
    expect(beatLabel(4, 1)).toBe('q = ');
  });
  it('dotted quarter in 6/8', () => {
    expect(beatLabel(8, 3)).toBe('q• = ');
  });
  it('eighth in 3/8', () => {
    expect(beatLabel(8, 1)).toBe('e = ');
  });
  it('dotted eighth in 6/16', () => {
    expect(beatLabel(16, 3)).toBe('e• = ');
  });
  it('half in 2/2', () => {
    expect(beatLabel(2, 1)).toBe('h = ');
  });
  it('unusual beat falls back to fraction label', () => {
    // 5/8 doesn't match any standard note duration
    expect(beatLabel(8, 5)).toBe('5/8 = ');
  });
});
