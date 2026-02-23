# Click Track Metronome

Read [PRD.md](PRD.md) for the full product specification and development plan.

## Stack

- React + TypeScript, Vite, Cloudflare Pages
- Vitest + React Testing Library
- Bravura font for music notation glyphs

## Conventions

- Vite dev server: `npm run dev`
- Run tests: `npm test`
- Build: `npm run build` (outputs to `dist/`)
- ESLint for code style; no extra Prettier config beyond defaults
- Use standard React patterns: functional components, hooks, immutable state updates
- Keep resolver/helper functions pure and well-tested (they are the core logic)
- PRD stages are the implementation roadmap — follow them in order

## Key Directories

- `src/utils/` — pure functions: tempo map, measure labels, playback timeline, subdivision defaults
- `src/audio/` — Web Audio API scheduling (keep decoupled from React rendering)
- `src/components/ScoreEditor/` — staff display and all editing UI
- `src/components/Metronome/` — playback controls
- `src/models/` — TypeScript interfaces for the data model
