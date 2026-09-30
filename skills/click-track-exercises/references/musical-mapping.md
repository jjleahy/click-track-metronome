# Translating a score or description into measures

The app models a piece as a linear list of measures, each with a meter, big beats (one click each), and optionally a tempo, a fermata or an accel/rit. It does not model rhythms, so you decide what each *click* represents.

## Meter and beats

- **Simple meters** (2/4, 3/4, 4/4, 2/2, 3/2): omit `beats` — one click per written beat.
- **Compound meters** (6/8, 9/8, 12/8): omit `beats` for the usual dotted-beat pulse (`3+3`, `3+3+3`, `3+3+3+3`). For a slow 6/8 felt in six, use `"beats": [1,1,1,1,1,1]`.
- **Additive / asymmetrical meters** (5/8, 7/8, 8/8, 10/8, 5/4, 7/4…): use the composer's grouping — `[2,2,3]`, `[3,2,2]`, `[3,2]`, `[2,3]`. The defaults for 5/4, 6/4, 7/4, 4/8, 3/8, 2/8 are poor guesses (for example 7/4 → `[3,3,1]`, 4/8 → `[3,1]`), so always give `beats` for those. The numbers are counted in denominator units and must sum to the numerator.
- Fewer clicks (one per bar) or more (one per subdivision) are both fine; pick what the musician counts. A whole-bar click in 4/4 is `"beats": [4]`.
- **Pickup / anacrusis:** write it as its own short measure (`"meter": "1/4"`) and give it `"label": 0` so the first full measure is 1.
- Mid-piece meter changes need nothing special: put the new `meter` on the first measure that uses it; later measures inherit it.

## Tempo

- Copy the marking's note value: ♩=120 → `"quarter=120"`, ♩.=60 → `"dotted-quarter=60"`, ♪=176 → `"eighth=176"`, half-note=60 → `"half=60"`. The note doesn't have to match the beat grouping — the script converts (e.g. `"eighth=176"` in 7/8 is stored as 88 quarter-note BPM).
- Only put `tempo` on the measure where it *changes*. "A tempo" / "Tempo I" means restating the earlier tempo explicitly on that measure.
- Tempo words without numbers (Allegro, Andante) are not enough — ask the user for a number, or propose one and flag it as an assumption.
- **Metric modulation** ("♩ = ♪" or "new ♩. = old ♩"): work out the new number. If the new dotted quarter equals the old quarter at 120, the new marking is `"dotted-quarter=120"`. If the new quarter equals the old eighth at 90 quarter-BPM (eighth=180), it is `"quarter=180"`.
- The stored range is 20–300 quarter-note BPM. Very slow or very fast markings in a large note value may fall outside it (`"half=30"` = 15): rewrite in a smaller note value only if the result stays in range; otherwise tell the user.

## Accelerando / ritardando

A ramp changes tempo geometrically beat by beat, from the start measure's tempo to the **arrival measure's tempo**. The last beat of the measure *before* the arrival is already at the target, and the arrival measure itself plays flat at its own tempo. So:

- Start measure: `"gradual": {"measures": N}`.
- Arrival measure (N measures later): **must set `tempo`** — that is the target.
- Measures in between: no `tempo`, no other `gradual`.
- A ramp may end on a measure where another one starts (rit. straight into an accel.), but ramps cannot overlap.

Common cases:

| Score says | Model as |
|---|---|
| "rit. over bars 5–6, then slower tempo at 7" | bar 5: `gradual {measures: 2}`; bar 7: `tempo` = the new slower tempo |
| "accel. from bar 9 to bar 12 (♩=144)" | bar 9: `gradual {measures: 3}`; bar 12: `tempo: "quarter=144"` |
| "rit. in bar 8, a tempo at bar 9" | bar 8: `gradual {measures: 0, to: "quarter=90"}`; bar 9: `tempo` restated (the "a tempo") |
| "rit. over bars 5–6, then a tempo" | The arrival measure plays flat at the slow tempo. Either use the single-measure form on the last bar of the rit., or accept one bar at the slow tempo (arrival bar 7 at the slow tempo) and restate the tempo on bar 8. Tell the user which you chose. |
| "rit. into a fermata" | the fermata measure is the arrival (slower tempo) and carries the `holds` |

Without a target tempo in the score ("poco rit."), propose a number (e.g. 15–25% slower), and say it is an assumption.

## Fermatas and pauses

`"holds": {"4": 3}` holds beat 4 for 3 seconds (1-based; the hold *replaces* that beat's normal length; max 9.9 s). Ask for the duration or propose 2–4 s and flag it. A fermata over a whole-bar rest or a general pause: give that bar `"beats": [4]` (in 4/4) and hold beat 1. A caesura is a hold on the beat before the break. Held beats play a single click at their start.

## Repeats, endings, D.S./D.C.

There is no repeat logic — write out exactly what is played, once through, in order.

- Identical consecutive bars: `"repeat": N`.
- Repeated section: duplicate its measures. Give the second pass distinct labels so the user can tell where they are: bars 5–8 the first time are labelled automatically (5, 6, 7, 8); the second pass `"label": "5b"`, `"6b"`, `"7b"`, `"8b"`. Text labels don't affect numbering, so the next unlabelled bar is 9.
- First/second endings: play both endings in sequence with their own labels (`"8a"`, `"8b"`).
- D.S. al coda, D.C. al fine, etc.: unroll to the actual sequence. Generate the JSON with a small script if it's long — the build step is the same.
- Match the score's own bar numbers where the user cares: put `"label": <number>` on the first measure and wherever the numbering jumps.

## Before you deliver

- Every measure's beats sum to its numerator (the script checks this).
- The build table's labels, meters, groupings and tempos match the score bar by bar.
- Every ramp's arrival measure has a tempo.
- Total time is plausible against the user's recording or expectation.
- Assumptions are listed for the user.
