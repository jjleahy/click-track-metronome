import { useState, useEffect } from 'react';
import type { Measure } from '../../models/Exercise';
import { defaultBeats } from '../../utils/subdivisionDefaults';
import { isMeasureValid, applySubdivisionChange } from '../../utils/subdivisionValidation';

interface MeasureCardProps {
  measure: Measure;
  resolvedLabel: string | number;
  resolvedTempo: number;
  isActive: boolean;
  canDelete: boolean;
  onChange: (updated: Measure) => void;
  onDelete: () => void;
  onInsertAfter: () => void;
}

export function MeasureCard({
  measure,
  resolvedLabel,
  resolvedTempo,
  isActive,
  canDelete,
  onChange,
  onDelete,
  onInsertAfter,
}: MeasureCardProps) {
  const [tempoInputStr, setTempoInputStr] = useState(
    measure.tempo !== null ? String(measure.tempo) : ''
  );

  // Sync tempo input when the resolved value changes externally
  useEffect(() => {
    setTempoInputStr(measure.tempo !== null ? String(measure.tempo) : '');
  }, [measure.tempo]);

  const isValid = isMeasureValid(measure.beats, measure.meter[0]);

  function commitTempo() {
    if (tempoInputStr === '') {
      onChange({ ...measure, tempo: null });
    } else {
      const parsed = parseInt(tempoInputStr, 10);
      if (!isNaN(parsed) && parsed >= 20 && parsed <= 300) {
        onChange({ ...measure, tempo: parsed });
      } else {
        // Revert to current measure tempo
        setTempoInputStr(measure.tempo !== null ? String(measure.tempo) : '');
      }
    }
  }

  function handleNumeratorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newNum = parseInt(e.target.value, 10);
    if (isNaN(newNum) || newNum < 1) return;
    onChange({
      ...measure,
      meter: [newNum, measure.meter[1]],
      beats: defaultBeats(newNum, measure.meter[1]),
    });
  }

  function handleDenominatorChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newDenom = parseInt(e.target.value, 10);
    onChange({
      ...measure,
      meter: [measure.meter[0], newDenom],
      beats: defaultBeats(measure.meter[0], newDenom),
    });
  }

  function handleSubdivisionChange(beatIndex: number, rawValue: string) {
    const parsed = parseInt(rawValue, 10);
    const newValue = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    const newBeats = applySubdivisionChange(measure.beats, beatIndex, newValue, measure.meter[0]);
    onChange({ ...measure, beats: newBeats });
  }

  const cardClass = [
    'measure-card',
    isActive ? 'measure-card--active' : '',
    isValid ? '' : 'measure-card--invalid',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClass}>
      {/* Row 1: Tempo */}
      <div>
        <label htmlFor={`tempo-${resolvedLabel}`}>♩ =</label>{' '}
        <input
          id={`tempo-${resolvedLabel}`}
          type="number"
          min={20}
          max={300}
          placeholder={String(resolvedTempo)}
          value={tempoInputStr}
          onChange={(e) => setTempoInputStr(e.target.value)}
          onBlur={commitTempo}
          onKeyDown={(e) => { if (e.key === 'Enter') commitTempo(); }}
          aria-label="Tempo"
        />
      </div>

      {/* Row 2: Label + controls */}
      <div>
        <span>m. {resolvedLabel}</span>{' '}
        <button
          onClick={onDelete}
          disabled={!canDelete}
          aria-label="Delete measure"
        >
          X
        </button>{' '}
        <button onClick={onInsertAfter} aria-label="Insert measure after">
          +
        </button>
      </div>

      {/* Row 3: Numerator */}
      <div>
        <label htmlFor={`num-${resolvedLabel}`}>Beats:</label>{' '}
        <input
          id={`num-${resolvedLabel}`}
          type="number"
          min={1}
          max={32}
          value={measure.meter[0]}
          onChange={handleNumeratorChange}
          aria-label="Time signature numerator"
        />
      </div>

      {/* Row 4: Denominator */}
      <div>
        <label htmlFor={`denom-${resolvedLabel}`}>Note:</label>{' '}
        <select
          id={`denom-${resolvedLabel}`}
          value={measure.meter[1]}
          onChange={handleDenominatorChange}
          aria-label="Time signature denominator"
        >
          <option value={2}>2</option>
          <option value={4}>4</option>
          <option value={8}>8</option>
          <option value={16}>16</option>
        </select>
      </div>

      {/* Row 5: Subdivision inputs */}
      <div className="subdivision-inputs">
        {measure.beats.map((beat, bi) => (
          <input
            key={bi}
            type="number"
            min={1}
            max={measure.meter[0]}
            value={beat.subdivisions}
            onChange={(e) => handleSubdivisionChange(bi, e.target.value)}
            aria-label={`Beat ${bi + 1} subdivisions`}
          />
        ))}
      </div>
    </div>
  );
}
