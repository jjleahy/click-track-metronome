import type { KeyboardEvent } from 'react';
import { beatLabelGlyph } from '../../utils/tempoConversion';
import { AUG_DOT } from '../../utils/noteGlyphs';

interface BeatLabelProps {
  denominator: number;
  firstSubdivision: number;
  /** The current BPM value to display or edit. Pass '' for no value (shows placeholder). */
  value: number | string;
  placeholder?: string;
  isReadOnly?: boolean;
  min?: number;
  max?: number;
  id?: string;
  ariaLabel?: string;
  onChange?: (val: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function BeatLabel({
  denominator,
  firstSubdivision,
  value,
  placeholder,
  isReadOnly = false,
  min,
  max,
  id,
  ariaLabel,
  onChange,
  onBlur,
  onKeyDown,
}: BeatLabelProps) {
  const glyphInfo = beatLabelGlyph(denominator, firstSubdivision);

  const noteSpan = glyphInfo ? (
    <span className="beat-label-glyph" aria-hidden="true">
      {glyphInfo.noteGlyph}{glyphInfo.dotted ? ' ' + AUG_DOT : ''}
    </span>
  ) : (
    <span>{firstSubdivision}/{denominator}</span>
  );

  const isImplied = value === '' || value === undefined;

  return (
    <span className={`beat-label${isImplied ? ' beat-label-implied' : ''}`} aria-label={isReadOnly ? ariaLabel : undefined}>
      {noteSpan}
      {' = '}
      {isReadOnly ? (
        <span>{value}</span>
      ) : (
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          aria-label={ariaLabel ?? 'Tempo'}
        />
      )}
    </span>
  );
}
