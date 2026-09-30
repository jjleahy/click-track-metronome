# Authoring format (input to `build`)

A friendlier JSON format that `scripts/exercise.mjs build` expands into the app's canonical format (see `exercise-spec.md`). Unknown fields are **errors**, so typos are caught.

```json
{
  "name": "Rite of Spring, Augurs of Spring (opening)",
  "id": "optional — reuse an existing exercise's id to make the import a replacement",
  "measures": [
    { "meter": "4/4", "tempo": "quarter=100", "label": 1 },
    { "meter": "7/8", "beats": [2, 2, 3], "repeat": 2 }
  ]
}
```

Top level: `name` (required, shown on the exercise's tab), `id` (optional; a fresh UUID is generated if omitted), `measures` (required, non-empty), `comment` (ignored).

## Measure fields

All optional except `meter` on the first measure.

| Field | Meaning |
|---|---|
| `meter` | `"7/8"` (or `[7, 8]`). **Omitted = same as the previous measure.** Numerator 1–19, denominator 1–16 (use 1, 2, 4, 8, 16). |
| `beats` | The big beats (the clicks). Array of integers = each beat's length in denominator units, e.g. `[2,2,3]` in 7/8. Must sum to the numerator. **Omitted = the previous measure's grouping if its meter is identical, otherwise the default grouping** for that meter (`exercise-spec.md`). Elements may also be objects `{ "subdivisions": 3, "hold": 2, "highlightSubdivisions": 2, "highlights": [0] }`. |
| `holds` | Fermatas: `{ "4": 3 }` = beat 4 lasts 3 seconds. Keys are **1-based beat numbers**. Seconds in (0, 9.9]. |
| `tempo` | A string naming the note that gets the beat: `"quarter=120"`, `"dotted-quarter=60"`, `"eighth=176"`, `"half=60"`, `"sixteenth=200"`. Short forms: `q`, `q.`, `e`, `e.`, `h`, `s`, `w` (`.` or `dotted-` makes a note dotted). **Bare numbers are rejected.** Omitted = inherit the previous tempo. The note value need not match the measure's beat unit — the script converts to quarter-note BPM and rounds to an integer (warning if rounding changed it). Result must be 20–300 quarter-note BPM. |
| `gradual` | Accelerando/ritardando starting at this measure. `{ "measures": N }` (N ≥ 1): ramps over N measures and **arrives at the tempo of the measure N later, which must have its own `tempo`**. `{ "measures": 0, "to": "quarter=60" }`: ramps within this one measure to the given tempo. Direction (accel. vs rit.) is inferred. |
| `label` | Measure number / rehearsal mark shown for this measure: an integer (`12`), an integer-looking string (`"12"` → 12), or text (`"A"`, `"12b"`). Omitted = automatic (see below). |
| `repeat` | `N` ≥ 1: emit N identical copies of this measure (default 1). |
| `comment` | Ignored; use for notes to yourself. |

### `repeat`
Copies share `meter`, `beats` and `holds`. `tempo`, `label` and `gradual` apply to the **first copy only**; later copies inherit the tempo and get automatic labels. `gradual.measures` counts *expanded* measures, so a ramp can start on a repeated measure and run through its copies.

### Labels
Automatic labels count up from the last **integer** label (starting at 1). Text labels never affect the count, so a repeated section can be labelled `"5b"`, `"6b"`… without breaking the numbering that follows. A pickup measure can be labelled `0` so the first full measure is 1. The build summary prints every measure's resolved label — check it. Duplicate labels produce a warning (intentional duplicates are fine).

### Beat inheritance example
```jsonc
[
  { "meter": "7/8", "beats": [3, 2, 2], "tempo": "eighth=200" },
  {},                     // 7/8, [3,2,2] (same meter -> same grouping)
  { "meter": "4/4" },     // default [1,1,1,1]
  { "meter": "7/8" }      // default [2,2,3] — grouping is NOT remembered across a meter change
]
```

## What `build` prints
Errors and warnings; then a one-line-per-measure table (label, meter, grouping, tempo/hold/accel notes), the estimated total time at 100% speed, and the share URL. With `--out`, the canonical JSON is also saved. See `../examples/` for complete inputs.

## Not expressible here
Repeat signs, D.S./D.C./codas (unroll them), rhythms inside a beat, several voices. Playback settings are not part of an exercise.
