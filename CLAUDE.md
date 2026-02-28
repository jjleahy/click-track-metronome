# Click Track Metronome

A web app for musicians to map complex rhythmic structures — time signature changes, tempo changes, accelerandi/ritardandi, and fermatas — and play them back with a click track that follows the score.

## Stack

- React + TypeScript, Vite
- Vitest + React Testing Library
- Bravura font for music notation glyphs (SMuFL)
- AGPL-3.0

## Conventions

- Vite dev server: `npm run dev`
- Run tests: `npm test`
- Build: `npm run build` (outputs to `dist/`)
- ESLint for code style; no extra Prettier config beyond defaults
- Use standard React patterns: functional components, hooks, immutable state updates
- Keep resolver/helper functions pure and well-tested (they are the core logic)
- Task branches → PR to `develop` → GitHub Actions deploys on merge to `develop`

## Key Directories

- `src/utils/` — pure functions: tempo map, measure labels, playback timeline, subdivision defaults
- `src/audio/` — Web Audio API scheduling (keep decoupled from React rendering)
- `src/components/ScoreEditor/` — staff display and all editing UI
- `src/components/Metronome/` — playback controls
- `src/models/` — TypeScript interfaces for the data model (Exercise, Measure, Beat, GradualTempo)

## Subdivision Defaults

Default beat groupings by time signature (see `src/utils/subdivisionDefaults.ts`):

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

For unusual meters not in the defaults, a sensible default is inferred. Users can always override.

## Measure Label Resolution

Labels are resolved left to right:
1. If the measure has an explicit `rehearsalNumber`, display it.
2. Otherwise, look backwards for the nearest numerically resolved label. This measure's implied label is that value + 1.
3. If no prior numerical value is found, the implied label is `1`.

This handles split measures (80, 80a, 81), skipped numbers, and non-numeric labels (roman numerals, letters) that don't participate in auto-numbering.

## Future Considerations

### To Be Considered
- Linear and quadratic tempo curves for rallentandos
- Keyboard shortcuts for common editing operations
- Undo/redo
- Accessibility research for low-vision users

### Not In Scope
- MIDI output
- Import from MusicXML or similar formats
- Export click track as audio file
- Multiple voices / layered click patterns
- Display of music beyond generic big beats
- Repeats, D.S./D.C./anything besides linear flow
