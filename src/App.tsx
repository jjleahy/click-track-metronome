import { useState, useEffect, useMemo } from 'react';
import type { Exercise, Measure } from './models/Exercise';
import { useMetronome } from './hooks/useMetronome';
import { resolveExercise } from './utils/resolveExercise';
import { defaultBeats } from './utils/subdivisionDefaults';
import { isMeasureValid } from './utils/subdivisionValidation';
import { ScoreEditor } from './components/ScoreEditor/ScoreEditor';
import { Metronome } from './components/Metronome/Metronome';
import { DEFAULT_SOUND_CONFIG } from './models/SoundConfig';
import type { SoundConfig } from './models/SoundConfig';
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
  const [endMeasureIndex, setEndMeasureIndex] = useState<number | null>(null);
  const [loop, setLoop] = useState(false);
  const [percentage, setPercentage] = useState(100);
  const [prepBeats, setPrepBeats] = useState(4);
  const [soundConfig, setSoundConfig] = useState<SoundConfig>(DEFAULT_SOUND_CONFIG);
  const [subdivisionLevel, setSubdivisionLevel] = useState<'off' | 'eighths' | 'sixteenths'>('off');

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

  // Clamp endMeasureIndex when measures are deleted or start moves past it
  useEffect(() => {
    if (endMeasureIndex === null) return;
    const lastIndex = exercise.measures.length - 1;
    const clamped = Math.min(endMeasureIndex, lastIndex);
    const ensureAfterStart = Math.max(clamped, startMeasureIndex);
    if (ensureAfterStart !== endMeasureIndex) {
      setEndMeasureIndex(ensureAfterStart > lastIndex ? null : ensureAfterStart);
    }
  }, [exercise.measures.length, startMeasureIndex, endMeasureIndex]);

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

  const { isPlaying, currentMeasure, currentBeat, toggle } = useMetronome({
    resolvedMeasures,
    startMeasureIndex,
    endMeasureIndex,
    percentage,
    loop,
    prepBeats,
    soundConfig,
    subdivisionLevel,
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
          percentage={percentage}
          startMeasureIndex={startMeasureIndex}
          onUpdateMeasure={handleUpdateMeasure}
          onDeleteMeasure={handleDeleteMeasure}
          onInsertAfter={handleInsertAfter}
          onAddMeasure={handleAddMeasure}
          loop={loop}
        />

        <Metronome
          resolvedMeasures={resolvedMeasures}
          startMeasureIndex={startMeasureIndex}
          onStartMeasureChange={setStartMeasureIndex}
          endMeasureIndex={endMeasureIndex}
          onEndMeasureChange={setEndMeasureIndex}
          loop={loop}
          onLoopChange={setLoop}
          isPlaying={isPlaying}
          onToggle={toggle}
          hasInvalidMeasure={hasInvalidMeasure}
          percentage={percentage}
          onPercentageChange={setPercentage}
          prepBeats={prepBeats}
          onPrepBeatsChange={setPrepBeats}
          soundConfig={soundConfig}
          onSoundConfigChange={setSoundConfig}
          subdivisionLevel={subdivisionLevel}
          onSubdivisionLevelChange={setSubdivisionLevel}
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
