import { NOTE_HALF_UP, NOTE_QUARTER_UP, NOTE_8TH_UP } from './noteGlyphs';

// Returns the duration of the first big beat as a fraction of a whole note.
// e.g. denominator=8, firstSubdivision=3 → 3/8
export function firstBeatDuration(denominator: number, firstSubdivision: number): number {
  return firstSubdivision / denominator;
}

// Converts internal quarter-note tempo to display tempo for the first beat.
// displayTempo = internalTempo * (1/4) / firstBeatDur
export function toDisplayTempo(internalTempo: number, denominator: number, firstSubdivision: number): number {
  const beatDur = firstBeatDuration(denominator, firstSubdivision);
  return Math.round(internalTempo * 0.25 / beatDur);
}

// Converts display tempo back to internal quarter-note tempo (round half up).
export function toInternalTempo(displayTempo: number, denominator: number, firstSubdivision: number): number {
  const beatDur = firstBeatDuration(denominator, firstSubdivision);
  const raw = displayTempo * beatDur / 0.25;
  return Math.floor(raw + 0.5);
}

// Reverses the duration formula to get internal quarter-note tempo from a beat's tempoDurationMs.
// internalTempo = subdivisions * 60000 / tempoDurationMs * (4 / denominator)
export function tempoFromBeatDuration(tempoDurationMs: number, subdivisions: number, denominator: number): number {
  return subdivisions * (60000 / tempoDurationMs) * (4 / denominator);
}

/** Returns the Bravura glyph char and whether it needs an augmentation dot,
 *  or null for unusual beat durations (caller should show a fraction instead). */
export function beatLabelGlyph(
  denominator: number,
  firstSubdivision: number,
): { noteGlyph: string; dotted: boolean } | null {
  const beatDur = firstBeatDuration(denominator, firstSubdivision);
  const map: [number, string, boolean][] = [
    [1 / 2,  NOTE_HALF_UP,    false],
    [3 / 8,  NOTE_QUARTER_UP, true],
    [1 / 4,  NOTE_QUARTER_UP, false],
    [3 / 16, NOTE_8TH_UP,     true],
    [1 / 8,  NOTE_8TH_UP,     false],
  ];
  for (const [dur, noteGlyph, dotted] of map) {
    if (Math.abs(beatDur - dur) < 1e-9) return { noteGlyph, dotted };
  }
  return null;
}
