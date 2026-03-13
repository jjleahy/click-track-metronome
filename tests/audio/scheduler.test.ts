import { describe, it, expect } from 'vitest';
import { MetronomeScheduler } from '../../src/audio/scheduler';
import type { ResolvedMeasure, ResolvedBeat } from '../../src/models/ResolvedMeasure';
import type { SoundConfig, SoundType } from '../../src/models/SoundConfig';

// Minimal AudioContext stub — not used directly in these tests since we spy on playSound
function makeCtx(): AudioContext {
  return { currentTime: 0 } as AudioContext;
}

const SOUND_CONFIG: SoundConfig = {
  downbeat: 'emphasis',
  bigBeat: 'standard',
  subdivision: 'tick',
  prepBeat: 'standardWood',
  highlight: 'bell',
};

function makeResolvedBeat(overrides: Partial<ResolvedBeat> & { [k: string]: unknown } = {}): ResolvedBeat {
  return {
    index: 0,
    subdivisions: 1,
    noteType: 'quarter',
    x: 0,
    tempoDurationMs: 500,
    durationMs: 500,
    startMs: 0,
    hold: null,
    geoRatio: null,
    highlightSubdivisions: 0,
    highlights: [],
    ...overrides,
  } as ResolvedBeat;
}

function makeRM(beats: ResolvedBeat[], meter: [number, number] = [4, 4]): ResolvedMeasure {
  return {
    index: 0,
    source: {
      meter,
      beats: beats.map(b => ({
        subdivisions: b.subdivisions,
        hold: b.hold,
        highlightSubdivisions: b.highlightSubdivisions,
        highlights: b.highlights,
      })),
      tempo: 120,
      rehearsalNumber: null,
      gradualTempo: null,
    },
    meter,
    tempo: 120,
    effectiveTempo: 120,
    tempoImplied: false,
    label: 1,
    labelImplied: true,
    width: 200,
    xOffset: 0,
    beats,
    startMs: 0,
    durationMs: beats.reduce((s, b) => s + b.durationMs, 0),
    accelRitEnding: null,
    accelRitStarting: null,
  } as ResolvedMeasure;
}

interface ScheduledSound { time: number; type: SoundType }

/** Build a scheduler, wire up a playSound spy, position it at the given beat, and call scheduleClick(). */
function runScheduleClick(
  rm: ResolvedMeasure,
  beatIndex: number,
  subdivisionLevel: 'off' | 'eighths' | 'sixteenths' = 'off',
): ScheduledSound[] {
  const scheduler = new MetronomeScheduler({
    resolvedMeasures: [rm],
    startMeasureIndex: 0,
    endMeasureIndex: 0,
    loop: false,
    percentage: 100,
    prepBeats: 0,
    soundConfig: SOUND_CONFIG,
    subdivisionLevel,
    audioCtx: makeCtx(),
    onBeat: () => {},
    onEnd: () => {},
  });

  const calls: ScheduledSound[] = [];
  (scheduler as any).playSound = (time: number, type: SoundType) => calls.push({ time, type });
  (scheduler as any).currentMeasureIndex = 0;
  (scheduler as any).currentBeatIndex = beatIndex;
  (scheduler as any).nextClickTime = 0;

  (scheduler as any).scheduleClick();
  return calls;
}

describe('scheduleClick — attack sound', () => {
  it('plays downbeat for beat index 0 with no highlights', () => {
    const rm = makeRM([makeResolvedBeat()]);
    const calls = runScheduleClick(rm, 0);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ time: 0, type: 'emphasis' });
  });

  it('plays bigBeat for beat index > 0 with no highlights', () => {
    const rm = makeRM([makeResolvedBeat(), makeResolvedBeat({ index: 1 })]);
    const calls = runScheduleClick(rm, 1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ time: 0, type: 'standard' });
  });

  it('plays highlight instead of downbeat when position 0 is highlighted', () => {
    const beat = makeResolvedBeat({ highlightSubdivisions: 1, highlights: [0] });
    const rm = makeRM([beat]);
    const calls = runScheduleClick(rm, 0);
    expect(calls[0].type).toBe('bell');
  });

  it('plays highlight instead of bigBeat when position 0 is highlighted on non-downbeat', () => {
    const beats = [
      makeResolvedBeat(),
      makeResolvedBeat({ index: 1, highlightSubdivisions: 1, highlights: [0] }),
    ];
    const rm = makeRM(beats);
    const calls = runScheduleClick(rm, 1);
    expect(calls[0].type).toBe('bell');
  });

  it('plays downbeat (not highlight) when highlightSubdivisions > 0 but 0 is not in highlights', () => {
    const beat = makeResolvedBeat({ highlightSubdivisions: 4, highlights: [2] });
    const rm = makeRM([beat]);
    const calls = runScheduleClick(rm, 0);
    expect(calls[0].type).toBe('emphasis');
  });
});

describe('scheduleClick — highlight sub-beats', () => {
  it('schedules highlight at correct offset for a single highlighted sub-beat', () => {
    // highlightSubdivisions=4, highlights=[2] → offset = 2/4 * 0.5s = 0.25s
    const beat = makeResolvedBeat({ highlightSubdivisions: 4, highlights: [2] });
    const rm = makeRM([beat]);
    const calls = runScheduleClick(rm, 0);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({ time: 0, type: 'emphasis' });
    expect(calls[1]).toEqual({ time: 0.25, type: 'bell' });
  });

  it('schedules multiple highlighted sub-beats at correct offsets', () => {
    // highlightSubdivisions=4, highlights=[1,3] → 0.125s and 0.375s
    const beat = makeResolvedBeat({ highlightSubdivisions: 4, highlights: [1, 3] });
    const rm = makeRM([beat]);
    const calls = runScheduleClick(rm, 0);
    expect(calls).toHaveLength(3);
    expect(calls[1].time).toBeCloseTo(0.125, 6);
    expect(calls[1].type).toBe('bell');
    expect(calls[2].time).toBeCloseTo(0.375, 6);
    expect(calls[2].type).toBe('bell');
  });

  it('does not schedule highlight sub-beats for held beats', () => {
    const beat = makeResolvedBeat({ hold: 2.0, durationMs: 2000, highlightSubdivisions: 4, highlights: [0, 2] });
    const rm = makeRM([beat]);
    const calls = runScheduleClick(rm, 0);
    // Attack highlight (index 0) still fires; sub-beat at index 2 is skipped
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe('bell');
  });

  it('does not schedule highlight sub-beats when highlights is empty', () => {
    const beat = makeResolvedBeat({ highlightSubdivisions: 4, highlights: [] });
    const rm = makeRM([beat]);
    const calls = runScheduleClick(rm, 0);
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe('emphasis');
  });
});

describe('scheduleClick — subdivision + highlight overlap', () => {
  it('subdivision fires when no highlights are present', () => {
    // 4/4 quarter beat: subdivisionLevel=eighths → subCount=2, sub fires at 0.25s
    const beat = makeResolvedBeat({ subdivisions: 1 });
    const rm = makeRM([beat, makeResolvedBeat({ index: 1 }), makeResolvedBeat({ index: 2 }), makeResolvedBeat({ index: 3 })]);
    const calls = runScheduleClick(rm, 0, 'eighths');
    const subCall = calls.find(c => c.type === 'tick');
    expect(subCall).toBeDefined();
    expect(subCall!.time).toBeCloseTo(0.25, 6);
  });

  it('highlight replaces subdivision when they coincide (even grid)', () => {
    // highlightSubdivisions=4, highlights=[2] → highlight at 0.25s
    // subdivisionLevel=eighths, subCount=2 → subdivision would also fire at 0.25s
    // Subdivision should be suppressed; only highlight fires at 0.25s
    const beat = makeResolvedBeat({ subdivisions: 1, highlightSubdivisions: 4, highlights: [2] });
    const rm = makeRM([beat, makeResolvedBeat({ index: 1 }), makeResolvedBeat({ index: 2 }), makeResolvedBeat({ index: 3 })]);
    const calls = runScheduleClick(rm, 0, 'eighths');

    const atQuarterBeat = calls.filter(c => Math.abs(c.time - 0.25) < 1e-9);
    expect(atQuarterBeat).toHaveLength(1);
    expect(atQuarterBeat[0].type).toBe('bell');
  });

  it('subdivision fires at non-overlapping positions when highlights are present', () => {
    // highlightSubdivisions=4, highlights=[1] → highlight at 0.125s
    // subdivisionLevel=eighths, subCount=2 → subdivision at 0.25s (different position)
    // Both should fire
    const beat = makeResolvedBeat({ subdivisions: 1, highlightSubdivisions: 4, highlights: [1] });
    const rm = makeRM([beat, makeResolvedBeat({ index: 1 }), makeResolvedBeat({ index: 2 }), makeResolvedBeat({ index: 3 })]);
    const calls = runScheduleClick(rm, 0, 'eighths');

    const highlightCall = calls.find(c => c.type === 'bell');
    const subCall = calls.find(c => c.type === 'tick');
    expect(highlightCall).toBeDefined();
    expect(subCall).toBeDefined();
    expect(highlightCall!.time).toBeCloseTo(0.125, 6);
    expect(subCall!.time).toBeCloseTo(0.25, 6);
  });
});
