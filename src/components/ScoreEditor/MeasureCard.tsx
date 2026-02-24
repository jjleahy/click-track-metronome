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

// Returns the duration of the first big beat as a fraction of a whole note.
// e.g. denominator=8, firstSubdivision=3 → 3/8
function firstBeatDuration(denominator: number, firstSubdivision: number): number {
  return firstSubdivision / denominator;
}

// Converts internal quarter-note tempo to display tempo for the first beat.
// displayTempo = internalTempo * (1/4) / firstBeatDur
function toDisplayTempo(internalTempo: number, denominator: number, firstSubdivision: number): number {
  const beatDur = firstBeatDuration(denominator, firstSubdivision);
  return Math.round(internalTempo * 0.25 / beatDur);
}

// Converts display tempo back to internal quarter-note tempo (round half up).
function toInternalTempo(displayTempo: number, denominator: number, firstSubdivision: number): number {
  const beatDur = firstBeatDuration(denominator, firstSubdivision);
  const raw = displayTempo * beatDur / 0.25;
  return Math.floor(raw + 0.5);
}

// Builds a text label like "q = ", "e• = ", "h = " for the first beat.
function beatLabel(denominator: number, firstSubdivision: number): string {
  // Duration of first beat relative to a whole note
  const beatDur = firstBeatDuration(denominator, firstSubdivision);
  // Map common durations to symbols
  const map: [number, string][] = [
    [1 / 2, 'h'],
    [3 / 8, 'q•'],
    [1 / 4, 'q'],
    [3 / 16, 'e•'],
    [1 / 8, 'e'],
  ];
  for (const [dur, label] of map) {
    if (Math.abs(beatDur - dur) < 1e-9) return label + ' = ';
  }
  // Fallback: show as fraction
  return `${firstSubdivision}/${denominator} = `;
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
  const denominator = measure.meter[1];
  const firstSubdivision = measure.beats.length > 0 ? measure.beats[0].subdivisions : 1;

  const displayResolvedTempo = toDisplayTempo(resolvedTempo, denominator, firstSubdivision);

  const [tempoInputStr, setTempoInputStr] = useState(
    measure.tempo !== null ? String(toDisplayTempo(measure.tempo, denominator, firstSubdivision)) : ''
  );

  // Sync tempo input when the measure changes externally
  useEffect(() => {
    setTempoInputStr(
      measure.tempo !== null
        ? String(toDisplayTempo(measure.tempo, denominator, firstSubdivision))
        : ''
    );
  }, [measure.tempo, denominator, firstSubdivision]);

  const [labelInputStr, setLabelInputStr] = useState(
    measure.rehearsalNumber !== null ? String(measure.rehearsalNumber) : ''
  );

  // Sync label input when the measure changes externally
  useEffect(() => {
    setLabelInputStr(
      measure.rehearsalNumber !== null ? String(measure.rehearsalNumber) : ''
    );
  }, [measure.rehearsalNumber]);

  function commitLabel() {
    const trimmed = labelInputStr.trim();
    if (trimmed === '') {
      onChange({ ...measure, rehearsalNumber: null });
    } else {
      const asNum = Number(trimmed);
      const resolved: string | number = Number.isInteger(asNum) && String(asNum) === trimmed ? asNum : trimmed;
      onChange({ ...measure, rehearsalNumber: resolved });
    }
  }

  const isValid = isMeasureValid(measure.beats, measure.meter[0]);

  function commitTempo() {
    if (tempoInputStr === '') {
      onChange({ ...measure, tempo: null });
    } else {
      const parsedDisplay = parseInt(tempoInputStr, 10);
      if (!isNaN(parsedDisplay) && parsedDisplay >= 1) {
        const internal = toInternalTempo(parsedDisplay, denominator, firstSubdivision);
        if (internal >= 20 && internal <= 300) {
          onChange({ ...measure, tempo: internal });
        } else {
          // Revert to current display value
          setTempoInputStr(
            measure.tempo !== null
              ? String(toDisplayTempo(measure.tempo, denominator, firstSubdivision))
              : ''
          );
        }
      } else {
        setTempoInputStr(
          measure.tempo !== null
            ? String(toDisplayTempo(measure.tempo, denominator, firstSubdivision))
            : ''
        );
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
        <label htmlFor={`tempo-${resolvedLabel}`}>{beatLabel(denominator, firstSubdivision)}</label>{' '}
        <input
          id={`tempo-${resolvedLabel}`}
          type="number"
          min={1}
          max={999}
          placeholder={String(displayResolvedTempo)}
          value={tempoInputStr}
          onChange={(e) => setTempoInputStr(e.target.value)}
          onBlur={commitTempo}
          onKeyDown={(e) => { if (e.key === 'Enter') commitTempo(); }}
          aria-label="Tempo"
        />
      </div>

      {/* Row 2: Label + controls */}
      <div>
        <label htmlFor={`label-${resolvedLabel}`}>m.</label>{' '}
        <input
          id={`label-${resolvedLabel}`}
          type="text"
          placeholder={String(resolvedLabel)}
          value={labelInputStr}
          onChange={(e) => setLabelInputStr(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => { if (e.key === 'Enter') commitLabel(); }}
          aria-label="Measure label"
        />{' '}
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
