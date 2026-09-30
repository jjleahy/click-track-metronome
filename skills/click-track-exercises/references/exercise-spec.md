# Exercise specification (canonical format)

This is the exact data model the app stores, shares and plays. `build` produces it from the authoring format; `decode` returns it; `validate` and `encode` consume it. Source of truth in the app: `src/models/Exercise.ts`, `src/utils/resolveExercise.ts`, `src/audio/scheduler.ts`.

```ts
interface Exercise { id: string; name: string; measures: Measure[]; }

interface Measure {
  meter: [number, number];                   // [numerator, denominator]
  beats: Beat[];
  tempo: number | null;                      // quarter-note BPM, or null = inherit
  rehearsalNumber: string | number | null;   // label override, null = automatic
  gradualTempo: GradualTempo | null;         // accel/rit STARTING at this measure
}

interface Beat {
  subdivisions: number;                      // length in denominator units (>= 1)
  hold: number | null;                       // fermata seconds, null = normal
  highlightSubdivisions?: number;            // 0–8, default 0
  highlights?: number[];                     // 0-based positions that play the highlight sound
}

interface GradualTempo { measureLength: number; endTempo: number | null; }
```

**Every key must be present** — the app breaks on `undefined` where it expects `null` (`tempo`, `rehearsalNumber`, `gradualTempo`, `hold`). Only the two highlight fields are optional.

## Exercise

- `id`: string, conventionally a UUID. Same `id` as an existing exercise → the app offers "Replace"; a new id → "Import" as a new tab.
- `name`: shown on the tab.
- `measures`: at least one. Playback is strictly linear, first to last.

## Meter and beats

- `meter`: integers; the editor allows numerator 1–19 and denominator 1–16. Denominators should be 1, 2, 4, 8 or 16.
- `beats`: each entry is one big beat = **one click**. `subdivisions` is its length in denominator units, so in x/8 a dotted quarter is `3`, in x/4 a quarter is `1`.
- **The subdivisions must sum to the numerator.** Otherwise the measure is flagged invalid and playback is disabled. `subdivisions: 0` is an editor placeholder — never emit it.
- Note glyph shown per beat: subdivisions/denominator of 1, 3/4, 1/2, 3/8, 1/4, 3/16, 1/8, 3/32, 1/16 map to whole, dotted-half, half, dotted-quarter, quarter, dotted-eighth, eighth, dotted-sixteenth, sixteenth. Anything else is drawn as a plain quarter note (still plays correctly).

### Default groupings (what the editor uses, and `build` when `beats` is omitted with a new meter)

| Meter | Beats | | Meter | Beats |
|---|---|---|---|---|
| 4/4 | 1,1,1,1 | | 10/8 | 3,3,2,2 |
| 3/4 | 1,1,1 | | 5/8 | 3,2 |
| 2/4 | 1,1 | | 7/8 | 2,2,3 |
| 6/8 | 3,3 | | 8/8 | 3,3,2 |
| 9/8 | 3,3,3 | | 2/2 | 1,1 |
| 12/8 | 3,3,3,3 | | 3/2 | 1,1,1 |

Any other meter: groups of 3 until fewer than 3 remain, then the remainder (5/4 → 3,2; 7/4 → 3,3,1; 4/8 → 3,1). These are often not what a musician wants; give `beats` explicitly.

## Tempo

`Measure.tempo` is **quarter-note BPM**, an integer 20–300 in practice, or `null` to inherit the previous measure's tempo. If the first measure is `null`, playback assumes 80.

The app *displays* a measure's tempo in terms of that measure's **first big beat** and converts on entry:

```
stored quarter BPM = shown BPM × (first beat as a fraction of a whole note) ÷ ¼
6/8, first beat 3/8: shown dotted-quarter=60 → stored 90
7/8, first beat 2/8: shown quarter=88        → stored 88 (2/8 = ¼)
```

The authoring format's tempo strings do this conversion for you (any note value, rounded like the app). Duration of a beat at tempo T: `subdivisions × (60000 / T) × (4 / denominator)` ms. All timing is at 100% speed; the app scales it by the speed percentage.

## Accel/rit (`gradualTempo`)

Attached to the measure where the ramp **starts**.

- `measureLength: N ≥ 1`, `endTempo: null`: ramp across the beats of this measure and the next N−1, **arriving at the tempo of the measure at index i+N**. Tempo interpolates geometrically per beat over all beats in the span (first beat = start tempo, last beat before the arrival = arrival tempo). The arrival measure then plays flat at its own tempo.
- `measureLength: 0`, `endTempo: T` (quarter-note BPM, 20–300): ramp within this single measure from its tempo to T.
- Direction (accel. or rit.) is derived from start vs. arrival tempo; equal tempos mean no ramp.
- Rules the editor enforces (and `validate` checks): the arrival measure must exist and have an explicit `tempo`; measures strictly between start and arrival must have `tempo: null` and `gradualTempo: null`; a ramp may end on a measure that starts another ramp, but ramps may not overlap.
- Holds inside a ramp are allowed; a held beat still occupies its position in the interpolation but plays for its hold time.

## Holds (fermatas)

`hold: seconds` (0 < s ≤ 9.9) **replaces** the beat's tempo-derived duration (it scales with the speed percentage like everything else). A held beat plays one click at its start; highlight positions after the first and subdivision clicks are skipped.

## Labels

`rehearsalNumber` resolves left to right: an explicit value is shown as is; otherwise the label is the most recent **numeric** label + 1 (starting at 1). Strings don't take part in numbering: a text label such as `"5b"` leaves the count untouched, so the next unlabelled measure continues from the last integer label. Integer-looking labels are stored as numbers (`12`, not `"12"`).

## Highlights (secondary)

Highlights are normally set in the app rather than generated. `highlightSubdivisions` (0–8) splits the beat evenly into that many positions; `highlights` lists the 0-based positions that play the highlight sound (position 0 replaces the normal beat click). Entries must be < `highlightSubdivisions`. Default is 0 / `[]`.

## Playback settings are not part of an exercise

Speed percentage, prep beats (count-in), loop, start/end measure, click sounds and volumes, and subdivision clicks belong to the app session, not the exercise or share link.

## Share link

`<app URL>?share=<code>` where `code = base64url(gzip(JSON.stringify(exercise)))` without padding. The app URL is `https://jjleahy.github.io/click-track-metronome/` (override with `--base` for local dev or another host). The app validates only that `id`, `name` and `measures` exist — nothing else — so malformed content imports and then misbehaves; always run `build`/`validate`. Very long URLs (roughly >2000 characters) may be truncated by some chat UIs, so also hand over the JSON file.

## Validation summary (`validate`)

Errors: missing/mistyped fields; missing `null`s; meter out of range; beats not summing to the numerator or non-positive; tempo outside 20–300; hold outside (0, 9.9]; highlight values out of range; ramp with a missing/tempo-less arrival, tempo or ramp inside its span, endTempo missing for a single-measure ramp. Warnings: unusual denominator; non-standard beat length; first measure without tempo; non-integer tempo; ramp that changes nothing; integer-looking string labels; duplicate labels; unknown fields; non-UUID id.
