import type { NoteType } from '../../utils/noteGlyphs';
import {
  NOTEHEAD_WHOLE,
  NOTEHEAD_HALF,
  NOTEHEAD_BLACK,
  FLAG_8TH_UP,
  FLAG_16TH_UP,
  AUG_DOT,
  noteWidthForType,
} from '../../utils/noteGlyphs';
import {
  HEADER_HEIGHT,
  STAFF_HEIGHT,
  STAFF_SPACE,
  NOTATION_FONT_SIZE,
} from './staffConstants';

interface NoteGlyphProps {
  noteType: NoteType;
  x: number;
  subdivisions: number; // shown for fallback display
  isActive?: boolean;
  onClick?: () => void;
  highlightSubdivisions?: number;
}

// Note center on staff line 3 (G4 — 2nd line from bottom)
const NOTE_Y = HEADER_HEIGHT + 3 * STAFF_SPACE + 1; // 187px — tuned to center notehead on line

// Notehead font size (slightly larger than NOTATION_FONT_SIZE for better fit)
const NOTE_FONT_SIZE = NOTATION_FONT_SIZE + 1; // 81px

// Stem dimensions
const STEM_HEIGHT = 3.5 * STAFF_SPACE - 6; // 64px
const STEM_WIDTH = 2;
const STEM_X_OFFSET = 22; // px from note x — right edge of notehead

// Augmentation dot: horizontally after notehead, vertically in the space above
const DOT_X_OFFSET = 30;
const DOT_Y = HEADER_HEIGHT + 2.5 * STAFF_SPACE + 1;

// Clickable div bounds: top is badge position, bottom is bottom of staff.
// All child positions are expressed relative to CLICK_TOP.
const CLICK_TOP = NOTE_Y - 84;                          // 103px — badge sits here
const CLICK_HEIGHT = (HEADER_HEIGHT + STAFF_HEIGHT) - CLICK_TOP; // 103px
const NOTE_Y_REL    = NOTE_Y - CLICK_TOP;               // 84px — notehead
const DOT_Y_REL     = DOT_Y  - CLICK_TOP;               // ~74px
const STEM_TOP_REL  = (NOTE_Y - STEM_HEIGHT - 4) - CLICK_TOP; // 16px


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

const HIGHLIGHT_COLOR = '#646cff';

export function NoteGlyph({ noteType, x, subdivisions, isActive, onClick, highlightSubdivisions = 0 }: NoteGlyphProps) {
  if (noteType === 'fallback') {
    if (subdivisions === 0) return null;
    return (
      <div
        onClick={onClick}
        style={{
          position: 'absolute',
          left: x,
          top: CLICK_TOP,
          width: 32,
          height: CLICK_HEIGHT,
          overflow: 'hidden',
          cursor: onClick ? 'pointer' : undefined,
          userSelect: 'none',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: NOTE_Y_REL - 64,
            fontSize: '3.0rem',
            color: isActive ? HIGHLIGHT_COLOR : '#444',
            fontWeight: 'bold',
          }}
        >
          {subdivisions}
        </span>
        {highlightSubdivisions > 0 && (
          <span className="note-glyph__highlight-badge" style={{ position: 'absolute', left: 0, top: 0 }}>
            {highlightSubdivisions}
          </span>
        )}
      </div>
    );
  }

  const hasStem = noteType !== 'whole';
  const isDotted = noteType.startsWith('dotted-');
  const flag = flagGlyph(noteType);
  const glyphColor = isActive ? HIGHLIGHT_COLOR : undefined;
  const FLAG_OVERFLOW = 16;
  const DOT_OVERFLOW = 5;
  const width = noteWidthForType(noteType) + (flag ? FLAG_OVERFLOW : isDotted ? DOT_OVERFLOW : 0);

  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        left: x,
        top: CLICK_TOP,
        width,
        height: CLICK_HEIGHT,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : undefined,
        userSelect: 'none',
      }}
    >
      {highlightSubdivisions > 0 && (
        <span className="note-glyph__highlight-badge" style={{ position: 'absolute', left: 0, top: 0 }}>
          {highlightSubdivisions}
        </span>
      )}

      {/* Notehead */}
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: NOTE_Y_REL,
          fontFamily: 'Bravura',
          fontSize: NOTE_FONT_SIZE,
          lineHeight: 0,
          color: glyphColor,
        }}
      >
        {noteheadGlyph(noteType)}
      </span>

      {/* Stem */}
      {hasStem && (
        <div
          style={{
            position: 'absolute',
            left: STEM_X_OFFSET,
            top: STEM_TOP_REL,
            width: STEM_WIDTH,
            height: STEM_HEIGHT,
            backgroundColor: glyphColor ?? 'currentColor',
          }}
        />
      )}

      {/* Flag */}
      {flag && (
        <span
          style={{
            position: 'absolute',
            left: STEM_X_OFFSET,
            top: STEM_TOP_REL,
            fontFamily: 'Bravura',
            fontSize: NOTE_FONT_SIZE,
            lineHeight: 0,
            color: glyphColor,
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
            left: DOT_X_OFFSET,
            top: DOT_Y_REL,
            fontFamily: 'Bravura',
            fontSize: NOTE_FONT_SIZE,
            lineHeight: 0,
            color: glyphColor,
          }}
        >
          {AUG_DOT}
        </span>
      )}
    </div>
  );
}
