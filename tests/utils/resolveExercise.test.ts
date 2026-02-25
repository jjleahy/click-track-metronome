import { describe, it, expect } from 'vitest';
import { resolveExercise } from '../../src/utils/resolveExercise';
import { computeNotePositions, computeMeasureWidth } from '../../src/utils/noteGlyphs';
import type { Measure } from '../../src/models/Exercise';

function makeMeasure(overrides: Partial<Measure> = {}): Measure {
  return {
    meter: [4, 4],
    beats: [
      { subdivisions: 1, hold: null },
      { subdivisions: 1, hold: null },
      { subdivisions: 1, hold: null },
      { subdivisions: 1, hold: null },
    ],
    tempo: 120,
    rehearsalNumber: null,
    gradualTempo: null,
    ...overrides,
  };
}

describe('resolveExercise', () => {
  it('returns empty array for empty input', () => {
    expect(resolveExercise([])).toEqual([]);
  });

  it('resolves a single measure with explicit tempo and label', () => {
    const measures = [makeMeasure({ tempo: 100, rehearsalNumber: 'A' })];
    const result = resolveExercise(measures);

    expect(result).toHaveLength(1);
    const rm = result[0];
    expect(rm.index).toBe(0);
    expect(rm.source).toBe(measures[0]);
    expect(rm.meter).toEqual([4, 4]);
    expect(rm.tempo).toBe(100);
    expect(rm.tempoImplied).toBe(false);
    expect(rm.label).toBe('A');
    expect(rm.labelImplied).toBe(false);
    expect(rm.xOffset).toBe(0);
    expect(rm.startMs).toBe(0);
    expect(rm.beats).toHaveLength(4);
  });

  it('marks inherited tempo as implied', () => {
    const measures = [
      makeMeasure({ tempo: 90 }),
      makeMeasure({ tempo: null }),
    ];
    const result = resolveExercise(measures);

    expect(result[0].tempoImplied).toBe(false);
    expect(result[0].tempo).toBe(90);
    expect(result[1].tempoImplied).toBe(true);
    expect(result[1].tempo).toBe(90);
  });

  it('marks inherited label as implied', () => {
    const measures = [
      makeMeasure({ rehearsalNumber: 5 }),
      makeMeasure({ rehearsalNumber: null }),
    ];
    const result = resolveExercise(measures);

    expect(result[0].labelImplied).toBe(false);
    expect(result[0].label).toBe(5);
    expect(result[1].labelImplied).toBe(true);
    expect(result[1].label).toBe(6);
  });

  it('computes correct beat durations for 4/4 at 120 BPM', () => {
    // At 120 BPM, each quarter note = 500ms
    const measures = [makeMeasure({ tempo: 120 })];
    const result = resolveExercise(measures);

    for (const beat of result[0].beats) {
      expect(beat.durationMs).toBe(500);
    }
    expect(result[0].durationMs).toBe(2000);
  });

  it('computes correct beat durations for 6/8 compound meter', () => {
    // 6/8 at 80 BPM (quarter-note): each eighth = (60000/80) * (4/8) = 375ms
    // A dotted-quarter beat (3 subdivisions) = 3 * 375 = 1125ms
    const measures = [makeMeasure({
      meter: [6, 8],
      beats: [
        { subdivisions: 3, hold: null },
        { subdivisions: 3, hold: null },
      ],
      tempo: 80,
    })];
    const result = resolveExercise(measures);

    expect(result[0].beats).toHaveLength(2);
    expect(result[0].beats[0].durationMs).toBe(1125);
    expect(result[0].beats[1].durationMs).toBe(1125);
    expect(result[0].durationMs).toBe(2250);
  });

  it('computes cumulative startMs across beats and measures', () => {
    const measures = [
      makeMeasure({ tempo: 120 }),
      makeMeasure({ tempo: 120 }),
    ];
    const result = resolveExercise(measures);

    // Measure 0: beats at 0, 500, 1000, 1500
    expect(result[0].startMs).toBe(0);
    expect(result[0].beats[0].startMs).toBe(0);
    expect(result[0].beats[1].startMs).toBe(500);
    expect(result[0].beats[2].startMs).toBe(1000);
    expect(result[0].beats[3].startMs).toBe(1500);

    // Measure 1 starts at 2000
    expect(result[1].startMs).toBe(2000);
    expect(result[1].beats[0].startMs).toBe(2000);
    expect(result[1].beats[1].startMs).toBe(2500);
  });

  it('computes cumulative xOffset across measures', () => {
    const measures = [
      makeMeasure({ tempo: 120 }),
      makeMeasure({ tempo: 120 }),
      makeMeasure({ tempo: 120 }),
    ];
    const result = resolveExercise(measures);

    expect(result[0].xOffset).toBe(0);
    expect(result[1].xOffset).toBe(result[0].width);
    expect(result[2].xOffset).toBe(result[0].width + result[1].width);
  });

  it('beat x-offsets match computeNotePositions', () => {
    const m = makeMeasure({ tempo: 100 });
    const result = resolveExercise([m]);
    const expected = computeNotePositions(m.beats, m.meter[1]);

    for (let i = 0; i < expected.length; i++) {
      expect(result[0].beats[i].x).toBe(expected[i].x);
      expect(result[0].beats[i].noteType).toBe(expected[i].noteType);
    }
  });

  it('measure width matches computeMeasureWidth', () => {
    const m = makeMeasure({ tempo: 100 });
    const result = resolveExercise([m]);
    const expected = computeMeasureWidth(m.beats, m.meter[1]);

    expect(result[0].width).toBe(expected);
  });
});
