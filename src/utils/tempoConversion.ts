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

// Builds a text label like "q = ", "e• = ", "h = " for the first beat.
// TODO: Stage 7 — replace text labels with note glyphs
export function beatLabel(denominator: number, firstSubdivision: number): string {
  const beatDur = firstBeatDuration(denominator, firstSubdivision);
  const map: [number, string][] = [
    [1 / 2, 'h'],
    [3 / 8, 'q•'],
    [1 / 4, 'q'],
    [3 / 16, 'e•'],
    [1 / 8, 'e'],
  ];
  for (const [dur, label] of map) {
    if (Math.abs(beatDur - dur) < 1e-9) return label + ' = ';
  }
  return `${firstSubdivision}/${denominator} = `;
}
