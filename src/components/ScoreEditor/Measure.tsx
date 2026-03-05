import { useState, useEffect } from 'react';
import type { Measure as MeasureData } from '../../models/Exercise';
import type { ResolvedMeasure } from '../../models/ResolvedMeasure';
import { defaultBeats } from '../../utils/subdivisionDefaults';
import { isMeasureValid, applySubdivisionChange, shouldAutoInsertBeat } from '../../utils/subdivisionValidation';
import { toDisplayTempo, toInternalTempo } from '../../utils/tempoConversion';
import { BeatLabel } from './BeatLabel';
import {
  HEADER_HEIGHT,
  STAFF_HEIGHT,
  STAFF_LINES,
  STAFF_SPACE,
  STAFF_LINE_HEIGHT,
  TOTAL_HEIGHT,
  STAFF_CLEF_WIDTH,
  ACCEL_ROW_TOP,
  ACCEL_ROW_HEIGHT,
  TEMPO_ROW_TOP,
  LABEL_ROW_TOP,
  TIMESIG_NUM_TOP,
  TIMESIG_DEN_TOP,
  BARLINE_WIDTH,
  TIME_SIG_WIDTH,
  SPACE_AFTER_TIMESIG,
} from './staffConstants';
import { BravuraNumberInput } from './BravuraNumberInput';
import { NoteGlyph } from './NoteGlyph';
import type { AccelRitZone } from '../../models/ResolvedMeasure';
import { FERMATA_BELOW } from '../../utils/noteGlyphs';

interface MeasureProps {
  resolved: ResolvedMeasure;
  activeBeat: number | null;
  canDelete: boolean;
  onChange: (updated: MeasureData) => void;
  onDelete: () => void;
  onInsertAfter: () => void;
  pendingAccelStart: number | null;
  isLandingTarget: boolean;
  onAccelStart: (measureIndex: number) => void;
  onAccelLand: (targetIndex: number, zone: 'starting' | 'ending') => void;
  onAccelDelete: (sourceIndex: number) => void;
  activeFermata: { measureIndex: number; beatIndex: number } | null;
  onFermataActivate: (measureIndex: number, beatIndex: number) => void;
  onFermataClear: () => void;
}

// Vertical position for footer-zone rows, relative to component top.
const SUBDIV_ROW_TOP = HEADER_HEIGHT + STAFF_HEIGHT + STAFF_SPACE;  // just below bottom staff line
const HOLD_ROW_TOP = SUBDIV_ROW_TOP + 30;

const ACCEL_COLOR: Record<AccelRitZone['color'], string> = {
  red: '#f0a8a0',
  blue: '#a0c4e8',
  gray: '#bbb',
};

const ACCEL_LABEL: Record<AccelRitZone['color'], string> = {
  red: 'accel.',
  blue: 'rit.',
  gray: '(??)',
};

export function Measure({
  resolved,
  activeBeat,
  canDelete,
  onChange,
  onDelete,
  onInsertAfter,
  pendingAccelStart,
  isLandingTarget,
  onAccelStart,
  onAccelLand,
  onAccelDelete,
  activeFermata,
  onFermataActivate,
  onFermataClear,
}: MeasureProps) {
  const measure = resolved.source;
  const denominator = resolved.meter[1];
  const firstSubdivision = measure.beats.length > 0 ? measure.beats[0].subdivisions : 1;

  const displayResolvedTempo = toDisplayTempo(resolved.effectiveTempo, denominator, firstSubdivision);

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
      const resolvedVal: string | number = Number.isInteger(asNum) && String(asNum) === trimmed ? asNum : trimmed;
      onChange({ ...measure, rehearsalNumber: resolvedVal });
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
    let newBeats = applySubdivisionChange(measure.beats, beatIndex, newValue, measure.meter[0]);
    // Auto-insert a placeholder beat when underfilled and no beat is already empty
    if (shouldAutoInsertBeat(newBeats, measure.meter[0])) {
      newBeats.push({ subdivisions: 0, hold: null });
    }
    // Strip lingering 0-beats when the measure is valid without them
    if (isMeasureValid(newBeats.filter(b => b.subdivisions > 0), measure.meter[0])) {
      newBeats = newBeats.filter(b => b.subdivisions > 0);
    }
    onChange({ ...measure, beats: newBeats });
  }

  function handleHoldChange(beatIndex: number, rawValue: string) {
    const parsed = parseFloat(rawValue);
    const newHold = isNaN(parsed) ? null : Math.min(9.9, Math.max(0.1, parsed));
    const newBeats = measure.beats.map((b, i) =>
      i === beatIndex ? { ...b, hold: newHold } : b
    );
    onChange({ ...measure, beats: newBeats });
  }

  const measureClass = [
    'measure',
    isValid ? '' : 'measure--invalid',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={measureClass}
      style={{
        width: resolved.width,
        height: TOTAL_HEIGHT,
        left: STAFF_CLEF_WIDTH + resolved.xOffset,
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
      {resolved.beats.map((rb, i) => (
        <NoteGlyph
          key={i}
          noteType={rb.noteType}
          x={rb.x}
          subdivisions={rb.subdivisions}
          isActive={activeBeat === i}
        />
      ))}

      {/* Row A: accel/rit — ending zone (left) + starting zone (right) */}
      {/* Ending zone: occupies TIME_SIG_WIDTH (type=end) or TIME_SIG_WIDTH+SPACE_AFTER_TIMESIG (type=through) */}
      {resolved.accelRitEnding !== null ? (
        <div
          className="accel-bar accel-bar--filled"
          style={{
            position: 'absolute',
            top: ACCEL_ROW_TOP,
            left: 0,
            width: resolved.accelRitEnding.type === 'through'
              ? TIME_SIG_WIDTH + SPACE_AFTER_TIMESIG
              : TIME_SIG_WIDTH,
            height: ACCEL_ROW_HEIGHT,
            backgroundColor: ACCEL_COLOR[resolved.accelRitEnding.color],
            borderRadius: resolved.accelRitEnding.type === 'end' ? '0 4px 4px 0' : '0',
          }}
          onDoubleClick={() => onAccelDelete(resolved.accelRitEnding!.sourceIndex)}
          title="Double-click to delete accel/rit"
        />
      ) : isLandingTarget ? (
        <div
          className="accel-bar accel-bar--landing"
          style={{
            position: 'absolute',
            top: ACCEL_ROW_TOP,
            left: 0,
            width: TIME_SIG_WIDTH,
            height: ACCEL_ROW_HEIGHT,
          }}
          onClick={(e) => { e.stopPropagation(); onAccelLand(resolved.index, 'ending'); }}
          title="Click to end accel/rit here"
        />
      ) : null}

      {/* Starting zone: occupies note area (after time sig) to barline */}
      {(() => {
        const zone = resolved.accelRitStarting;
        const left = TIME_SIG_WIDTH + SPACE_AFTER_TIMESIG;
        const filledWidth = resolved.width - left;           // extends through barline to merge with next measure
        const unfilledWidth = resolved.width - left - BARLINE_WIDTH;
        const isOwnStart = pendingAccelStart === resolved.index;

        if (zone !== null) {
          const borderRadius = zone.type === 'single' ? '4px'
            : zone.type === 'start' ? '4px 0 0 4px'
            : '0';
          return (
            <div
              className="accel-bar accel-bar--filled"
              style={{
                position: 'absolute',
                top: ACCEL_ROW_TOP,
                left,
                width: filledWidth,
                height: ACCEL_ROW_HEIGHT,
                backgroundColor: ACCEL_COLOR[zone.color],
                borderRadius,
                display: 'flex',
                alignItems: 'center',
                fontSize: 18,
                fontStyle: 'italic',
                color: '#000',
                paddingLeft: 6,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
              onDoubleClick={() => onAccelDelete(zone.sourceIndex)}
              title="Double-click to delete accel/rit"
            >
              {zone.type === 'start' && <>{ACCEL_LABEL[zone.color]}<span style={{ fontStyle: 'normal' }}> - - -</span></>}
              {zone.type === 'through' && <>- - - <span>{ACCEL_LABEL[zone.color]}</span> - - -</>}
              {zone.type === 'single' && <>{ACCEL_LABEL[zone.color]}</>}
              {zone.type === 'single' && (
                <input
                  type="number"
                  min={20}
                  max={300}
                  placeholder={String(resolved.tempo)}
                  value={resolved.source.gradualTempo?.endTempo ?? ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    onChange({
                      ...resolved.source,
                      gradualTempo: {
                        ...resolved.source.gradualTempo!,
                        endTempo: isNaN(val) ? null : val,
                      },
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Arrival tempo"
                  style={{ position: 'absolute', right: 4, top: 4, width: '3.5rem', fontSize: 18 }}
                />
              )}
            </div>
          );
        }

        if (isOwnStart) {
          return (
            <div
              className="accel-bar accel-bar--landing"
              style={{
                position: 'absolute',
                top: ACCEL_ROW_TOP,
                left,
                width: unfilledWidth,
                height: ACCEL_ROW_HEIGHT,
              }}
              onClick={(e) => { e.stopPropagation(); onAccelLand(resolved.index, 'starting'); }}
              title="Click to make single-measure accel/rit"
            />
          );
        }

        if (pendingAccelStart === null) {
          return (
            <div
              className="accel-bar accel-bar--empty"
              style={{
                position: 'absolute',
                top: ACCEL_ROW_TOP,
                left,
                width: unfilledWidth,
                height: ACCEL_ROW_HEIGHT,
              }}
              onClick={() => onAccelStart(resolved.index)}
              title="Add accel/rit starting here"
            >
              Add accel/rit...
            </div>
          );
        }

        return null;
      })()}

      {/* Row B: Tempo */}
      <div style={{ position: 'absolute', top: TEMPO_ROW_TOP, left: 4 }}>
        <BeatLabel
          denominator={denominator}
          firstSubdivision={firstSubdivision}
          value={tempoInputStr}
          placeholder={String(displayResolvedTempo)}
          id={`tempo-${resolved.label}`}
          min={1}
          max={999}
          onChange={setTempoInputStr}
          onBlur={commitTempo}
          onKeyDown={(e) => { if (e.key === 'Enter') commitTempo(); }}
        />
      </div>

      {/* Row C: Measure label (always visible) + action buttons (hover only) */}
      <div style={{
        position: 'absolute',
        top: LABEL_ROW_TOP,
        left: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: resolved.width - 8,
      }}>
        <input
          id={`label-${resolved.label}`}
          type="text"
          placeholder={String(resolved.label)}
          value={labelInputStr}
          onChange={(e) => setLabelInputStr(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => { if (e.key === 'Enter') commitLabel(); }}
          aria-label="Measure number"
          style={{ maxWidth: '4ch' }}
        />
        <div className="measure__hover-ctrl measure__row-c-buttons">
          <button
            className="measure__icon-btn measure__icon-btn--delete"
            onClick={onDelete}
            disabled={!canDelete}
            aria-label="Delete measure"
            title="Delete measure"
          >
            ✕
          </button>
          <button
            className="measure__icon-btn measure__icon-btn--insert"
            onClick={onInsertAfter}
            aria-label="Insert measure after"
            title="Insert measure after"
          >
            +
          </button>
        </div>
      </div>

      {/* Footer: Subdivision inputs — each aligned under its note glyph */}
      {resolved.beats.map((rb, bi) => (
        <input
          key={bi}
          className="measure__hover-ctrl"
          type="number"
          min={0}
          max={measure.meter[0]}
          value={measure.beats[bi].subdivisions === 0 ? '' : measure.beats[bi].subdivisions}
          onChange={(e) => handleSubdivisionChange(bi, e.target.value)}
          aria-label={`Beat ${bi + 1} subdivisions`}
          style={{ position: 'absolute', top: SUBDIV_ROW_TOP, left: rb.x }}
        />
      ))}

      {/* Footer: Fermata hold — grayed glyph buttons (hover) or input (active/has value) */}
      {measure.beats.some(b => b.hold == null) && (
        <span
          className="measure__hover-ctrl fermata-label"
          style={{ position: 'absolute', top: HOLD_ROW_TOP + 8, left: 2 }}
        >
          Add...
        </span>
      )}
      {resolved.beats.map((rb, bi) => {
        const hasHold = measure.beats[bi].hold != null;
        const isActive = activeFermata?.measureIndex === resolved.index
                      && activeFermata?.beatIndex === bi;
        const showInput = isActive || hasHold;

        return showInput ? (
          <span key={bi} className="fermata-input-wrapper" style={{ position: 'absolute', top: HOLD_ROW_TOP, left: rb.x }}>
            <input
              type="number"
              max={9.9}
              step={0.1}
              value={measure.beats[bi].hold ?? ''}
              onChange={(e) => handleHoldChange(bi, e.target.value)}
              onBlur={() => {
                if (measure.beats[bi].hold == null) onFermataClear();
              }}
              autoFocus={isActive && !hasHold}
              aria-label={`Beat ${bi + 1} hold (seconds)`}
            />
          </span>
        ) : (
          <span
            key={bi}
            className="measure__hover-ctrl fermata-button"
            onClick={() => onFermataActivate(resolved.index, bi)}
            title="Add fermata hold"
            style={{ position: 'absolute', top: HOLD_ROW_TOP, left: rb.x }}
          >
            {FERMATA_BELOW}
          </span>
        );
      })}

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
