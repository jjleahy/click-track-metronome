// @vitest-environment node
// (Node environment: needs the CompressionStream/DecompressionStream globals used by sharing.ts.)
//
// Contract tests for skills/click-track-exercises/scripts/exercise.mjs. The script re-implements
// a few app rules so it can run standalone inside a skill; these tests fail if it drifts from
// the app's own code.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as skill from '../../skills/click-track-exercises/scripts/exercise.mjs';
import { compressExercise, decompressExercise } from '../../src/utils/sharing';
import { defaultBeats } from '../../src/utils/subdivisionDefaults';
import { toDisplayTempo, toInternalTempo } from '../../src/utils/tempoConversion';
import { resolveExercise, computeLandingTargets } from '../../src/utils/resolveExercise';
import { resolveMeasureLabels } from '../../src/utils/measureLabels';
import { isMeasureValid } from '../../src/utils/subdivisionValidation';
import { noteForBeat } from '../../src/utils/noteGlyphs';
import type { Exercise, Measure } from '../../src/models/Exercise';

const EXAMPLES_DIR = resolve(__dirname, '../../skills/click-track-exercises/examples');
const EXAMPLE_FILES = ['meter-changes.json', 'accel-rit-fermata.json'];

function buildExample(file: string): Exercise {
  const input = JSON.parse(readFileSync(resolve(EXAMPLES_DIR, file), 'utf8'));
  const { exercise, issues } = skill.buildExercise(input);
  expect(issues.filter((i) => i.level === 'error')).toEqual([]);
  return exercise!;
}

function errors(exercise: unknown) {
  return skill.validateExercise(exercise).filter((i) => i.level === 'error');
}

describe('share code compatibility', () => {
  it.each(EXAMPLE_FILES)('script encoding is readable by the app (%s)', async (file) => {
    const exercise = buildExample(file);
    expect(await decompressExercise(skill.encodeExercise(exercise))).toEqual(exercise);
  });

  it.each(EXAMPLE_FILES)('app encoding is readable by the script (%s)', async (file) => {
    const exercise = buildExample(file);
    expect(skill.decodeShare(await compressExercise(exercise))).toEqual(exercise);
  });

  it('decodeShare accepts a full URL, a ?share= fragment and a bare code', () => {
    const exercise = buildExample('meter-changes.json');
    const url = skill.shareUrl(exercise);
    const code = skill.encodeExercise(exercise);
    expect(skill.decodeShare(url)).toEqual(exercise);
    expect(skill.decodeShare(`?share=${code}`)).toEqual(exercise);
    expect(skill.decodeShare(code)).toEqual(exercise);
    expect(url.startsWith(skill.DEFAULT_BASE_URL + '?share=')).toBe(true);
  });
});

describe('default beat groupings', () => {
  it('match src/utils/subdivisionDefaults.ts for every meter the editor allows', () => {
    for (let n = 1; n <= skill.NUMERATOR_MAX; n++) {
      for (const d of [1, 2, 4, 8, 16]) {
        expect(skill.defaultGrouping(n, d), `${n}/${d}`).toEqual(defaultBeats(n, d).map((b) => b.subdivisions));
      }
    }
  });
});

describe('tempo conversion', () => {
  // note name -> a (denominator, subdivisions) pair whose big beat is that note
  const NOTES: [string, number, number][] = [
    ['whole', 1, 1], ['dotted-half', 4, 3], ['half', 2, 1], ['dotted-quarter', 8, 3],
    ['quarter', 4, 1], ['dotted-eighth', 16, 3], ['eighth', 8, 1], ['sixteenth', 16, 1],
  ];

  it('parseTempo matches the app’s toInternalTempo for every note value', () => {
    for (const [name, den, sub] of NOTES) {
      for (const bpm of [20, 40, 55, 60, 67, 90, 120, 133, 176, 200]) {
        expect(skill.parseTempo(`${name}=${bpm}`).internal, `${name}=${bpm}`).toBe(toInternalTempo(bpm, den, sub));
      }
    }
  });

  it('toDisplayTempo matches the app', () => {
    for (const [, den, sub] of NOTES) {
      for (const internal of [20, 45, 60, 88, 90, 120, 300]) {
        expect(skill.toDisplayTempo(internal, den, sub)).toBe(toDisplayTempo(internal, den, sub));
      }
    }
  });

  it('accepts abbreviations and dotted spellings', () => {
    expect(skill.parseTempo('q=120').internal).toBe(120);
    expect(skill.parseTempo('q.=60').internal).toBe(90);
    expect(skill.parseTempo('dotted quarter = 60').internal).toBe(90);
    expect(skill.parseTempo('e=176').internal).toBe(88);
  });

  it('rejects bare numbers and unknown notes', () => {
    expect(() => skill.parseTempo(120)).toThrow(/explicit/);
    expect(() => skill.parseTempo('banana=120')).toThrow(/unknown note/);
  });

  it('beatName agrees with noteForBeat (null <=> fallback)', () => {
    for (const den of [1, 2, 4, 8, 16]) {
      for (let sub = 1; sub <= 16; sub++) {
        const appType = noteForBeat(den, sub);
        expect(skill.beatName(den, sub) === null, `${sub}/${den}`).toBe(appType === 'fallback');
      }
    }
  });
});

describe('labels', () => {
  it('resolveLabels matches the app’s resolveMeasureLabels', () => {
    const cases: (string | number | null)[][] = [
      [null, null, null],
      [5, null, null],
      ['A', null, 'B', null],
      [null, 80, null, '80a', null, 81],
      ['I', 'II', null, 10, null],
    ];
    for (const labels of cases) {
      const measures = labels.map((rehearsalNumber) => ({
        meter: [4, 4], beats: defaultBeats(4, 4), tempo: null, rehearsalNumber, gradualTempo: null,
      })) as Measure[];
      expect(skill.resolveLabels(measures)).toEqual(resolveMeasureLabels(measures));
    }
  });
});

describe('timing estimate', () => {
  it.each(EXAMPLE_FILES)('matches resolveExercise total duration (%s)', (file) => {
    const exercise = buildExample(file);
    const resolved = resolveExercise(exercise.measures);
    const last = resolved[resolved.length - 1];
    expect(skill.estimateDurationMs(exercise)).toBeCloseTo(last.startMs + last.durationMs, 6);
  });
});

describe('validation agrees with the app', () => {
  it('flags exactly the measures the app marks invalid (beat sum)', () => {
    const exercise = buildExample('meter-changes.json');
    expect(errors(exercise)).toEqual([]);
    exercise.measures[1].beats = exercise.measures[1].beats.slice(0, 1);
    expect(isMeasureValid(exercise.measures[1].beats, exercise.measures[1].meter[0])).toBe(false);
    expect(errors(exercise).some((e) => e.where.startsWith('measure 2') && /sum/.test(e.message))).toBe(true);
  });

  it('rejects undefined where the app needs an explicit null', () => {
    const exercise = JSON.parse(JSON.stringify(buildExample('meter-changes.json')));
    delete exercise.measures[0].gradualTempo;
    delete exercise.measures[0].beats[0].hold;
    const messages = errors(exercise).map((e) => e.message).join('\n');
    expect(messages).toMatch(/missing "gradualTempo"/);
    expect(messages).toMatch(/missing "hold"/);
  });

  it('accel/rit structure: accepts exactly the arrivals the editor offers as landing targets', () => {
    // Exhaustive over small exercises: which of every explicit-tempo pattern, first span and
    // optional second span does the editor allow (computeLandingTargets), vs. the script?
    const n = 6;
    const spanErrors = (measures: Measure[]) =>
      skill.validateExercise({ id: '00000000-0000-4000-8000-000000000000', name: 't', measures })
        .filter((i) => i.level === 'error' && /passes through/.test(i.message));

    const make = (mask: number, spans: [number, number][]): Measure[] =>
      Array.from({ length: n }, (_, i) => ({
        meter: [4, 4] as [number, number],
        beats: defaultBeats(4, 4),
        tempo: i === 0 ? 100 : (mask >> i) & 1 ? 100 + 10 * i : null,
        rehearsalNumber: null,
        gradualTempo: null,
      })).map((m, i) => {
        const span = spans.find(([start]) => start === i);
        return span ? { ...m, gradualTempo: { measureLength: span[1], endTempo: null } } : m;
      });

    let checked = 0;
    for (let mask = 0; mask < 1 << n; mask++) {
      for (let a = 0; a < n - 1; a++) {
        for (let la = 1; a + la < n; la++) {
          // the editor allows the first span iff its arrival is a landing target with nothing else present
          const alone = make(mask, []);
          const firstAllowed = computeLandingTargets(resolveExercise(alone), a).has(a + la);
          const firstApplied: [number, number][] = [[a, la]];
          expect(spanErrors(make(mask, firstApplied)).length === 0, `mask=${mask} span=${a}+${la}`).toBe(firstAllowed);
          checked++;

          if (!firstAllowed) continue;
          for (let b = 0; b < n - 1; b++) {
            if (b === a) continue;
            for (let lb = 1; b + lb < n; lb++) {
              const withFirst = make(mask, firstApplied);
              const secondAllowed = computeLandingTargets(resolveExercise(withFirst), b).has(b + lb);
              const both = make(mask, [[a, la], [b, lb]]);
              expect(
                spanErrors(both).length === 0,
                `mask=${mask} spans=${a}+${la},${b}+${lb}`,
              ).toBe(secondAllowed);
              checked++;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});

describe('build (authoring format)', () => {
  const build = (measures: unknown[]) => skill.buildExercise({ name: 'T', measures });

  it('fills default beats, inherits meter, and reuses grouping only when the meter is unchanged', () => {
    const { exercise } = build([
      { meter: '7/8', beats: [3, 2, 2], tempo: 'eighth=200' },
      {},
      { meter: '4/4' },
      { meter: '7/8' },
    ]);
    expect(exercise!.measures.map((m) => m.beats.map((b) => b.subdivisions))).toEqual([
      [3, 2, 2], [3, 2, 2], [1, 1, 1, 1], [2, 2, 3],
    ]);
  });

  it('applies tempo/label/gradual to the first copy of a repeat only', () => {
    const { exercise } = build([
      { meter: '4/4', tempo: 'quarter=100', label: '12', repeat: 3, gradual: { measures: 3 } },
      { tempo: 'quarter=140' },
    ]);
    const m = exercise!.measures;
    expect(m).toHaveLength(4);
    expect(m.map((x) => x.tempo)).toEqual([100, null, null, 140]);
    expect(m.map((x) => x.rehearsalNumber)).toEqual([12, null, null, null]); // "12" normalized to a number
    expect(m.map((x) => x.gradualTempo)).toEqual([{ measureLength: 3, endTempo: null }, null, null, null]);
  });

  it('holds use 1-based beat numbers', () => {
    const { exercise } = build([{ meter: '4/4', tempo: 'quarter=60', holds: { '4': 3 } }]);
    expect(exercise!.measures[0].beats.map((b) => b.hold)).toEqual([null, null, null, 3]);
  });

  it('converts tempo strings to stored quarter-note BPM', () => {
    const { exercise } = build([
      { meter: '6/8', tempo: 'dotted-quarter=60', gradual: { measures: 0, to: 'dotted-quarter=40' } },
    ]);
    expect(exercise!.measures[0].tempo).toBe(90);
    expect(exercise!.measures[0].gradualTempo).toEqual({ measureLength: 0, endTempo: 60 });
  });

  it('reports typos, bare-number tempos, and multi-measure "to" as errors', () => {
    const { exercise, issues } = build([
      { meter: '4/4', tempoo: 'quarter=90' },
      { meter: '4/4', tempo: 120 },
      { meter: '4/4', gradual: { measures: 2, to: 'quarter=60' } },
    ]);
    expect(exercise).toBeNull();
    expect(issues.filter((i) => i.level === 'error')).toHaveLength(3);
  });

  it('warns about duplicate labels', () => {
    const { issues } = build([{ meter: '4/4', tempo: 'quarter=90', label: 1 }, { label: 1 }]);
    expect(issues.some((i) => i.level === 'warning' && /duplicate measure labels/.test(i.message))).toBe(true);
  });
});

describe('CLI', () => {
  it('build prints a share URL and exits 0 for a good example', () => {
    const lines: string[] = [];
    const code = skill.main(['build', resolve(EXAMPLES_DIR, 'meter-changes.json')], (l) => lines.push(l));
    expect(code).toBe(0);
    expect(lines.join('\n')).toContain('?share=');
  });

  it('validate and decode accept a share URL or bare code directly, not just a file', () => {
    const exercise = buildExample('meter-changes.json');
    for (const arg of [skill.shareUrl(exercise), skill.encodeExercise(exercise)]) {
      const validated: string[] = [];
      expect(skill.main(['validate', arg], (l) => validated.push(l))).toBe(0);
      expect(validated.join('\n')).toContain('OK:');

      const decoded: string[] = [];
      expect(skill.main(['decode', arg], (l) => decoded.push(l))).toBe(0);
      expect(JSON.parse(decoded.join('\n'))).toEqual(exercise);
    }
  });

  it('build exits 1 without a URL when there are errors', () => {
    const lines: string[] = [];
    const bad = resolve(__dirname, 'bad-input.json');
    const code = skill.main(['build', bad], (l) => lines.push(l));
    expect(code).toBe(1);
    expect(lines.join('\n')).not.toContain('?share=');
  });
});
