import { useState, useEffect } from 'react';
import type { Measure as MeasureData } from '../../models/Exercise';
import { defaultBeats } from '../../utils/subdivisionDefaults';
import { isMeasureValid, applySubdivisionChange } from '../../utils/subdivisionValidation';
import {
  HEADER_HEIGHT,
  STAFF_HEIGHT,
  STAFF_LINES,
  STAFF_SPACE,
  STAFF_LINE_HEIGHT,
  TOTAL_HEIGHT,
  ACCEL_ROW_TOP,
  TEMPO_ROW_TOP,
  LABEL_ROW_TOP,
  TIMESIG_NUM_TOP,
  TIMESIG_DEN_TOP,
  TIME_SIG_WIDTH,
  SPACE_AFTER_TIMESIG,
  NOTE_SPACING,
  BARLINE_WIDTH,
} from './staffConstants';
import { BravuraNumberInput } from './BravuraNumberInput';
import { NoteGlyph } from './NoteGlyph';
import { noteForBeat, noteWidthForType, computeMeasureWidth } from '../../utils/noteGlyphs';

interface MeasureProps {
  measure: MeasureData;
  resolvedLabel: string | number;
  resolvedTempo: number;
  isActive: boolean;
  canDelete: boolean;
  onChange: (updated: MeasureData) => void;
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
  const beatDur = firstBeatDuration(denominator, firstSubdivision);
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
  return `${firstSubdivision}/${denominator} = `;
}

// Vertical position for footer-zone rows, relative to component top.
const SUBDIV_ROW_TOP = HEADER_HEIGHT + STAFF_HEIGHT + STAFF_SPACE;  // just below bottom staff line

export function Measure({
  measure,
  resolvedLabel,
  resolvedTempo,
  isActive,
  canDelete,
  onChange,
  onDelete,
  onInsertAfter,
}: MeasureProps) {
  const denominator = measure.meter[1];
  const firstSubdivision = measure.beats.length > 0 ? measure.beats[0].subdivisions : 1;

  const displayResolvedTempo = toDisplayTempo(resolvedTempo, denominator, firstSubdivision);

  const [tempoInputStr, setTempoInputStr] = useState(
    measure.tempo !== null ? String(toDisplayTempo(measure.tempo, denominator, firstSubdivision)) : ''
  );

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

  // Dynamic measure width and note x-positions
  const measureWidth = computeMeasureWidth(measure.beats, denominator);
  const notePositions: { x: number; noteType: ReturnType<typeof noteForBeat>; subdivisions: number }[] = [];
  {
    let nx = TIME_SIG_WIDTH + SPACE_AFTER_TIMESIG;
    for (let i = 0; i < measure.beats.length; i++) {
      const nt = noteForBeat(denominator, measure.beats[i].subdivisions);
      notePositions.push({ x: nx, noteType: nt, subdivisions: measure.beats[i].subdivisions });
      nx += noteWidthForType(nt);
      if (i < measure.beats.length - 1) nx += NOTE_SPACING;
    }
  }

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

  function handleNumeratorChange(newNum: number) {
    onChange({
      ...measure,
      meter: [newNum, measure.meter[1]],
      beats: defaultBeats(newNum, measure.meter[1]),
    });
  }

  function handleDenominatorChange(newDenom: number) {
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

  const measureClass = [
    'measure',
    isActive ? 'measure--active' : '',
    isValid ? '' : 'measure--invalid',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={measureClass}
      style={{
        position: 'relative',
        width: measureWidth,
        height: TOTAL_HEIGHT,
        flexShrink: 0,
      }}
    >
      {/* Five staff lines */}
      {Array.from({ length: STAFF_LINES }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: HEADER_HEIGHT + i * STAFF_SPACE,
            left: 0,
            width: '100%',
            height: STAFF_LINE_HEIGHT,
            backgroundColor: 'currentColor',
          }}
        />
      ))}

      {/* Time signature on staff (editable Bravura glyphs) */}
      <BravuraNumberInput
        value={measure.meter[0]}
        onChange={handleNumeratorChange}
        min={1}
        max={19}
        ariaLabel="Time signature numerator"
        style={{ position: 'absolute', top: TIMESIG_NUM_TOP, left: 10 }}
      />
      <BravuraNumberInput
        value={measure.meter[1]}
        onChange={handleDenominatorChange}
        min={1}
        max={16}
        allowedValues={[1, 2, 4, 8, 16]}
        ariaLabel="Time signature denominator"
        style={{ position: 'absolute', top: TIMESIG_DEN_TOP, left: 10 }}
      />

      {/* Note glyphs for each beat */}
      {notePositions.map((np, i) => (
        <NoteGlyph
          key={i}
          noteType={np.noteType}
          x={np.x}
          subdivisions={np.subdivisions}
        />
      ))}

      {/* Row A: accel/rit — placeholder, content TBD */}
      <div
        style={{
          position: 'absolute',
          top: ACCEL_ROW_TOP,
          left: 4,
          fontSize: '0.75rem',
          color: '#888',
        }}
      >
        {/* accel/rit */}
      </div>

      {/* Row B: Tempo */}
      <div style={{ position: 'absolute', top: TEMPO_ROW_TOP, left: 4 }}>
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

      {/* Row C: Measure label + delete + insert */}
      <div style={{
        position: 'absolute',
        top: LABEL_ROW_TOP,
        left: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: measureWidth - 8, // account for left: 4 offset on both sides
      }}>
        <input
          id={`label-${resolvedLabel}`}
          type="text"
          placeholder={String(resolvedLabel)}
          value={labelInputStr}
          onChange={(e) => setLabelInputStr(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => { if (e.key === 'Enter') commitLabel(); }}
          aria-label="Measure number"
          style={{ maxWidth: '4ch' }}
        />
        <button
          onClick={onDelete}
          disabled={!canDelete}
          aria-label="Delete measure"
        >
          X
        </button>
        <button onClick={onInsertAfter} aria-label="Insert measure after">
          +
        </button>
      </div>

      {/* Footer: Subdivision inputs */}
      <div
        className="subdivision-inputs"
        style={{ position: 'absolute', top: SUBDIV_ROW_TOP, left: 4 }}
      >
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

      {/* End-of-measure barline */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: HEADER_HEIGHT,
          width: BARLINE_WIDTH,
          height: STAFF_HEIGHT,
          backgroundColor: 'currentColor',
        }}
      />
    </div>
  );
}
