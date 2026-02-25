import { useState, useEffect } from 'react';
import type { ResolvedMeasure } from '../../models/ResolvedMeasure';

interface MetronomeProps {
  resolvedMeasures: ResolvedMeasure[];
  startMeasureIndex: number;
  onStartMeasureChange: (index: number) => void;
  isPlaying: boolean;
  onToggle: () => void;
  hasInvalidMeasure: boolean;
  onSetMeasureTempo: (index: number, tempo: number | null) => void;
}

export function Metronome({
  resolvedMeasures,
  startMeasureIndex,
  onStartMeasureChange,
  isPlaying,
  onToggle,
  hasInvalidMeasure,
  onSetMeasureTempo,
}: MetronomeProps) {
  const resolvedTempo = resolvedMeasures[startMeasureIndex]?.tempo ?? 80;
  const [tempoInputStr, setTempoInputStr] = useState(String(resolvedTempo));

  // Sync tempo display when starting measure or its tempo changes
  useEffect(() => {
    setTempoInputStr(String(resolvedTempo));
  }, [resolvedTempo]);

  function commitTempo() {
    const parsed = parseInt(tempoInputStr, 10);
    if (!isNaN(parsed) && parsed >= 20 && parsed <= 300) {
      onSetMeasureTempo(startMeasureIndex, parsed);
    } else {
      setTempoInputStr(String(resolvedTempo));
    }
  }

  return (
    <section className="metronome-panel" aria-label="Playback controls">
      <div>
        <label htmlFor="start-measure">Start at:</label>{' '}
        <select
          id="start-measure"
          value={startMeasureIndex}
          onChange={(e) => onStartMeasureChange(Number(e.target.value))}
          disabled={isPlaying}
        >
          {resolvedMeasures.map((rm) => (
            <option key={rm.index} value={rm.index}>
              m. {rm.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="tempo-input">♩ =</label>{' '}
        <input
          id="tempo-input"
          type="number"
          min={20}
          max={300}
          value={tempoInputStr}
          onChange={(e) => setTempoInputStr(e.target.value)}
          onBlur={commitTempo}
          onKeyDown={(e) => { if (e.key === 'Enter') commitTempo(); }}
          aria-label="Tempo"
        />
      </div>

      <button
        className={`play-button ${isPlaying ? 'playing' : ''}`}
        onClick={onToggle}
        disabled={hasInvalidMeasure}
        aria-label={isPlaying ? 'Stop metronome' : 'Start metronome'}
        title={hasInvalidMeasure ? 'Fix invalid measures before playing' : undefined}
      >
        {isPlaying ? '■ Stop' : '▶ Start'}
      </button>
    </section>
  );
}
