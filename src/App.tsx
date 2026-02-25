import { useState, useEffect, useMemo } from 'react';
import type { Exercise, Measure } from './models/Exercise';
import { useMetronome } from './hooks/useMetronome';
import { resolveExercise } from './utils/resolveExercise';
import { defaultBeats } from './utils/subdivisionDefaults';
import { isMeasureValid } from './utils/subdivisionValidation';
import { ScoreEditor } from './components/ScoreEditor/ScoreEditor';
import { Metronome } from './components/Metronome/Metronome';
import './App.css';

const INITIAL_EXERCISE: Exercise = {
  id: 'stage-2-default',
  name: 'Default Exercise',
  measures: [
    { meter: [4, 4], beats: defaultBeats(4, 4), tempo: 80, rehearsalNumber: null, gradualTempo: null },
    { meter: [4, 4], beats: defaultBeats(4, 4), tempo: null, rehearsalNumber: null, gradualTempo: null },
    { meter: [4, 4], beats: defaultBeats(4, 4), tempo: null, rehearsalNumber: null, gradualTempo: null },
    { meter: [4, 4], beats: defaultBeats(4, 4), tempo: null, rehearsalNumber: null, gradualTempo: null },
  ],
};

export default function App() {
  const [exercise, setExercise] = useState<Exercise>(INITIAL_EXERCISE);
  const [startMeasureIndex, setStartMeasureIndex] = useState(0);
  const percentage = 100;

  const resolvedMeasures = useMemo(
    () => resolveExercise(exercise.measures),
    [exercise.measures]
  );
  const hasInvalidMeasure = exercise.measures.some(
    (m) => !isMeasureValid(m.beats, m.meter[0])
  );

  // Clamp startMeasureIndex when measures are deleted
  useEffect(() => {
    if (startMeasureIndex >= exercise.measures.length) {
      setStartMeasureIndex(Math.max(0, exercise.measures.length - 1));
    }
  }, [exercise.measures.length, startMeasureIndex]);

  function setMeasures(newMeasures: Measure[]) {
    setExercise((prev) => ({ ...prev, measures: newMeasures }));
  }

  function handleUpdateMeasure(index: number, updated: Measure) {
    setMeasures(exercise.measures.map((m, i) => (i === index ? updated : m)));
  }

  function handleDeleteMeasure(index: number) {
    setMeasures(exercise.measures.filter((_, i) => i !== index));
  }

  function handleInsertAfter(index: number) {
    const source = exercise.measures[index];
    const newMeasure: Measure = {
      ...source,
      beats: source.beats.map((b) => ({ ...b })),
    };
    setMeasures([
      ...exercise.measures.slice(0, index + 1),
      newMeasure,
      ...exercise.measures.slice(index + 1),
    ]);
  }

  function handleAddMeasure() {
    handleInsertAfter(exercise.measures.length - 1);
  }

  function handleSetMeasureTempo(index: number, tempo: number | null) {
    handleUpdateMeasure(index, { ...exercise.measures[index], tempo });
  }

  const { isPlaying, currentMeasure, currentBeat, toggle } = useMetronome({
    resolvedMeasures,
    startMeasureIndex,
    percentage,
    loop: false,
  });

  return (
    <div className="app">
      <header className="app-header">
        <h1>Click Track Metronome</h1>
      </header>

      <main className="app-main">
        <ScoreEditor
          resolvedMeasures={resolvedMeasures}
          isPlaying={isPlaying}
          currentMeasure={currentMeasure}
          currentBeat={currentBeat}
          onUpdateMeasure={handleUpdateMeasure}
          onDeleteMeasure={handleDeleteMeasure}
          onInsertAfter={handleInsertAfter}
          onAddMeasure={handleAddMeasure}
        />

        <Metronome
          resolvedMeasures={resolvedMeasures}
          startMeasureIndex={startMeasureIndex}
          onStartMeasureChange={setStartMeasureIndex}
          isPlaying={isPlaying}
          onToggle={toggle}
          hasInvalidMeasure={hasInvalidMeasure}
          onSetMeasureTempo={handleSetMeasureTempo}
        />
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
