import { useState, useEffect } from 'react';
import type { ResolvedMeasure } from '../../models/ResolvedMeasure';
import { toDisplayTempo } from '../../utils/tempoConversion';
import { BeatLabel } from '../ScoreEditor/BeatLabel';
import type { SoundConfig, SoundType } from '../../models/SoundConfig';

interface MetronomeProps {
  resolvedMeasures: ResolvedMeasure[];
  startMeasureIndex: number;
  onStartMeasureChange: (index: number) => void;
  endMeasureIndex: number | null;
  onEndMeasureChange: (index: number | null) => void;
  loop: boolean;
  onLoopChange: (loop: boolean) => void;
  isPlaying: boolean;
  onToggle: () => void;
  hasInvalidMeasure: boolean;
  percentage: number;
  onPercentageChange: (pct: number) => void;
  prepBeats: number;
  onPrepBeatsChange: (n: number) => void;
  soundConfig: SoundConfig;
  onSoundConfigChange: (cfg: SoundConfig) => void;
  subdivisionLevel: 'off' | 'eighths' | 'sixteenths';
  onSubdivisionLevelChange: (level: 'off' | 'eighths' | 'sixteenths') => void;
}

export function Metronome({
  resolvedMeasures,
  startMeasureIndex,
  onStartMeasureChange,
  endMeasureIndex,
  onEndMeasureChange,
  loop,
  onLoopChange,
  isPlaying,
  onToggle,
  hasInvalidMeasure,
  percentage,
  onPercentageChange,
  prepBeats,
  onPrepBeatsChange,
  soundConfig,
  onSoundConfigChange,
  subdivisionLevel,
  onSubdivisionLevelChange,
}: MetronomeProps) {
  const startMeasure = resolvedMeasures[startMeasureIndex];
  const denominator = startMeasure?.source.meter[1] ?? 4;
  const firstSubdivision = startMeasure?.source.beats[0]?.subdivisions ?? 1;
  const internalTempo = startMeasure?.tempo ?? 80;
  const scoreTempo = toDisplayTempo(internalTempo, denominator, firstSubdivision);

  const effectiveTempo = Math.round(scoreTempo * percentage / 100);

  const [pctInputStr, setPctInputStr] = useState(String(percentage));
  const [effectiveInputStr, setEffectiveInputStr] = useState(String(effectiveTempo));

  // Sync inputs when score tempo, percentage, or start measure changes
  useEffect(() => {
    setPctInputStr(String(percentage));
    setEffectiveInputStr(String(Math.round(scoreTempo * percentage / 100)));
  }, [percentage, scoreTempo]);

  function commitPercentage() {
    const parsed = parseInt(pctInputStr, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(10, Math.min(200, parsed));
      onPercentageChange(clamped);
    } else {
      setPctInputStr(String(percentage));
    }
  }

  function commitEffective() {
    const parsed = parseInt(effectiveInputStr, 10);
    if (!isNaN(parsed) && parsed >= 1 && scoreTempo > 0) {
      const newPct = Math.round((parsed / scoreTempo) * 100);
      const clamped = Math.max(10, Math.min(200, newPct));
      onPercentageChange(clamped);
    } else {
      setEffectiveInputStr(String(effectiveTempo));
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
        <label htmlFor="end-measure">Stop at:</label>{' '}
        <select
          id="end-measure"
          value={endMeasureIndex ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            onEndMeasureChange(val === '' ? null : Number(val));
          }}
          disabled={isPlaying}
        >
          <option value="">End</option>
          {resolvedMeasures.map((rm) => (
            <option key={rm.index} value={rm.index}>
              m. {rm.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="loop-toggle">Loop:</label>{' '}
        <input
          id="loop-toggle"
          type="checkbox"
          checked={loop}
          onChange={(e) => onLoopChange(e.target.checked)}
          disabled={isPlaying}
          aria-label="Loop"
        />
      </div>

      <div>
        <BeatLabel
          denominator={denominator}
          firstSubdivision={firstSubdivision}
          value={scoreTempo}
          isReadOnly
          ariaLabel="Score tempo"
        />
      </div>

      <div>
        <label htmlFor="percentage-input">Speed:</label>{' '}
        <input
          id="percentage-input"
          type="number"
          min={10}
          max={200}
          value={pctInputStr}
          onChange={(e) => setPctInputStr(e.target.value)}
          onBlur={commitPercentage}
          onKeyDown={(e) => { if (e.key === 'Enter') commitPercentage(); }}
          aria-label="Speed percentage"
        />%
      </div>

      <div>
        <BeatLabel
          denominator={denominator}
          firstSubdivision={firstSubdivision}
          value={effectiveInputStr}
          id="effective-tempo-input"
          ariaLabel="Effective tempo"
          min={1}
          max={999}
          onChange={(val) => setEffectiveInputStr(val)}
          onBlur={commitEffective}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEffective(); }}
        />
      </div>

      <div>
        <label htmlFor="prep-beats-input">Prep beats:</label>{' '}
        <input
          id="prep-beats-input"
          type="number"
          min={0}
          max={16}
          value={prepBeats}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) onPrepBeatsChange(Math.max(0, Math.min(16, val)));
          }}
          disabled={isPlaying}
          aria-label="Prep beats"
        />
      </div>

      {(['downbeat', 'bigBeat', 'subdivision'] as const).map((role) => (
        <div key={role}>
          <label htmlFor={`sound-${role}`}>
            {role === 'downbeat' ? 'Downbeat:' : role === 'bigBeat' ? 'Big beat:' : 'Subdivision:'}
          </label>{' '}
          <select
            id={`sound-${role}`}
            value={soundConfig[role]}
            onChange={(e) =>
              onSoundConfigChange({ ...soundConfig, [role]: e.target.value as SoundType })
            }
            aria-label={`${role} sound`}
          >
            <option value="emphasis">Emphasis</option>
            <option value="standard">Standard</option>
            <option value="click">Click</option>
            <option value="none">None</option>
          </select>
        </div>
      ))}

      <div>
        <label htmlFor="subdivision-level">Subdivisions:</label>{' '}
        <select
          id="subdivision-level"
          value={subdivisionLevel}
          onChange={(e) =>
            onSubdivisionLevelChange(e.target.value as 'off' | 'eighths' | 'sixteenths')
          }
          aria-label="Subdivision level"
        >
          <option value="off">Off</option>
          <option value="eighths">Eighths</option>
          <option value="sixteenths">Sixteenths</option>
        </select>
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
