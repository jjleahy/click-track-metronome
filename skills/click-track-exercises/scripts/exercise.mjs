#!/usr/bin/env node
/**
 * Click Track Metronome — exercise authoring helper.
 *
 * Zero dependencies (Node 18+). Commands:
 *
 *   build    <authoring.json> [--out canonical.json] [--base URL]
 *   validate <canonical.json | share-url | share-code>
 *   encode   <canonical.json> [--base URL]
 *   decode   <share-url | share-code> [--out file.json]
 *
 * Use "-" as a file argument to read from stdin.
 *
 * Two JSON formats are involved (see references/):
 *   - authoring format: friendly input to `build` (tempo strings, repeat, default beats…)
 *   - canonical format: what the app stores and what share links contain
 *
 * This file intentionally re-implements a few app rules (default beat groupings, tempo
 * conversion, accel/rit constraints). tests/skill/exercise-skill.test.ts checks it against
 * the app's own code so the two can't drift silently.
 */
import { gzipSync, gunzipSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const DEFAULT_BASE_URL = 'https://jjleahy.github.io/click-track-metronome/';

// --- Limits (mirroring the app's editor inputs) -----------------------------------------
export const TEMPO_MIN = 20;            // internal quarter-note BPM
export const TEMPO_MAX = 300;
export const DEFAULT_TEMPO = 80;        // used when the first measure has no explicit tempo
export const HOLD_MAX_SECONDS = 9.9;
export const NUMERATOR_MAX = 19;
export const DENOMINATOR_MAX = 16;
export const HIGHLIGHT_SUBDIVISIONS_MAX = 8;
const MAX_REPEAT = 500;
const LONG_URL_CHARS = 2000;

// --- Default beat groupings (mirror of src/utils/subdivisionDefaults.ts) ---------------
const DEFAULT_GROUPINGS = {
  '4/4': [1, 1, 1, 1],
  '3/4': [1, 1, 1],
  '2/4': [1, 1],
  '6/8': [3, 3],
  '9/8': [3, 3, 3],
  '12/8': [3, 3, 3, 3],
  '10/8': [3, 3, 2, 2],
  '5/8': [3, 2],
  '7/8': [2, 2, 3],
  '8/8': [3, 3, 2],
  '2/2': [1, 1],
  '3/2': [1, 1, 1],
};

export function defaultGrouping(numerator, denominator) {
  const known = DEFAULT_GROUPINGS[`${numerator}/${denominator}`];
  if (known) return [...known];
  const groups = [];
  let remaining = numerator;
  while (remaining >= 3) {
    groups.push(3);
    remaining -= 3;
  }
  if (remaining > 0) groups.push(remaining);
  return groups.length > 0 ? groups : [numerator];
}

// --- Note values and tempo conversion --------------------------------------------------
const NOTE_FRACTIONS = { whole: 1, half: 1 / 2, quarter: 1 / 4, eighth: 1 / 8, sixteenth: 1 / 16 };
const NOTE_ABBREVIATIONS = { w: 'whole', h: 'half', q: 'quarter', e: 'eighth', s: 'sixteenth' };

/** Beat duration (fraction of a whole note) -> readable name, or null if not a standard note. */
const BEAT_NAMES = [
  [1, 'whole'], [3 / 4, 'dotted-half'], [1 / 2, 'half'], [3 / 8, 'dotted-quarter'],
  [1 / 4, 'quarter'], [3 / 16, 'dotted-eighth'], [1 / 8, 'eighth'],
  [3 / 32, 'dotted-sixteenth'], [1 / 16, 'sixteenth'],
];

export function beatName(denominator, subdivisions) {
  const duration = subdivisions / denominator;
  for (const [d, name] of BEAT_NAMES) if (Math.abs(duration - d) < 1e-9) return name;
  return null;
}

/**
 * Parses a tempo string like "quarter=120", "dotted-quarter=60", "q.=60", "e=176"
 * into the app's stored unit: quarter-note BPM, rounded to an integer like the app does.
 * Returns { internal, exact } or throws Error with a helpful message.
 */
export function parseTempo(spec) {
  if (typeof spec !== 'string') {
    throw new Error(
      `tempo must be a string like "quarter=120" or "dotted-quarter=60" (got ${JSON.stringify(spec)}). ` +
      'Bare numbers are rejected because the note value that gets the beat must be explicit.',
    );
  }
  const m = /^\s*(dotted[-\s]?)?([a-z]+)(\.)?\s*=\s*(\d+(?:\.\d+)?)\s*$/i.exec(spec);
  if (!m) throw new Error(`cannot parse tempo ${JSON.stringify(spec)}; expected e.g. "quarter=120" or "dotted-quarter=60"`);
  const dottedPrefix = Boolean(m[1]);
  const dottedSuffix = Boolean(m[3]);
  const word = m[2].toLowerCase();
  const noteName = NOTE_ABBREVIATIONS[word] ?? word;
  if (!(noteName in NOTE_FRACTIONS)) {
    throw new Error(`unknown note value "${m[2]}" in tempo ${JSON.stringify(spec)}; use whole, half, quarter, eighth or sixteenth (optionally dotted)`);
  }
  if (dottedPrefix && dottedSuffix) throw new Error(`tempo ${JSON.stringify(spec)} is dotted twice`);
  const bpm = Number(m[4]);
  const fraction = NOTE_FRACTIONS[noteName] * (dottedPrefix || dottedSuffix ? 1.5 : 1);
  const exact = (bpm * fraction) / 0.25;
  return { internal: Math.floor(exact + 0.5), exact };
}

/** Stored quarter-note BPM -> tempo in terms of a given big beat (rounded, like the app). */
export function toDisplayTempo(internal, denominator, firstSubdivision) {
  return Math.round((internal * 0.25) / (firstSubdivision / denominator));
}

// --- Issues ---------------------------------------------------------------------------
class Issues {
  constructor() {
    this.list = [];
  }
  error(where, message) {
    this.list.push({ level: 'error', where, message });
  }
  warn(where, message) {
    this.list.push({ level: 'warning', where, message });
  }
}

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v) => Number.isInteger(v);

function unknownKeys(obj, allowed) {
  return Object.keys(obj).filter((k) => !allowed.includes(k));
}

// --- Labels (mirror of src/utils/measureLabels.ts) -------------------------------------
export function resolveLabels(measures) {
  const labels = [];
  let lastNumeric = 0;
  for (const m of measures) {
    const rn = m?.rehearsalNumber;
    if (rn !== null && rn !== undefined) {
      labels.push(rn);
      if (typeof rn === 'number') lastNumeric = rn;
    } else {
      lastNumeric += 1;
      labels.push(lastNumeric);
    }
  }
  return labels;
}

// ==========================================================================================
// Canonical exercise validation
// ==========================================================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEASURE_KEYS = ['meter', 'beats', 'tempo', 'rehearsalNumber', 'gradualTempo'];
const BEAT_KEYS = ['subdivisions', 'hold', 'highlightSubdivisions', 'highlights'];

/** Returns [{level: 'error'|'warning', where, message}]. No errors => safe to import. */
export function validateExercise(ex) {
  const issues = new Issues();
  if (!isObject(ex)) {
    issues.error('exercise', 'must be a JSON object');
    return issues.list;
  }
  if (typeof ex.id !== 'string' || ex.id.trim() === '') issues.error('exercise.id', 'must be a non-empty string (a UUID)');
  else if (!UUID_RE.test(ex.id)) issues.warn('exercise.id', 'is not a UUID; the app will accept it but expects crypto.randomUUID() style ids');
  if (typeof ex.name !== 'string' || ex.name.trim() === '') issues.error('exercise.name', 'must be a non-empty string');
  for (const k of unknownKeys(ex, ['id', 'name', 'measures'])) issues.warn('exercise', `unknown field "${k}" will be ignored by the app`);
  if (!Array.isArray(ex.measures) || ex.measures.length === 0) {
    issues.error('exercise.measures', 'must be a non-empty array');
    return issues.list;
  }

  const measures = ex.measures;
  const labels = resolveLabels(measures.map((m) => (isObject(m) ? m : {})));
  const where = (i) => `measure ${i + 1}${String(labels[i]) !== String(i + 1) ? ` (label ${labels[i]})` : ''}`;
  const measureOk = measures.map(() => true); // structurally usable for span checks

  measures.forEach((m, i) => {
    const w = where(i);
    if (!isObject(m)) {
      issues.error(w, 'must be an object');
      measureOk[i] = false;
      return;
    }
    for (const k of unknownKeys(m, MEASURE_KEYS)) issues.warn(w, `unknown field "${k}" will be ignored by the app`);
    for (const k of MEASURE_KEYS) {
      if (!(k in m)) {
        issues.error(w, `missing "${k}" (use null when there is no value; the app breaks on undefined)`);
        measureOk[i] = false;
      }
    }

    // meter
    let numerator = null;
    let denominator = null;
    if (!Array.isArray(m.meter) || m.meter.length !== 2 || !m.meter.every(isInt)) {
      issues.error(w, `meter must be [numerator, denominator] integers (got ${JSON.stringify(m.meter)})`);
      measureOk[i] = false;
    } else {
      [numerator, denominator] = m.meter;
      if (numerator < 1 || numerator > NUMERATOR_MAX) issues.error(w, `meter numerator ${numerator} outside 1–${NUMERATOR_MAX}`);
      if (denominator < 1 || denominator > DENOMINATOR_MAX) issues.error(w, `meter denominator ${denominator} outside 1–${DENOMINATOR_MAX}`);
      else if ((denominator & (denominator - 1)) !== 0) issues.warn(w, `unusual meter denominator ${denominator} (expected 1, 2, 4, 8 or 16)`);
    }

    // beats
    if (!Array.isArray(m.beats) || m.beats.length === 0) {
      issues.error(w, 'beats must be a non-empty array');
    } else {
      let sum = 0;
      let sumOk = true;
      m.beats.forEach((b, bi) => {
        const bw = `${w}, beat ${bi + 1}`;
        if (!isObject(b)) {
          issues.error(bw, 'must be an object');
          sumOk = false;
          return;
        }
        for (const k of unknownKeys(b, BEAT_KEYS)) issues.warn(bw, `unknown field "${k}" will be ignored by the app`);
        if (!isInt(b.subdivisions) || b.subdivisions < 1) {
          issues.error(bw, `subdivisions must be a positive integer (got ${JSON.stringify(b.subdivisions)}; 0 is an editor placeholder, never export it)`);
          sumOk = false;
        } else {
          sum += b.subdivisions;
          if (denominator && beatName(denominator, b.subdivisions) === null) {
            issues.warn(bw, `${b.subdivisions}/${denominator} is not a standard note value; it will be drawn as a plain quarter-note glyph`);
          }
        }
        if (!('hold' in b)) issues.error(bw, 'missing "hold" (use null for a normal beat; the app breaks on undefined)');
        else if (b.hold !== null && !(typeof b.hold === 'number' && b.hold > 0 && b.hold <= HOLD_MAX_SECONDS)) {
          issues.error(bw, `hold must be null or seconds in (0, ${HOLD_MAX_SECONDS}] (got ${JSON.stringify(b.hold)})`);
        }
        const hs = b.highlightSubdivisions;
        if (hs !== undefined && !(isInt(hs) && hs >= 0 && hs <= HIGHLIGHT_SUBDIVISIONS_MAX)) {
          issues.error(bw, `highlightSubdivisions must be an integer 0–${HIGHLIGHT_SUBDIVISIONS_MAX} (got ${JSON.stringify(hs)})`);
        } else if (b.highlights !== undefined) {
          const hl = b.highlights;
          if (!Array.isArray(hl) || !hl.every(isInt)) issues.error(bw, 'highlights must be an array of integers');
          else if (new Set(hl).size !== hl.length) issues.error(bw, 'highlights contains duplicates');
          else if (hl.some((x) => x < 0 || x >= (hs ?? 0))) issues.error(bw, `highlights entries must be in 0..${(hs ?? 0) - 1} (highlightSubdivisions = ${hs ?? 0})`);
        }
      });
      if (sumOk && numerator !== null && sum !== numerator) {
        issues.error(w, `beats sum to ${sum} but meter ${numerator}/${denominator} needs ${numerator} (the app marks this measure invalid and blocks playback)`);
      }
    }

    // tempo
    if (m.tempo !== null && m.tempo !== undefined) {
      if (typeof m.tempo !== 'number' || !Number.isFinite(m.tempo) || m.tempo < TEMPO_MIN || m.tempo > TEMPO_MAX) {
        issues.error(w, `tempo must be null or quarter-note BPM in ${TEMPO_MIN}–${TEMPO_MAX} (got ${JSON.stringify(m.tempo)}); remember it is stored as quarter-note BPM, not the big-beat tempo shown in the app`);
        measureOk[i] = false;
      } else if (!isInt(m.tempo)) {
        issues.warn(w, `tempo ${m.tempo} is not an integer; the app rounds tempos to integers when edited`);
      }
    }

    // rehearsalNumber
    const rn = m.rehearsalNumber;
    if (rn !== null && rn !== undefined) {
      if (typeof rn === 'string') {
        if (rn.trim() === '') issues.error(w, 'rehearsalNumber must not be an empty string (use null)');
        else if (Number.isInteger(Number(rn)) && String(Number(rn)) === rn.trim()) issues.warn(w, `rehearsalNumber "${rn}" should be the number ${rn} (the app stores integer-looking labels as numbers)`);
      } else if (typeof rn !== 'number' || !isInt(rn)) {
        issues.error(w, `rehearsalNumber must be null, an integer or a string (got ${JSON.stringify(rn)})`);
      }
    }
  });

  // Duplicate resolved labels usually mean an unrolled repeat lost its distinguishing labels
  const seenLabels = new Map();
  labels.forEach((l, i) => {
    const key = String(l);
    seenLabels.set(key, [...(seenLabels.get(key) ?? []), i + 1]);
  });
  const duplicates = [...seenLabels].filter(([, at]) => at.length > 1);
  if (duplicates.length > 0) {
    const shown = duplicates.slice(0, 5).map(([l, at]) => `"${l}" on measures ${at.join(', ')}`).join('; ');
    issues.warn('labels', `duplicate measure labels: ${shown}${duplicates.length > 5 ? '; …' : ''}. Fine if intentional; otherwise give each pass of an unrolled repeat distinct labels`);
  }

  // First-measure tempo
  const first = measures[0];
  if (isObject(first) && first.tempo === null) {
    issues.warn(where(0), `first measure has no tempo; playback will assume quarter=${DEFAULT_TEMPO}`);
  }

  // Resolved (inherited) tempos, for span checks
  const resolvedTempo = [];
  let current = DEFAULT_TEMPO;
  measures.forEach((m, i) => {
    if (measureOk[i] && typeof m.tempo === 'number') current = m.tempo;
    resolvedTempo.push(current);
  });

  // Accel/rit spans
  measures.forEach((m, i) => {
    if (!isObject(m) || !('gradualTempo' in m) || m.gradualTempo === null) return;
    const w = where(i);
    const gt = m.gradualTempo;
    if (!isObject(gt) || !isInt(gt.measureLength) || gt.measureLength < 0 || !('endTempo' in gt)) {
      issues.error(w, 'gradualTempo must be null or { measureLength: integer >= 0, endTempo: number|null }');
      return;
    }
    const start = resolvedTempo[i];
    if (gt.measureLength === 0) {
      if (typeof gt.endTempo !== 'number' || gt.endTempo < TEMPO_MIN || gt.endTempo > TEMPO_MAX) {
        issues.error(w, `single-measure accel/rit (measureLength 0) needs endTempo as quarter-note BPM in ${TEMPO_MIN}–${TEMPO_MAX} (got ${JSON.stringify(gt.endTempo)}); otherwise it does nothing`);
      } else if (gt.endTempo === start) {
        issues.warn(w, 'accel/rit arrival tempo equals the starting tempo, so nothing changes');
      }
      return;
    }
    if (gt.endTempo !== null) issues.warn(w, 'endTempo is ignored for multi-measure accel/rit (the arrival measure’s tempo is the target); use null');
    const arrival = i + gt.measureLength;
    if (arrival >= measures.length) {
      issues.error(w, `accel/rit spans ${gt.measureLength} measure(s) but the exercise ends at measure ${measures.length}; the arrival measure does not exist, so nothing would change`);
      return;
    }
    for (let j = i + 1; j < arrival; j++) {
      const mj = measures[j];
      if (isObject(mj) && mj.tempo !== null && mj.tempo !== undefined) {
        issues.error(w, `accel/rit passes through ${where(j)}, which has its own tempo; only the arrival measure (${where(arrival)}) may set a tempo`);
      }
      if (isObject(mj) && mj.gradualTempo !== null && mj.gradualTempo !== undefined) {
        issues.error(w, `accel/rit passes through ${where(j)}, which starts another accel/rit; spans may end where another begins but not overlap`);
      }
    }
    const arrivalMeasure = measures[arrival];
    if (isObject(arrivalMeasure) && (arrivalMeasure.tempo === null || arrivalMeasure.tempo === undefined)) {
      issues.error(w, `arrival ${where(arrival)} has no explicit tempo, so it inherits the start tempo and the accel/rit does nothing; give it a tempo`);
    } else if (resolvedTempo[arrival] === start) {
      issues.warn(w, `arrival tempo equals the starting tempo (${start} quarter-note BPM), so nothing changes`);
    }
  });

  return issues.list;
}

// ==========================================================================================
// Timing estimate (mirror of the tempo/duration parts of src/utils/resolveExercise.ts)
// ==========================================================================================

/** Total playback time in ms at 100% speed. Assumes the exercise passed validation. */
export function estimateDurationMs(ex) {
  const measures = ex.measures;
  const tempos = [];
  let current = DEFAULT_TEMPO;
  for (const m of measures) {
    if (m.tempo !== null) current = m.tempo;
    tempos.push(current);
  }
  const beatMs = measures.map((m, i) =>
    m.beats.map((b) => b.subdivisions * (60000 / tempos[i]) * (4 / m.meter[1])));

  measures.forEach((m, i) => {
    const gt = m.gradualTempo;
    if (gt === null) return;
    const start = tempos[i];
    let end;
    let spanEnd;
    if (gt.measureLength === 0) {
      end = gt.endTempo ?? start;
      spanEnd = i + 1;
    } else {
      const arrival = i + gt.measureLength;
      end = arrival < measures.length ? tempos[arrival] : start;
      spanEnd = Math.min(arrival, measures.length);
    }
    const refs = [];
    for (let j = i; j < spanEnd; j++) measures[j].beats.forEach((_, bi) => refs.push([j, bi]));
    const n = refs.length;
    if (n <= 1) return;
    refs.forEach(([j, bi], k) => {
      const t = start * Math.pow(end / start, k / (n - 1));
      beatMs[j][bi] = measures[j].beats[bi].subdivisions * (60000 / t) * (4 / measures[j].meter[1]);
    });
  });

  let total = 0;
  measures.forEach((m, i) => m.beats.forEach((b, bi) => {
    total += b.hold !== null ? b.hold * 1000 : beatMs[i][bi];
  }));
  return total;
}

// ==========================================================================================
// Share codes (same format as src/utils/sharing.ts: gzip -> base64url, in ?share=)
// ==========================================================================================

export function encodeExercise(exercise) {
  return gzipSync(Buffer.from(JSON.stringify(exercise), 'utf8')).toString('base64url');
}

export function shareUrl(exercise, base = DEFAULT_BASE_URL) {
  const url = new URL(base);
  url.searchParams.set('share', encodeExercise(exercise));
  return url.toString();
}

/** Accepts a full share URL, a "?share=..." fragment, or a bare code. */
export function decodeShare(input) {
  let code = input.trim();
  const fromParam = /[?&]share=([^&#\s]+)/.exec(code);
  if (fromParam) code = fromParam[1];
  const json = gunzipSync(Buffer.from(decodeURIComponent(code), 'base64url')).toString('utf8');
  return JSON.parse(json);
}

// ==========================================================================================
// Authoring format -> canonical exercise
// ==========================================================================================

const AUTHORING_TOP_KEYS = ['id', 'name', 'measures', 'comment'];
const AUTHORING_MEASURE_KEYS = ['meter', 'beats', 'holds', 'tempo', 'gradual', 'label', 'repeat', 'comment'];
const AUTHORING_BEAT_KEYS = ['subdivisions', 'hold', 'highlightSubdivisions', 'highlights'];

function parseMeter(value) {
  if (typeof value === 'string') {
    const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(value);
    if (m) return [Number(m[1]), Number(m[2])];
  } else if (Array.isArray(value) && value.length === 2 && value.every(isInt)) {
    return [value[0], value[1]];
  }
  throw new Error(`meter must be a string like "7/8" (got ${JSON.stringify(value)})`);
}

function makeBeat(subdivisions, hold = null, highlightSubdivisions = 0, highlights = []) {
  return { subdivisions, hold, highlightSubdivisions, highlights };
}

function normalizeLabel(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = value.trim();
    if (t === '') return null;
    return Number.isInteger(Number(t)) && String(Number(t)) === t ? Number(t) : t;
  }
  throw new Error(`label must be a string or integer (got ${JSON.stringify(value)})`);
}

/**
 * Expands the authoring format. Returns { exercise, issues } where issues include both
 * expansion problems and everything validateExercise finds in the result.
 * `exercise` is null when expansion itself failed.
 */
export function buildExercise(input) {
  const issues = new Issues();
  if (!isObject(input)) {
    issues.error('input', 'must be a JSON object with "name" and "measures"');
    return { exercise: null, issues: issues.list };
  }
  for (const k of unknownKeys(input, AUTHORING_TOP_KEYS)) issues.error('input', `unknown field "${k}" (allowed: ${AUTHORING_TOP_KEYS.join(', ')})`);
  if (typeof input.name !== 'string' || input.name.trim() === '') issues.error('input.name', 'must be a non-empty string');
  if (!Array.isArray(input.measures) || input.measures.length === 0) {
    issues.error('input.measures', 'must be a non-empty array');
    return { exercise: null, issues: issues.list };
  }
  if (input.id !== undefined && (typeof input.id !== 'string' || input.id.trim() === '')) issues.error('input.id', 'must be a non-empty string if given');

  const measures = [];
  let expansionFailed = false;
  let prev = null; // previous canonical measure

  input.measures.forEach((raw, idx) => {
    const w = `input measure ${idx + 1}`;
    const fail = (msg) => {
      issues.error(w, msg);
      expansionFailed = true;
    };
    if (!isObject(raw)) return fail('must be an object');
    const unknown = unknownKeys(raw, AUTHORING_MEASURE_KEYS);
    if (unknown.length > 0) return fail(`unknown field(s) ${unknown.map((k) => `"${k}"`).join(', ')} (allowed: ${AUTHORING_MEASURE_KEYS.join(', ')})`);

    try {
      // meter (inherits from previous measure)
      let meter;
      if (raw.meter === undefined) {
        if (!prev) return fail('the first measure needs a "meter"');
        meter = [...prev.meter];
      } else {
        meter = parseMeter(raw.meter);
      }
      const [numerator, denominator] = meter;

      // beats
      let beats;
      if (raw.beats === undefined) {
        const sameMeter = prev && prev.meter[0] === numerator && prev.meter[1] === denominator;
        const grouping = sameMeter ? prev.beats.map((b) => b.subdivisions) : defaultGrouping(numerator, denominator);
        beats = grouping.map((s) => makeBeat(s));
      } else if (Array.isArray(raw.beats) && raw.beats.length > 0) {
        beats = raw.beats.map((b, bi) => {
          if (isInt(b)) return makeBeat(b);
          if (isObject(b)) {
            const bad = unknownKeys(b, AUTHORING_BEAT_KEYS);
            if (bad.length > 0) throw new Error(`beat ${bi + 1}: unknown field(s) ${bad.join(', ')}`);
            return makeBeat(b.subdivisions, b.hold ?? null, b.highlightSubdivisions ?? 0, b.highlights ?? []);
          }
          throw new Error(`beat ${bi + 1} must be an integer (subdivisions) or an object`);
        });
      } else {
        return fail('beats must be an array like [2, 2, 3] (or omit it for the default grouping)');
      }

      // holds: { "<1-based beat number>": seconds }
      if (raw.holds !== undefined) {
        if (!isObject(raw.holds)) return fail('holds must be an object like {"4": 3} (1-based beat number -> seconds)');
        for (const [key, seconds] of Object.entries(raw.holds)) {
          const n = Number(key);
          if (!isInt(n) || n < 1 || n > beats.length) return fail(`holds key "${key}" must be a beat number from 1 to ${beats.length}`);
          if (beats[n - 1].hold !== null) return fail(`beat ${n} has a hold both in "beats" and in "holds"`);
          beats[n - 1].hold = seconds;
        }
      }

      // tempo
      const tempo = raw.tempo === undefined || raw.tempo === null ? null : parseTempo(raw.tempo).internal;
      if (typeof raw.tempo === 'string') {
        const { exact, internal } = parseTempo(raw.tempo);
        if (exact !== internal) issues.warn(w, `tempo "${raw.tempo}" is ${exact} quarter-note BPM; rounded to ${internal} like the app does`);
      }

      // gradual
      let gradualTempo = null;
      if (raw.gradual !== undefined && raw.gradual !== null) {
        const g = raw.gradual;
        if (!isObject(g) || unknownKeys(g, ['measures', 'to']).length > 0 || !isInt(g.measures) || g.measures < 0) {
          return fail('gradual must be { "measures": N } for a multi-measure accel/rit, or { "measures": 0, "to": "quarter=60" } within one measure');
        }
        if (g.measures === 0) {
          if (g.to === undefined) return fail('a single-measure gradual ("measures": 0) needs "to", e.g. "quarter=60"');
          const { exact, internal } = parseTempo(g.to);
          if (exact !== internal) issues.warn(w, `gradual.to "${g.to}" is ${exact} quarter-note BPM; rounded to ${internal}`);
          gradualTempo = { measureLength: 0, endTempo: internal };
        } else {
          if (g.to !== undefined) return fail('"to" is only for single-measure gradual; a multi-measure accel/rit arrives at the tempo of the measure it ends on, so give that measure a "tempo"');
          gradualTempo = { measureLength: g.measures, endTempo: null };
        }
      }

      const label = normalizeLabel(raw.label);

      // repeat
      const repeat = raw.repeat === undefined ? 1 : raw.repeat;
      if (!isInt(repeat) || repeat < 1 || repeat > MAX_REPEAT) return fail(`repeat must be an integer 1–${MAX_REPEAT}`);

      for (let copy = 0; copy < repeat; copy++) {
        const measure = {
          meter: [...meter],
          beats: beats.map((b) => ({ ...b, highlights: [...b.highlights] })),
          tempo: copy === 0 ? tempo : null,
          rehearsalNumber: copy === 0 ? label : null,
          gradualTempo: copy === 0 && gradualTempo ? { ...gradualTempo } : null,
        };
        measures.push(measure);
        prev = measure;
      }
    } catch (e) {
      fail(e.message);
    }
  });

  if (expansionFailed) return { exercise: null, issues: issues.list };

  const exercise = {
    id: input.id ?? randomUUID(),
    name: typeof input.name === 'string' ? input.name.trim() : '',
    measures,
  };
  issues.list.push(...validateExercise(exercise));
  return { exercise, issues: issues.list };
}

// ==========================================================================================
// Human-readable summary
// ==========================================================================================

function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function describeTempo(internal, meter, beats) {
  const [, denominator] = meter;
  const first = beats[0].subdivisions;
  const name = beatName(denominator, first);
  const shown = toDisplayTempo(internal, denominator, first);
  return name ? `${name}=${shown}` : `${first}/${denominator}=${shown}`;
}

/** One line per measure, so the score can be checked against the result. */
export function describeExercise(ex) {
  const labels = resolveLabels(ex.measures);
  const tempos = [];
  let current = DEFAULT_TEMPO;
  for (const m of ex.measures) {
    if (m.tempo !== null) current = m.tempo;
    tempos.push(current);
  }
  const rows = ex.measures.map((m, i) => {
    const notes = [];
    if (m.tempo !== null) notes.push(`tempo ${describeTempo(m.tempo, m.meter, m.beats)}`);
    m.beats.forEach((b, bi) => {
      if (b.hold !== null) notes.push(`hold beat ${bi + 1} = ${b.hold}s`);
      if ((b.highlightSubdivisions ?? 0) > 0) notes.push(`highlights beat ${bi + 1}: ${(b.highlights ?? []).join(',') || 'none'} of ${b.highlightSubdivisions}`);
    });
    if (m.gradualTempo) {
      const gt = m.gradualTempo;
      const start = tempos[i];
      const end = gt.measureLength === 0 ? gt.endTempo : tempos[Math.min(i + gt.measureLength, tempos.length - 1)];
      const kind = end > start ? 'accel.' : end < start ? 'rit.' : 'no change';
      notes.push(gt.measureLength === 0
        ? `${kind} within this measure to ${describeTempo(gt.endTempo, m.meter, m.beats)}`
        : `${kind} over ${gt.measureLength} measure${gt.measureLength === 1 ? '' : 's'}, arriving at measure ${i + 1 + gt.measureLength}`);
    }
    return {
      index: String(i + 1),
      label: String(labels[i]),
      meter: `${m.meter[0]}/${m.meter[1]}`,
      beats: m.beats.map((b) => b.subdivisions).join('+'),
      notes: notes.join('; '),
    };
  });
  const widths = {
    index: Math.max(1, ...rows.map((r) => r.index.length)),
    label: Math.max(5, ...rows.map((r) => r.label.length)),
    meter: Math.max(5, ...rows.map((r) => r.meter.length)),
    beats: Math.max(5, ...rows.map((r) => r.beats.length)),
  };
  const pad = (s, n) => s.padEnd(n);
  const lines = [`${pad('#', widths.index)}  ${pad('label', widths.label)}  ${pad('meter', widths.meter)}  ${pad('beats', widths.beats)}  notes`];
  for (const r of rows) {
    lines.push(`${pad(r.index, widths.index)}  ${pad(r.label, widths.label)}  ${pad(r.meter, widths.meter)}  ${pad(r.beats, widths.beats)}  ${r.notes}`.trimEnd());
  }
  return lines.join('\n');
}

// ==========================================================================================
// CLI
// ==========================================================================================

/** "-" = stdin; an existing file path = its contents; anything else is used literally (a share URL/code). */
function readInput(arg) {
  if (arg === '-') return readFileSync(0, 'utf8');
  if (existsSync(arg)) return readFileSync(arg, 'utf8');
  if (/share=|^[A-Za-z0-9_-]{20,}$/.test(arg)) return arg;
  return readFileSync(arg, 'utf8'); // let the usual ENOENT explain a mistyped path
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      flags[argv[i].slice(2)] = argv[i + 1];
      i++;
    } else {
      positional.push(argv[i]);
    }
  }
  return { positional, flags };
}

function printIssues(issues, log) {
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  if (errors.length > 0) {
    log(`\nERRORS (${errors.length}):`);
    for (const e of errors) log(`  - ${e.where}: ${e.message}`);
  }
  if (warnings.length > 0) {
    log(`\nWarnings (${warnings.length}):`);
    for (const w of warnings) log(`  - ${w.where}: ${w.message}`);
  }
  return errors.length;
}

const USAGE = `Usage:
  node exercise.mjs build    <authoring.json> [--out canonical.json] [--base URL]
  node exercise.mjs validate <canonical.json | share-url | share-code>
  node exercise.mjs encode   <canonical.json> [--base URL]
  node exercise.mjs decode   <share-url | share-code> [--out file.json]
Use "-" as the file to read stdin. Default base URL: ${DEFAULT_BASE_URL}`;

function loadCanonical(arg) {
  const text = readInput(arg);
  try {
    return JSON.parse(text);
  } catch {
    return decodeShare(text); // not JSON: treat as a share URL/code
  }
}

export function main(argv, log = console.log) {
  const [command, ...rest] = argv;
  const { positional, flags } = parseArgs(rest);
  const target = positional[0];
  if (!command || !target) {
    log(USAGE);
    return 2;
  }
  const base = flags.base ?? DEFAULT_BASE_URL;

  if (command === 'build') {
    const { exercise, issues } = buildExercise(JSON.parse(readInput(target)));
    const errorCount = printIssues(issues, log);
    if (errorCount > 0 || !exercise) {
      log('\nNo share link produced: fix the errors above.');
      return 1;
    }
    log(`\nExercise "${exercise.name}" — ${exercise.measures.length} measures, ~${formatDuration(estimateDurationMs(exercise))} at 100% speed\n`);
    log(describeExercise(exercise));
    if (flags.out) {
      writeFileSync(flags.out, JSON.stringify(exercise, null, 2) + '\n');
      log(`\nCanonical JSON written to ${flags.out}`);
    }
    const url = shareUrl(exercise, base);
    log(`\nShare URL (${url.length} characters):\n${url}`);
    if (url.length > LONG_URL_CHARS) log(`\nNote: this URL is long (over ${LONG_URL_CHARS} characters). Some chat UIs truncate long links, so also deliver the canonical JSON.`);
    return 0;
  }

  if (command === 'validate' || command === 'encode') {
    const exercise = loadCanonical(target);
    const issues = validateExercise(exercise);
    const errorCount = printIssues(issues, log);
    if (errorCount > 0) return 1;
    if (command === 'validate') {
      log(`OK: "${exercise.name}" — ${exercise.measures.length} measures, ~${formatDuration(estimateDurationMs(exercise))} at 100% speed${issues.length ? ' (with warnings)' : ''}`);
      return 0;
    }
    const url = shareUrl(exercise, base);
    log(`\nShare URL (${url.length} characters):\n${url}`);
    return 0;
  }

  if (command === 'decode') {
    const exercise = decodeShare(readInput(target));
    const text = JSON.stringify(exercise, null, 2) + '\n';
    if (flags.out) {
      writeFileSync(flags.out, text);
      log(`Canonical JSON written to ${flags.out}`);
    } else {
      log(text);
    }
    return 0;
  }

  log(USAGE);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exitCode = 1;
  }
}
