import { describe, it, expect } from 'vitest';
import { resolveExercise, computeLandingTargets } from '../../src/utils/resolveExercise';
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

describe('computeLandingTargets', () => {
  it('returns all subsequent measures when none have explicit tempo or gradualTempo', () => {
    const measures = [
      makeMeasure({ tempo: 120 }),
      makeMeasure({ tempo: null }),
      makeMeasure({ tempo: null }),
      makeMeasure({ tempo: null }),
    ];
    const resolved = resolveExercise(measures);
    const targets = computeLandingTargets(resolved, 0);
    expect(targets).toEqual(new Set([1, 2, 3]));
  });

  it('stops after a measure with an explicit tempo', () => {
    const measures = [
      makeMeasure({ tempo: 120 }),
      makeMeasure({ tempo: null }),
      makeMeasure({ tempo: 100 }),  // explicit — valid landing but blocks further
      makeMeasure({ tempo: null }),
    ];
    const resolved = resolveExercise(measures);
    const targets = computeLandingTargets(resolved, 0);
    // Measure 1 (implied) and 2 (explicit arrival) are valid; 3 is blocked
    expect(targets).toEqual(new Set([1, 2]));
  });

  it('stops before a measure with an occupied ending zone', () => {
    const measures = [
      makeMeasure({ tempo: 120 }),
      makeMeasure({ tempo: null }),
      makeMeasure({ tempo: 100, gradualTempo: { measureLength: 1, endTempo: null } }),
      makeMeasure({ tempo: 90 }),  // has accelRitEnding from measure 2's span
    ];
    const resolved = resolveExercise(measures);
    const targets = computeLandingTargets(resolved, 0);
    // Measure 1 is valid; measure 2 has accelRitStarting so add then stop; measure 3 blocked
    expect(targets).toEqual(new Set([1, 2]));
  });

  it('includes the first explicit-tempo measure as a valid target', () => {
    const measures = [
      makeMeasure({ tempo: 120 }),
      makeMeasure({ tempo: 100 }),  // first measure already has explicit tempo
    ];
    const resolved = resolveExercise(measures);
    const targets = computeLandingTargets(resolved, 0);
    expect(targets).toEqual(new Set([1]));
  });
});

describe('gradual tempo and hold timing', () => {
  it('applies geometric interpolation across a 1-measure span', () => {
    // 4/4 at 100 BPM, accel over 1 measure to arrival at 200 BPM
    // Span covers measure 0 only (4 beats), arrival tempo from measure 1
    const measures = [
      makeMeasure({ tempo: 100, gradualTempo: { measureLength: 1, endTempo: null } }),
      makeMeasure({ tempo: 200 }),
    ];
    const result = resolveExercise(measures);
    const beats = result[0].beats;

    // N=4, geometric from 100→200
    // Beat 0 (t=0): tempo=100, dur=600ms
    expect(beats[0].durationMs).toBeCloseTo(600, 0);
    // Beat 3 (t=1): tempo=200, dur=300ms
    expect(beats[3].durationMs).toBeCloseTo(300, 0);
    // Middle beats interpolated geometrically
    // Beat 1 (t=1/3): tempo=100*2^(1/3)≈125.99, dur≈476.2
    expect(beats[1].durationMs).toBeCloseTo(476.22, 0);
    // Beat 2 (t=2/3): tempo=100*2^(2/3)≈158.74, dur≈378.0
    expect(beats[2].durationMs).toBeCloseTo(378.0, 0);

    // Arrival measure uses flat tempo 200
    expect(result[1].beats[0].durationMs).toBeCloseTo(300, 0);
  });

  it('applies geometric interpolation across a 2-measure span', () => {
    // 4/4 at 60 BPM, accel over 2 measures to arrival at 120 BPM
    // Span covers measures 0-1 (8 beats total)
    const measures = [
      makeMeasure({ tempo: 60, gradualTempo: { measureLength: 2, endTempo: null } }),
      makeMeasure({ tempo: null }),
      makeMeasure({ tempo: 120 }),
    ];
    const result = resolveExercise(measures);

    // Beat 0 (t=0): tempo=60, dur=1000
    expect(result[0].beats[0].durationMs).toBeCloseTo(1000, 0);
    // Beat 7 (t=1): tempo=120, dur=500
    expect(result[1].beats[3].durationMs).toBeCloseTo(500, 0);
    // Arrival measure uses flat 120
    expect(result[2].beats[0].durationMs).toBeCloseTo(500, 0);
  });

  it('single-measure span (measureLength=0) uses endTempo', () => {
    const measures = [
      makeMeasure({ tempo: 80, gradualTempo: { measureLength: 0, endTempo: 160 } }),
    ];
    const result = resolveExercise(measures);

    // N=4, geometric from 80→160
    // Beat 0: tempo=80, dur=750
    expect(result[0].beats[0].durationMs).toBeCloseTo(750, 0);
    // Beat 3: tempo=160, dur=375
    expect(result[0].beats[3].durationMs).toBeCloseTo(375, 0);
  });

  it('gray gradual tempo (same start/end) produces unchanged durations', () => {
    const measures = [
      makeMeasure({ tempo: 100, gradualTempo: { measureLength: 0, endTempo: 100 } }),
    ];
    const result = resolveExercise(measures);

    // All beats at 100 BPM = 600ms
    for (const beat of result[0].beats) {
      expect(beat.durationMs).toBeCloseTo(600, 0);
    }
  });

  it('hold overrides beat duration', () => {
    const measures = [
      makeMeasure({
        tempo: 120,
        beats: [
          { subdivisions: 1, hold: null },
          { subdivisions: 1, hold: 2.5 },
          { subdivisions: 1, hold: null },
          { subdivisions: 1, hold: null },
        ],
      }),
    ];
    const result = resolveExercise(measures);

    expect(result[0].beats[0].durationMs).toBe(500);
    expect(result[0].beats[1].durationMs).toBe(2500);
    expect(result[0].beats[1].hold).toBe(2.5);
    expect(result[0].beats[2].durationMs).toBe(500);
    // startMs accounts for the hold
    expect(result[0].beats[2].startMs).toBe(3000); // 500 + 2500
    expect(result[0].durationMs).toBe(4000); // 500 + 2500 + 500 + 500
  });

  it('hold within a gradual tempo span overrides geometric duration', () => {
    const measures = [
      makeMeasure({
        tempo: 100,
        gradualTempo: { measureLength: 1, endTempo: null },
        beats: [
          { subdivisions: 1, hold: null },
          { subdivisions: 1, hold: 3.0 },
          { subdivisions: 1, hold: null },
          { subdivisions: 1, hold: null },
        ],
      }),
      makeMeasure({ tempo: 200 }),
    ];
    const result = resolveExercise(measures);

    // Beat 1 should be 3000ms regardless of geometric interpolation
    expect(result[0].beats[1].durationMs).toBe(3000);
    expect(result[0].beats[1].hold).toBe(3.0);
    // Other beats still get geometric interpolation
    expect(result[0].beats[0].durationMs).toBeCloseTo(600, 0);
    expect(result[0].beats[3].durationMs).toBeCloseTo(300, 0);
  });

  it('recomputes startMs correctly after gradual tempo adjustments', () => {
    const measures = [
      makeMeasure({ tempo: 100, gradualTempo: { measureLength: 1, endTempo: null } }),
      makeMeasure({ tempo: 200 }),
    ];
    const result = resolveExercise(measures);

    // Verify startMs is sequential sum of durations
    let expected = 0;
    for (const rm of result) {
      expect(rm.startMs).toBeCloseTo(expected, 1);
      for (const rb of rm.beats) {
        expect(rb.startMs).toBeCloseTo(expected, 1);
        expected += rb.durationMs;
      }
    }
  });

  it('geoRatio is null for beats outside any gradual span', () => {
    const measures = [
      makeMeasure({ tempo: 120 }),
      makeMeasure({ tempo: 100 }),
    ];
    const result = resolveExercise(measures);
    for (const rm of result) {
      for (const rb of rm.beats) {
        expect(rb.geoRatio).toBeNull();
      }
    }
  });

  it('geoRatio is populated on all beats within a gradual span', () => {
    const measures = [
      makeMeasure({ tempo: 100, gradualTempo: { measureLength: 1, endTempo: null } }),
      makeMeasure({ tempo: 200 }),
    ];
    const result = resolveExercise(measures);
    // Span covers measure 0 (4 beats)
    for (const rb of result[0].beats) {
      expect(rb.geoRatio).not.toBeNull();
    }
    // Arrival measure not in span
    for (const rb of result[1].beats) {
      expect(rb.geoRatio).toBeNull();
    }
  });

  it('geoRatio value matches ratio^(1/(N-1)) for a known span', () => {
    // 4/4 at 100→200 BPM over 1 measure: N=4, ratio=2, perBeatRatio = 2^(1/3)
    const measures = [
      makeMeasure({ tempo: 100, gradualTempo: { measureLength: 1, endTempo: null } }),
      makeMeasure({ tempo: 200 }),
    ];
    const result = resolveExercise(measures);
    const expected = Math.pow(2, 1 / 3);
    for (const rb of result[0].beats) {
      expect(rb.geoRatio).toBeCloseTo(expected, 10);
    }
  });

  it('tempoDurationMs equals durationMs for non-held beats', () => {
    const measures = [makeMeasure({ tempo: 120 })];
    const result = resolveExercise(measures);
    for (const beat of result[0].beats) {
      expect(beat.tempoDurationMs).toBe(beat.durationMs);
    }
  });

  it('tempoDurationMs is unaffected by holds', () => {
    const measures = [
      makeMeasure({
        tempo: 120,
        beats: [
          { subdivisions: 1, hold: null },
          { subdivisions: 1, hold: 2.5 },
          { subdivisions: 1, hold: null },
          { subdivisions: 1, hold: null },
        ],
      }),
    ];
    const result = resolveExercise(measures);

    // tempoDurationMs should be 500ms for all beats (120 BPM, quarter notes)
    for (const beat of result[0].beats) {
      expect(beat.tempoDurationMs).toBe(500);
    }
    // durationMs should be overridden for held beat
    expect(result[0].beats[1].durationMs).toBe(2500);
  });

  it('tempoDurationMs reflects geometric interpolation even for held beats', () => {
    const measures = [
      makeMeasure({
        tempo: 100,
        gradualTempo: { measureLength: 1, endTempo: null },
        beats: [
          { subdivisions: 1, hold: null },
          { subdivisions: 1, hold: 3.0 },
          { subdivisions: 1, hold: null },
          { subdivisions: 1, hold: null },
        ],
      }),
      makeMeasure({ tempo: 200 }),
    ];
    const result = resolveExercise(measures);

    // Beat 1: durationMs=3000 (hold), but tempoDurationMs should be geometric
    expect(result[0].beats[1].durationMs).toBe(3000);
    // tempoDurationMs: t=1/3, tempo=100*2^(1/3)≈125.99, dur≈476.2
    expect(result[0].beats[1].tempoDurationMs).toBeCloseTo(476.22, 0);
  });

  it('effectiveTempo equals base tempo for measures outside accel/rit spans', () => {
    const measures = [
      makeMeasure({ tempo: 120 }),
      makeMeasure({ tempo: null }),
    ];
    const result = resolveExercise(measures);

    expect(result[0].effectiveTempo).toBe(120);
    expect(result[1].effectiveTempo).toBe(120);
  });

  it('effectiveTempo reflects interpolated tempo in multi-measure accel span', () => {
    // 4/4 at 60→120 over 2 measures (8 beats), arrival at m2
    const measures = [
      makeMeasure({ tempo: 60, gradualTempo: { measureLength: 2, endTempo: null } }),
      makeMeasure({ tempo: null }),
      makeMeasure({ tempo: 120 }),
    ];
    const result = resolveExercise(measures);

    // Measure 0: first beat at t=0, effectiveTempo=60
    expect(result[0].effectiveTempo).toBeCloseTo(60, 0);
    // Measure 1: first beat at t=4/7 (beat index 4 of 8, N-1=7)
    // tempo = 60 * (120/60)^(4/7) = 60 * 2^(4/7) ≈ 60 * 1.4859 ≈ 89.16
    expect(result[1].effectiveTempo).toBeCloseTo(89.16, 0);
    // Measure 2 (arrival): not in span, effectiveTempo=120
    expect(result[2].effectiveTempo).toBe(120);
  });

  it('effectiveTempo is unaffected by holds in the measure', () => {
    const measures = [
      makeMeasure({
        tempo: 100,
        gradualTempo: { measureLength: 1, endTempo: null },
        beats: [
          { subdivisions: 1, hold: 5.0 },
          { subdivisions: 1, hold: null },
          { subdivisions: 1, hold: null },
          { subdivisions: 1, hold: null },
        ],
      }),
      makeMeasure({ tempo: 200 }),
    ];
    const result = resolveExercise(measures);

    // effectiveTempo uses tempoDurationMs of first beat, not hold duration
    // First beat at t=0, effectiveTempo=100
    expect(result[0].effectiveTempo).toBeCloseTo(100, 0);
  });

  it('effectiveTempo for single-measure accel (measureLength=0)', () => {
    const measures = [
      makeMeasure({ tempo: 80, gradualTempo: { measureLength: 0, endTempo: 160 } }),
    ];
    const result = resolveExercise(measures);

    // First beat at t=0, effectiveTempo=80
    expect(result[0].effectiveTempo).toBeCloseTo(80, 0);
  });

  it('propagates hold field to ResolvedBeat', () => {
    const measures = [
      makeMeasure({
        beats: [
          { subdivisions: 1, hold: null },
          { subdivisions: 1, hold: 1.5 },
          { subdivisions: 1, hold: null },
          { subdivisions: 1, hold: 0.5 },
        ],
      }),
    ];
    const result = resolveExercise(measures);

    expect(result[0].beats[0].hold).toBeNull();
    expect(result[0].beats[1].hold).toBe(1.5);
    expect(result[0].beats[2].hold).toBeNull();
    expect(result[0].beats[3].hold).toBe(0.5);
  });
});
