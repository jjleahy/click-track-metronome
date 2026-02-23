# Click Track Metronome — Product Requirements Document

## Overview

Click Track Metronome is a free, open-source (let's do AGPL3), single-page web application that allows musicians to map out the full rhythmic structure of complex pieces — including time signature changes, beat patterns, tempo changes, accelerandi/ritardandi, and fermatas — and play them back with a metronome that follows those patterns.

Unlike simple metronomes that provide a steady pulse, Click Track Metronome models an entire piece's structure so musicians can practice with a click track that mirrors the actual score.

**Stack:** React + TypeScript, Vite for build/dev, hosted on Cloudflare Pages. Vitest + React Testing Library for testing. Music glyphs rendered with the Bravura font via absolute positioning. Within this repository a bundled dist will be the output; hosting will be done outside this repository.

---

## Layout

The application is divided into two main panels:

1. **Score Editor** (top) — a horizontally scrolling staff where users define the rhythmic structure of a piece
2. **Metronome** (bottom) — playback controls with tempo/percentage linking

---

## Score Editor

### Staff Display

The score editor displays a standard single-line staff with a treble clef. Measures are rendered left-to-right and scroll horizontally. Each measure displays:

- Time signature (at the start of the measure, or inherited from the previous measure — only displayed when it changes)
- Noteheads on a low G representing the "big beats" of the measure, with note values derived from the subdivision groupings (see Subdivision Editor below)
- The final measure always ends with a double barline

A **measure number input** is fixed to the left side of the staff area. Its value always reflects the leftmost currently visible measure. The user can type a measure number/label to scroll to that measure. On blur, if the typed value matches an existing measure label, the staff scrolls to it; otherwise the input reverts to the current scroll position's measure.

### Measure Editing Controls

Within the staff, each measure has inline controls for:

- Editing the time signature
- Overriding the default measure label
- Deleting the measure
- Inserting a new measure before/after

To the left of the staff (or in a sidebar), there are controls to **append measures** of a specific time signature (e.g., "Add 4 measures of 6/8").

### Subdivision Editor

Below the staff, under each measure's noteheads, is a row of **text inputs** representing the subdivision groupings for that measure's big beats. Each input contains a digit representing how many of the lower subdivision units are grouped into that beat.

**Defaults** are inferred from the time signature via a defaults lookup:

| Time Signature | Default Grouping |
|----------------|-----------------|
| 4/4            | 1, 1, 1, 1      |
| 3/4            | 1, 1, 1          |
| 6/8            | 3, 3             |
| 9/8            | 3, 3, 3          |
| 12/8           | 3, 3, 3, 3       |
| 10/8           | 3, 3, 2, 2       |
| 5/8            | 3, 2             |
| 7/8            | 2, 2, 3          |
| 8/8            | 3, 3, 2          |

For any unusual meter not in the defaults file, a sensible default is inferred. Users can always override by editing the digit inputs.

**Notehead rendering** adjusts to match the subdivision values. In 8/8 with groupings 3, 3, 2: the measure renders dotted quarter, dotted quarter, quarter. If the user changes the first input to 2 (making it 2, 3, 2), the first note becomes a quarter and a new empty input appears to the right for the remaining subdivision unit.

**Validation:** The sum of all subdivision digits in a measure must equal the time signature's numerator. If not, the measure is highlighted in red. Red measures prevent starting the metronome.

**Overflow behavior:** When a user types a digit that causes the total to exceed the numerator, inputs are removed from the right to make room. For example, in 8/8 with groupings 2, 3, 3: changing the first 2 to a 3 makes the first two notes dotted quarters and erases the last input (since 3 + 3 + 3 = 9 > 8), marking the measure red.

### Hold / Fermata Editor

Below the subdivision inputs, each beat has a **hold input** (usually left blank). If a number (in seconds) is entered:

- During playback, that beat is held for the specified duration (multiplied by the current playback percentage) instead of its normal tempo-derived duration
- Subdivisions within that held beat are suppressed during playback — it plays as a single click followed by the hold duration
- The hold value does **not** affect the subdivision UI — all inputs remain visible and editable
- Tempo and accel/rit are ignored for the duration of that beat; after the hold, playback resumes as if nothing changed
- Under the note, optionally display a fermata symbol

This system also serves as the mechanism for **out-of-time / cued sections**: a 1/1 measure where the single beat has a hold value effectively creates a free-time bar of a specified duration.

### Tempo Controls

Above the staff and measure editing controls are two layers of tempo information:

#### Fixed Tempo Markings

Each measure can optionally display a tempo marking in the form **(note) = (tempo)**. The note should always be the starting big beat (usually quarter note). The first measure defaults to **(big beat) = 80**. Any measure without an explicit tempo marking inherits the most recent tempo (reading left to right). For cases where the big beat changes, then convert such that quarter note remains the same (3/4 at quarter note = 135 followed by 6/8 will result in the 6/8 of a tempo of dotted quarter = 90).

#### Gradual Tempo Changes (Accel / Rit)

Users can create gradual tempo changes by clicking a starting measure and then clicking the same measure or any subsequent measure to define the span.

**Display:**

- **Multi-bar spans:** A colored line starts near the beginning of the starting measure and ends just past the beginning of the destination measure (visually demonstrating arrival at the destination tempo). An **X** button allows deletion.
- **Single-bar spans:** The line stays within the current measure and ends at the barline. A text input at the end of the line allows the user to specify the concluding tempo before the next measure begins with whatever its tempo is.
- **Color:** Accelerandi are displayed in red; ritardandi in blue. The direction is inferred from comparing start and arrival tempos.
- **Unknown arrival tempo:** If the destination measure has no explicit tempo, the span displays as a **gray line** (possibly with a "?" indicator). Once a tempo is set on the destination measure, the span updates to the appropriate color.

**Implied tempos:** Gradual tempo changes work with inherited tempos. A span starting on a measure with no explicit marking simply uses whatever tempo that measure inherited. Helper functions that resolve the full tempo map by reading the exercise left-to-right will handle this.

**Implementation:** Geometric tempo curve for v1. Linear and parabolic/quadratic curves (especially for rallentandos) are a future TODO.

---

## Metronome

The metronome panel sits below the score editor and provides playback controls.

### Core Controls

- **Starting measure input:** Sets where playback begins. Editing this value also updates the score editor's scroll position and measure number input.
- **Tempo input:** Displays the effective tempo at the starting measure.
- **Percentage input:** A practice speed multiplier (default 100%).

### Linked Input Behavior

The three inputs (starting measure, tempo, percentage) are linked:

```
displayed_tempo = starting_measure_tempo × (percentage / 100)
```

- **Starting measure changes** → tempo updates to that measure's effective tempo; percentage stays the same; displayed tempo recalculates.
- **Percentage changes** → displayed tempo recalculates; starting measure stays the same.
- **Tempo (displayed) changes** → percentage recalculates to match; starting measure stays the same.

### Playback Behavior

When the metronome starts:

- The **starting measure input does not change** — it retains the value the user set
- The **score editor scrolls** to follow playback, and its measure number input updates in real time
- Playback follows the full tempo map: fixed tempos, gradual tempo changes, and holds
- All durations (including hold/fermata seconds) are multiplied by the percentage
- The metronome cannot start if any measure is in a red/invalid state

### Click Patterns and Sound

_To be iterated on. Initial implementation will be a basic click sound, then continuing to for options of subdivision clicks, downbeat-only mode, silent beat practice modes, and experimenting sounds (Web Audio API oscillators and/or samples)._

### Visual Feedback

_To be iterated on alongside click patterns._

---

## Data Model

### Exercise

An exercise is the top-level object representing a piece's rhythmic structure.

```typescript
interface Exercise {
  id: string;          // GUID
  name: string;        // User-defined name
  measures: Measure[];
}
```

### Measure

```typescript
interface Measure {
  meter: [number, number];  // e.g., [6, 8] for 6/8
  beats: Beat[];
  tempo: number | null;     // Explicit tempo marking, or null to inherit
  rehearsalNumber: string | number | null;  // Display label override
  gradualTempo: GradualTempo | null;        // Accel/rit starting from this measure
}
```

### Beat

```typescript
interface Beat {
  subdivisions: number;  // How many lower units this beat groups (e.g., 3 for a dotted quarter in x/8)
  hold: number | null;   // Hold duration in seconds, or null for normal playback
}
```

### GradualTempo

```typescript
interface GradualTempo {
  measureLength: number;  // How many measures the change spans (0 = same measure only)
  // TODO: type: "geometric" | "linear" | "quadratic"
  // For now, always geometric
}
```

Using `measureLength` (relative) instead of a target measure index means insert/delete operations are local edits — no need to scan the entire exercise and update indices.

### Measure Label Resolution

Measure labels are resolved by reading left to right:

1. If the measure has an explicit `rehearsalNumber`, display it.
2. If not, look backwards to find the nearest measure with an explicitly or implicitly resolved **numerical** value. This measure's implied label is that value + 1.
3. If no prior numerical value is found, the implied label is `1`.

This handles:
- **Split measures:** 80, 80a, 81 (80 is explicit, 80a is explicit, 81 auto-resolves from 80)
- **Rewritten/skipped measures:** 120, 121e, 122e, 124 (the "e" labels are explicit strings; 124 would need to be explicit since the algorithm would otherwise resolve to 121)
- **Out-of-time sections:** 1, II, III, IV, V, 2 (roman numerals are explicit string labels that don't participate in numerical resolution; measure after V resolves by looking back to measure 1 and becoming 2)

---

## State Management

The exercise array is the primary state, managed as a single `useState`. Edits produce new arrays via spread/immutable update patterns.

Separate state atoms for:
- Current playback position
- Starting measure selection
- Metronome settings (percentage, sound preferences)
- UI state (scroll position, selected measure for editing)

### Resolved State Helpers

Since the raw data model uses inheritance and relative references, helper functions derive the fully resolved state:

- **resolveTempoMap(measures):** Walks left to right, filling in inherited tempos and computing gradual tempo curves
- **resolveMeasureLabels(measures):** Walks left to right, computing implied labels per the algorithm above
- **resolvePlaybackTimeline(measures, percentage):** Produces a flat timeline of click events with absolute timestamps, accounting for tempos, gradual changes, holds, and the percentage multiplier

---

## Persistence and Sharing

### Local Storage

Exercises are saved to local storage. Users can create, rename, delete, and switch between multiple exercises.

### URL Sharing

An exercise can be encoded into a URL for sharing:

- The exercise `name` and `measures` array are serialized and Base64-encoded into a URL query parameter
- Loading a URL with this parameter prompts: **"Load '[exercise name]'?"**
- Accepting adds the exercise to local storage
- The `id` is regenerated on import (not shared) to avoid collisions

---

## Accessibility

- All inputs have associated labels; all buttons are focusable and keyboard-operable
- Tab order follows logical reading order (score left-to-right, then metronome controls)
- Motion (scrolling, visual beat feedback) is toggleable and respects `prefers-reduced-motion`
- Sound is toggleable independently of playback (visual-only mode)
- Browser targets: modern evergreen browsers (Chrome, Firefox, Safari, Edge)

---

## Development Plan

### Stage 1: Working Metronome
- Git init, npm dependencies, react setup
- Create a hard-coded state of four bars of 4/4 at quarter = 80, no display
- Start a metronome that beats the big beats starting on measure 1
- ['Fork me on GitHub'](https://github.com/jjleahy/click-track-metronome) link on bottom

### Stage 2: Working Time Signature Editor and Tempo
- Can create bars of different time signatures
- Can set tempi on top of measures
- The first beat (eighth, quarter, dotted quarter, half note) is used for defining the tempo
- No need for music notation; plain horizontal display
- Metronome follows meter and tempo. Can set starting measure to different measure

### Stage 3: Music Notation and Initial Large Beat Display
- Load Bravura or simliar font. Render clef, time signatures, bars.
- Work on spacing and positioning.
- Confirm scrolling and input lining up with left-most visible measure
- Playing metronome auto-scrolls to line-up with music. Consider highlighting the currently beated big note.

### Stage 4: Metronome work
- Allow for different tones on downbeat, main beat, subdivisions
- Can set percentage/starting tempo based on starting measure
- Consider prep-beats (four beats for nothing)

### Stage 5: Accel/Rit and Hold
- Can make accel/rit
- Can make single measures with final tempo
- Can make multi-measures that use those measure's tempo

### Stage 6: State management / local storage / URL query param
- Exercises are stored with guid key; input for name
- Can create and switch between exercises
- Can generate URL params to share exercises (steal from repiano repo?)

---

## Folder Structure

```
click-track-metronome/
├── public/
│   └── fonts/              # Bravura font files (need to figure out how this works in practice)
├── src/
│   ├── components/
│   │   ├── ScoreEditor/    # Staff, measures, subdivision/hold editors, tempo controls
│   │   └── Metronome/      # Playback controls, linked inputs
│   ├── hooks/              # Custom React hooks (usePlayback, useExercise, etc.)
│   ├── models/             # TypeScript interfaces (Exercise, Measure, Beat, etc.)
│   ├── utils/              # resolveTempoMap, resolveMeasureLabels, resolvePlaybackTimeline, subdivision defaults
│   ├── audio/              # Web Audio API click generation and scheduling
│   ├── storage/            # localStorage helpers, URL serialization
│   ├── App.tsx
│   ├── App.css
│   └── main.tsx
├── tests/                  # Mirrors src/ structure
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── CLAUDE.md
├── PRD.md
├── LICENSE                 # AGPL-3.0
└── README.md
```

---

## Future Considerations

### To Be Considered In the Future

- Linear and quadratic tempo curves for rallentandos (use hold/fermata as workaround in meantime)
- Keyboard shortcuts for common editing operations
- Undo/redo
- Research how low-vision users interact with metronomes and what adaptations would actually be helpful

### Not Currently Considered In Scope

- MIDI output
- Import from MusicXML or similar formats
- Export click track as audio file
- Multiple voices / layered click patterns
- Any display of music besides generic big beats
- Repeats, D.S./D.C./anything besides linear flow
