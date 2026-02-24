import type { NoteType } from '../../utils/noteGlyphs';
import {
  NOTEHEAD_WHOLE,
  NOTEHEAD_HALF,
  NOTEHEAD_BLACK,
  FLAG_8TH_UP,
  FLAG_16TH_UP,
  AUG_DOT,
} from '../../utils/noteGlyphs';
import {
  HEADER_HEIGHT,
  STAFF_SPACE,
  NOTATION_FONT_SIZE,
} from './staffConstants';

interface NoteGlyphProps {
  noteType: NoteType;
  x: number;
  subdivisions: number; // shown for fallback display
}

// Note center on staff line 3 (G4 — 2nd line from bottom)
const NOTE_Y = HEADER_HEIGHT + 3 * STAFF_SPACE + 1; // 181px — tuned to center notehead on line

// Notehead font size (slightly larger than NOTATION_FONT_SIZE for better fit)
const NOTE_FONT_SIZE = NOTATION_FONT_SIZE + 1; // 81px

// Stem dimensions
const STEM_HEIGHT = 3.5 * STAFF_SPACE - 6; // 64px
const STEM_WIDTH = 2;
const STEM_X_OFFSET = 22; // px from note x — right edge of notehead

// Augmentation dot: horizontally after notehead, vertically in the space above
const DOT_X_OFFSET = 30;
const DOT_Y = HEADER_HEIGHT + 2.5 * STAFF_SPACE + 1;

function noteheadGlyph(noteType: NoteType): string {
  switch (noteType) {
    case 'whole':
      return NOTEHEAD_WHOLE;
    case 'half':
    case 'dotted-half':
      return NOTEHEAD_HALF;
    default:
      return NOTEHEAD_BLACK;
  }
}

function flagGlyph(noteType: NoteType): string | null {
  switch (noteType) {
    case 'eighth':
    case 'dotted-eighth':
      return FLAG_8TH_UP;
    case 'sixteenth':
    case 'dotted-sixteenth':
      return FLAG_16TH_UP;
    default:
      return null;
  }
}

export function NoteGlyph({ noteType, x, subdivisions }: NoteGlyphProps) {
  if (noteType === 'fallback') {
    return (
      <span
        style={{
          position: 'absolute',
          left: x,
          top: NOTE_Y - 30,
          fontSize: '0.75rem',
          color: '#888',
        }}
      >
        {subdivisions}
      </span>
    );
  }

  const hasStem = noteType !== 'whole';
  const isDotted = noteType.startsWith('dotted-');
  const stemTop = NOTE_Y - STEM_HEIGHT - 4;
  const flag = flagGlyph(noteType);

  return (
    <>
      {/* Notehead */}
      <span
        style={{
          position: 'absolute',
          left: x,
          top: NOTE_Y,
          fontFamily: 'Bravura',
          fontSize: NOTE_FONT_SIZE,
          lineHeight: 0,
        }}
      >
        {noteheadGlyph(noteType)}
      </span>

      {/* Stem */}
      {hasStem && (
        <div
          style={{
            position: 'absolute',
            left: x + STEM_X_OFFSET,
            top: stemTop,
            width: STEM_WIDTH,
            height: STEM_HEIGHT,
            backgroundColor: 'currentColor',
          }}
        />
      )}

      {/* Flag */}
      {flag && (
        <span
          style={{
            position: 'absolute',
            left: x + STEM_X_OFFSET,
            top: stemTop,
            fontFamily: 'Bravura',
            fontSize: NOTE_FONT_SIZE,
            lineHeight: 0,
          }}
        >
          {flag}
        </span>
      )}

      {/* Augmentation dot */}
      {isDotted && (
        <span
          style={{
            position: 'absolute',
            left: x + DOT_X_OFFSET,
            top: DOT_Y,
            fontFamily: 'Bravura',
            fontSize: NOTE_FONT_SIZE,
            lineHeight: 0,
          }}
        >
          {AUG_DOT}
        </span>
      )}
    </>
  );
}
