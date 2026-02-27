import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Exercise, Measure } from './models/Exercise';
import { useMetronome } from './hooks/useMetronome';
import { resolveExercise, computeLandingTargets } from './utils/resolveExercise';
import { defaultBeats } from './utils/subdivisionDefaults';
import { isMeasureValid } from './utils/subdivisionValidation';
import { ScoreEditor } from './components/ScoreEditor/ScoreEditor';
import { Metronome } from './components/Metronome/Metronome';
import { ExerciseTabs } from './components/ExerciseTabs';
import { ImportDialog } from './components/ImportDialog';
import type { ImportAction } from './components/ImportDialog';
import { DEFAULT_SOUND_CONFIG } from './models/SoundConfig';
import type { SoundConfig } from './models/SoundConfig';
import {
  loadAllExercises, saveExercise, saveExerciseList, saveActiveId,
  loadActiveId, deleteExercise as deleteExerciseFromStorage,
} from './utils/storage';
import { compressExercise, decompressExercise } from './utils/sharing';
import './App.css';

function createDefaultExercise(): Exercise {
  return {
    id: crypto.randomUUID(),
    name: 'New Exercise',
    measures: [
      { meter: [4, 4] as [number, number], beats: defaultBeats(4, 4), tempo: 80, rehearsalNumber: null, gradualTempo: null },
      { meter: [4, 4] as [number, number], beats: defaultBeats(4, 4), tempo: null, rehearsalNumber: null, gradualTempo: null },
      { meter: [4, 4] as [number, number], beats: defaultBeats(4, 4), tempo: null, rehearsalNumber: null, gradualTempo: null },
      { meter: [4, 4] as [number, number], beats: defaultBeats(4, 4), tempo: null, rehearsalNumber: null, gradualTempo: null },
    ],
  };
}

export default function App() {
  const [exercises, setExercises] = useState<Exercise[]>(() => {
    const loaded = loadAllExercises();
    if (loaded.length > 0) return loaded;
    return [createDefaultExercise()];
  });

  const [activeExerciseId, setActiveExerciseId] = useState<string>(() => {
    const saved = loadActiveId();
    return saved ?? '';
  });

  // Ensure activeExerciseId always points to a valid exercise
  const exercise = useMemo(() => {
    return exercises.find((e) => e.id === activeExerciseId) ?? exercises[0];
  }, [exercises, activeExerciseId]);

  // Fix activeExerciseId if it doesn't match any exercise
  useEffect(() => {
    if (exercise && exercise.id !== activeExerciseId) {
      setActiveExerciseId(exercise.id);
    }
  }, [exercise, activeExerciseId]);

  // Auto-save exercises to localStorage
  useEffect(() => {
    saveExerciseList(exercises.map((e) => e.id));
    for (const ex of exercises) {
      saveExercise(ex);
    }
  }, [exercises]);

  // Auto-save active exercise ID
  useEffect(() => {
    saveActiveId(activeExerciseId);
  }, [activeExerciseId]);

  // --- Import from share URL ---
  const [importAction, setImportAction] = useState<ImportAction | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get('share');
    if (!shareParam) return;

    // Clear the URL param without reload
    const url = new URL(window.location.href);
    url.searchParams.delete('share');
    window.history.replaceState({}, '', url.toString());

    decompressExercise(shareParam).then((imported) => {
      // Use functional access to get current exercises (closure has initial value)
      setExercises((currentExercises) => {
        const existing = currentExercises.find((e) => e.id === imported.id);
        if (existing) {
          if (JSON.stringify(existing.measures) === JSON.stringify(imported.measures)
              && existing.name === imported.name) {
            // Identical — do nothing
            return currentExercises;
          }
          // Different content — ask to replace
          setImportAction({ type: 'replace', exercise: imported, existingName: existing.name });
        } else {
          // New — ask to import
          setImportAction({ type: 'new', exercise: imported });
        }
        return currentExercises;
      });
    }).catch((err) => {
      console.error('Failed to decode shared exercise', err);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleImportConfirm() {
    if (!importAction) return;
    const imported = importAction.exercise;
    if (importAction.type === 'replace') {
      setExercises((prev) =>
        prev.map((ex) => (ex.id === imported.id ? imported : ex))
      );
    } else {
      setExercises((prev) => [...prev, imported]);
    }
    setActiveExerciseId(imported.id);
    setImportAction(null);
  }

  function handleImportDecline() {
    setImportAction(null);
  }

  // --- Playback state (global, not per-exercise) ---
  const [startMeasureIndex, setStartMeasureIndex] = useState(0);
  const [endMeasureIndex, setEndMeasureIndex] = useState<number | null>(null);
  const [loop, setLoop] = useState(false);
  const [percentage, setPercentage] = useState(100);
  const [prepBeats, setPrepBeats] = useState(4);
  const [soundConfig, setSoundConfig] = useState<SoundConfig>(DEFAULT_SOUND_CONFIG);
  const [subdivisionLevel, setSubdivisionLevel] = useState<'off' | 'eighths' | 'sixteenths'>('off');
  const [pendingAccelStart, setPendingAccelStart] = useState<number | null>(null);

  // Reset playback-range state when switching exercises
  useEffect(() => {
    setStartMeasureIndex(0);
    setEndMeasureIndex(null);
    setPendingAccelStart(null);
  }, [activeExerciseId]);

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

  // --- Exercise mutation helpers ---

  const updateActiveExercise = useCallback((updater: (prev: Exercise) => Exercise) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === activeExerciseId ? updater(ex) : ex))
    );
  }, [activeExerciseId]);

  function setMeasures(newMeasures: Measure[]) {
    updateActiveExercise((prev) => ({ ...prev, measures: newMeasures }));
  }

  function handleUpdateMeasure(index: number, updated: Measure) {
    let newMeasures = exercise.measures.map((m, i) => (i === index ? updated : m));

    if (updated.tempo !== null) {
      const rm = resolvedMeasures[index];
      const zone = rm?.accelRitStarting ?? rm?.accelRitEnding;
      if (zone && zone.type === 'through') {
        newMeasures = newMeasures.map((m, i) =>
          i === zone.sourceIndex ? { ...m, gradualTempo: null } : m
        );
      }
    }

    setMeasures(newMeasures);
  }

  function clearSpanIfAffected(measures: Measure[], resolvedAtIndex: number): Measure[] {
    const rm = resolvedMeasures[resolvedAtIndex];
    if (!rm) return measures;
    const zone = rm.accelRitEnding ?? rm.accelRitStarting;
    if (!zone) return measures;
    return measures.map((m, i) =>
      i === zone.sourceIndex ? { ...m, gradualTempo: null } : m
    );
  }

  function handleDeleteMeasure(index: number) {
    const cleared = clearSpanIfAffected(exercise.measures, index);
    setMeasures(cleared.filter((_, i) => i !== index));
    if (pendingAccelStart !== null && (pendingAccelStart === index || pendingAccelStart >= cleared.length - 1)) {
      setPendingAccelStart(null);
    }
  }

  function handleInsertAfter(index: number) {
    const cleared = clearSpanIfAffected(exercise.measures, index + 1 < resolvedMeasures.length ? index + 1 : index);
    const source = cleared[index];
    const newMeasure: Measure = {
      ...source,
      beats: source.beats.map((b) => ({ ...b })),
      gradualTempo: null,
    };
    setMeasures([
      ...cleared.slice(0, index + 1),
      newMeasure,
      ...cleared.slice(index + 1),
    ]);
  }

  function handleAddMeasure() {
    handleInsertAfter(exercise.measures.length - 1);
  }

  function handleAccelStart(measureIndex: number) {
    setPendingAccelStart(measureIndex);
  }

  function handleAccelLand(targetIndex: number, zone: 'starting' | 'ending') {
    if (pendingAccelStart === null) return;
    if (zone === 'starting' && targetIndex === pendingAccelStart) {
      handleUpdateMeasure(pendingAccelStart, {
        ...exercise.measures[pendingAccelStart],
        gradualTempo: { measureLength: 0, endTempo: null },
      });
    } else if (zone === 'ending') {
      handleUpdateMeasure(pendingAccelStart, {
        ...exercise.measures[pendingAccelStart],
        gradualTempo: { measureLength: targetIndex - pendingAccelStart, endTempo: null },
      });
    }
    setPendingAccelStart(null);
  }

  function handleAccelCancel() {
    setPendingAccelStart(null);
  }

  function handleAccelDelete(sourceIndex: number) {
    handleUpdateMeasure(sourceIndex, {
      ...exercise.measures[sourceIndex],
      gradualTempo: null,
    });
  }

  // --- Tab handlers ---

  function handleNewExercise() {
    const newEx = createDefaultExercise();
    setExercises((prev) => [...prev, newEx]);
    setActiveExerciseId(newEx.id);
  }

  function handleDeleteExercise(id: string) {
    if (exercises.length <= 1) return;
    const ex = exercises.find((e) => e.id === id);
    if (!ex) return;
    if (!confirm(`Delete exercise "${ex.name}"?`)) return;

    deleteExerciseFromStorage(id);
    const idx = exercises.findIndex((e) => e.id === id);
    setExercises((prev) => prev.filter((e) => e.id !== id));
    if (activeExerciseId === id) {
      const nextId = exercises[idx > 0 ? idx - 1 : 1].id;
      setActiveExerciseId(nextId);
    }
  }

  function handleDuplicateExercise(id: string) {
    const source = exercises.find((e) => e.id === id);
    if (!source) return;
    const copy: Exercise = {
      id: crypto.randomUUID(),
      name: `${source.name} (copy)`,
      measures: JSON.parse(JSON.stringify(source.measures)),
    };
    const idx = exercises.findIndex((e) => e.id === id);
    setExercises((prev) => [
      ...prev.slice(0, idx + 1),
      copy,
      ...prev.slice(idx + 1),
    ]);
    setActiveExerciseId(copy.id);
  }

  function handleRenameExercise(id: string, newName: string) {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, name: newName } : ex))
    );
  }

  async function handleShareExercise(id: string) {
    const ex = exercises.find((e) => e.id === id);
    if (!ex) return;
    try {
      const compressed = await compressExercise(ex);
      const url = new URL(window.location.href);
      url.searchParams.set('share', compressed);
      await navigator.clipboard.writeText(url.toString());
    } catch (err) {
      console.error('Failed to create share URL', err);
    }
  }

  // --- Derived ---

  const landingTargets = pendingAccelStart !== null
    ? computeLandingTargets(resolvedMeasures, pendingAccelStart)
    : null;

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
        <ExerciseTabs
          exercises={exercises}
          activeExerciseId={exercise.id}
          onSelect={setActiveExerciseId}
          onRename={handleRenameExercise}
          onDelete={handleDeleteExercise}
          onDuplicate={handleDuplicateExercise}
          onShare={handleShareExercise}
          onNew={handleNewExercise}
        />
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
          pendingAccelStart={pendingAccelStart}
          landingTargets={landingTargets}
          onAccelStart={handleAccelStart}
          onAccelLand={handleAccelLand}
          onAccelCancel={handleAccelCancel}
          onAccelDelete={handleAccelDelete}
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

      {importAction && (
        <ImportDialog
          action={importAction}
          onConfirm={handleImportConfirm}
          onDecline={handleImportDecline}
        />
      )}

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
