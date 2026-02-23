// TODO (Stage 2+): Replace this entire file with a proper component tree.
// Real components live in:
//   src/components/ScoreEditor/  — staff display, measure/beat editing, tempo controls
//   src/components/Metronome/    — playback controls, linked tempo/percentage inputs
// App.tsx will become a thin shell that composes those components and owns top-level state.

import { useState } from 'react';
import type { Exercise } from './models/Exercise';
import { useMetronome } from './hooks/useMetronome';
import './App.css';

// TODO (Stage 2+): Replace hard-coded state with editable exercise state and localStorage persistence.
const INITIAL_EXERCISE: Exercise = {
  id: 'stage-1-default',
  name: 'Default Exercise',
  measures: [
    { meter: [4, 4], beats: [{subdivisions:1,hold:null},{subdivisions:1,hold:null},{subdivisions:1,hold:null},{subdivisions:1,hold:null}], tempo: 80, rehearsalNumber: null, gradualTempo: null },
    { meter: [4, 4], beats: [{subdivisions:1,hold:null},{subdivisions:1,hold:null},{subdivisions:1,hold:null},{subdivisions:1,hold:null}], tempo: null, rehearsalNumber: null, gradualTempo: null },
    { meter: [4, 4], beats: [{subdivisions:1,hold:null},{subdivisions:1,hold:null},{subdivisions:1,hold:null},{subdivisions:1,hold:null}], tempo: null, rehearsalNumber: null, gradualTempo: null },
    { meter: [4, 4], beats: [{subdivisions:1,hold:null},{subdivisions:1,hold:null},{subdivisions:1,hold:null},{subdivisions:1,hold:null}], tempo: null, rehearsalNumber: null, gradualTempo: null },
  ],
};

export default function App() {
  const [exercise] = useState<Exercise>(INITIAL_EXERCISE);
  const [startMeasureIndex] = useState(0);
  const [percentage] = useState(100);

  // TODO (Stage 2+): wire startMeasureIndex, percentage, and endMeasureIndex to editable inputs
  const { isPlaying, currentMeasure, currentBeat, toggle } = useMetronome({
    measures: exercise.measures,
    startMeasureIndex,
    percentage,
    loop: true,
  });

  return (
    <div className="app">
      <header className="app-header">
        {/* TODO (Stage 3): Replace with proper app chrome / exercise name display */}
        <h1>Click Track Metronome</h1>
      </header>

      <main className="app-main">
        {/* TODO (Stage 2+): Replace with <ScoreEditor> component */}
        <section className="score-placeholder">
          <p className="stage-label">Stage 1 — Working Metronome (placeholder UI)</p>
          <div className="measure-grid">
            {exercise.measures.map((m, mi) => (
              <div
                key={mi}
                className={`measure-cell ${currentMeasure === mi ? 'active' : ''}`}
              >
                <div className="measure-number">m. {mi + 1}</div>
                <div className="meter">{m.meter[0]}/{m.meter[1]}</div>
                <div className="beats">
                  {m.beats.map((_, bi) => (
                    <span
                      key={bi}
                      className={`beat-dot ${currentMeasure === mi && currentBeat === bi ? 'beat-active' : ''}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* TODO (Stage 2+): Replace with <Metronome> component with linked tempo/percentage/startMeasure inputs */}
        <section className="metronome-panel">
          <div className="tempo-display">
            ♩ = {exercise.measures[0].tempo ?? 80} &nbsp;|&nbsp; {percentage}%
          </div>
          <button
            className={`play-button ${isPlaying ? 'playing' : ''}`}
            onClick={toggle}
            aria-label={isPlaying ? 'Stop metronome' : 'Start metronome'}
          >
            {isPlaying ? '■ Stop' : '▶ Start'}
          </button>
        </section>
      </main>

      <footer className="app-footer">
        <a
          href="https://github.com/jjleahy/click-track-metronome"
          target="_blank"
          rel="noopener noreferrer"
        >
          Fork me on GitHub
        </a>
      </footer>
    </div>
  );
}
