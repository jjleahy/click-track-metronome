---
name: click-track-exercises
description: Create or edit exercises for the Click Track Metronome web app and produce a share link that imports them. Use when the user wants a click track, practice exercise or "map" of a piece with time signature changes, set tempos, tempo changes, accelerando/ritardando or fermatas, or gives a Click Track Metronome share link to inspect or modify.
---

# Click Track Metronome exercises

[Click Track Metronome](https://jjleahy.github.io/click-track-metronome/) lets musicians map the rhythmic structure of a piece — time signature changes, tempos, accelerandi/ritardandi, fermatas — and plays back a click track that follows it. An **exercise** is a named list of measures. You produce one as JSON; a script validates it and turns it into a **share link** the user opens to import it into the app.

Never write a share link by hand: the code is gzip + base64 and must come from `scripts/exercise.mjs`.

## Workflow

1. **Get the facts.** For each section of the piece you need: meter (and beat grouping if it is additive or ambiguous), the tempo marking **including its note value** (♩=120, ♩.=60, ♪=176 — not just "120"), tempo changes, fermata lengths in seconds, accel/rit spans and where they arrive, and the measure numbers/rehearsal marks the user wants to see. Ask about anything missing. Do not invent tempos or fermata lengths silently; if you propose a value, say so.
2. **Write the authoring JSON** (`name` + `measures`). Field reference: `references/authoring-format.md`. How to translate notation into it (compound/additive meters, rit. and "a tempo", fermatas, repeats, pickups): `references/musical-mapping.md`.
3. **Build it:** `node scripts/exercise.mjs build input.json --out exercise.json`. Fix every error and rerun. Read every warning.
4. **Check the summary table against the score** — measure count, labels, meters, beat groupings, tempos, accel/rit spans, holds, and the estimated total time at 100% speed. The script can only confirm the exercise is *valid*, not that it *matches the piece*.
5. **Deliver** the share URL exactly as printed (a link or code block, never retyped), the `exercise.json` file, and a short list of assumptions you made (inferred groupings, tempo interpretations, fermata lengths). Mention that highlights and fine-tuning are best done in the app after importing.

Run the scripts from this skill's directory (the paths here are relative to it). Write working files to the outputs directory if the environment has one.

## Rules that matter most

- **Tempos in the authoring format always name a note:** `"quarter=120"`, `"dotted-quarter=60"`, `"eighth=176"` (also `q`, `q.`, `e`, …). Bare numbers are rejected. The app stores every tempo as **quarter-note BPM** (6/8 at dotted-quarter=60 is stored as 90) — the script converts, but if you edit canonical JSON by hand you must convert yourself. Valid stored range: 20–300.
- **Beats are the clicks.** `beats` lists each big beat's length in denominator units and must sum to the numerator (7/8 → `[2,2,3]`). Omit `beats` for the default grouping (see `references/exercise-spec.md`).
- **Tempo is inherited.** Set `tempo` only on the measure where it changes. The first measure should always have one (otherwise it defaults to quarter=80).
- **Multi-measure accel/rit:** `gradual: {"measures": N}` on the first measure; the measure N later is the **arrival** and **must have its own `tempo`** (that is the target); measures in between must not set a tempo. Accel vs rit is inferred from the direction. Single-measure form: `gradual: {"measures": 0, "to": "quarter=60"}`.
- **Fermata = `holds`**: `"holds": {"4": 3}` holds beat 4 for 3 seconds (1-based beat number; replaces the beat's normal length; max 9.9 s).
- **Repeats must be written out** (there are no repeat signs, D.S., D.C. or codas). Use `"repeat": N` for identical consecutive measures, and give each pass of a repeated section distinct `label`s (e.g. `"5b"`) so the user can tell the passes apart. Text labels do not disturb the automatic numbering.
- Only big beats are represented — no tuplets, rhythms, or multiple voices.

## Editing an existing exercise

`node scripts/exercise.mjs decode "<share url>" --out exercise.json` gives the canonical JSON. Edit it carefully (tempos there are quarter-note BPM; every measure needs all five fields, using `null` for "none"), then `validate exercise.json` and `encode exercise.json`. Keep the exercise's `id` if the user should get a "Replace existing?" prompt when importing; use a new UUID to import as a separate exercise.

## Commands

```
node scripts/exercise.mjs build    input.json [--out exercise.json] [--base URL]   # authoring -> validate -> share URL
node scripts/exercise.mjs validate <exercise.json | share URL>                      # canonical format
node scripts/exercise.mjs encode   <exercise.json> [--base URL]                     # canonical -> share URL
node scripts/exercise.mjs decode   <share URL | code> [--out file.json]             # share URL -> canonical
```

Node 18+, no dependencies. Exit code 1 means errors (no URL is printed). `examples/` has two worked inputs.

## App context (not part of an exercise)

The share link carries only the exercise. Playback settings — speed percentage (10–200%), count-in (prep) beats, looping, start/end measure, click sounds and volumes, subdivision clicks, and per-beat highlight sounds — are set in the app and are not stored in it. The user is expected to tune those (and any fine detail) in the app after importing. More detail: `references/exercise-spec.md`.

## References

- `references/authoring-format.md` — every field `build` accepts, with examples
- `references/musical-mapping.md` — turning a score or description into measures
- `references/exercise-spec.md` — the canonical data model, exact semantics and all validation rules
