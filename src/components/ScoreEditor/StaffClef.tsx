// StaffClef renders a five-line staff with a treble clef glyph.
// Used as the leftmost element in the score editor scroll container.
//
// Staff lines are drawn with div primitives (SMuFL recommends this over
// using the stave glyphs, which are intended for text-based applications).
//
// Layout constants (HEADER_HEIGHT, STAFF_HEIGHT, FOOTER_HEIGHT, etc.) are
// imported from staffConstants so StaffClef and Measure share the same
// coordinate system and staff lines align horizontally.
//
// Clef positioning is derived from HEADER_HEIGHT and STAFF_SPACE so
// rescaling either constant keeps the glyph correctly placed on the staff.
// All Bravura-specific ratios below are internal to this component.

import {
  HEADER_HEIGHT,
  FOOTER_HEIGHT,
  STAFF_LINES,
  STAFF_SPACE,
  STAFF_LINE_HEIGHT,
  STAFF_CLEF_WIDTH,
  TOTAL_HEIGHT,
} from './staffConstants';

// Treble clef: SMuFL U+E050
const TREBLE_CLEF = '\uE050';

// Font size scales linearly with staff space.
// Ratio 4.3 is empirically tuned for Bravura (verified at STAFF_SPACE=10px).
const CLEF_FONT_SIZE = STAFF_SPACE * 4.3;

// Horizontal padding on each side of the clef glyph.
// Ratio 0.4 gives ~8px at STAFF_SPACE=20, which fits left margin and right breathing room.
const CLEF_H_PADDING = STAFF_SPACE * 0.4;

// The top pixel of Bravura's treble clef glyph aligns with the second staff
// line (one STAFF_SPACE below HEADER_HEIGHT), minus 2px for the glyph's internal
// top padding. Empirically confirmed at STAFF_SPACE=20px.
const CLEF_TOP = HEADER_HEIGHT + STAFF_SPACE - 2;
const CLEF_LEFT = CLEF_H_PADDING;

// Suppress unused-variable warnings for FOOTER_HEIGHT — imported for completeness
// so this file documents the full coordinate system, even though only HEADER_HEIGHT
// is needed to position the clef.
void FOOTER_HEIGHT;

export function StaffClef() {
  return (
    <div
      className="staff-clef"
      style={{
        position: 'relative',
        width: STAFF_CLEF_WIDTH,
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

      {/* Treble clef glyph */}
      <span
        style={{
          position: 'absolute',
          top: CLEF_TOP,
          left: CLEF_LEFT,
          fontFamily: 'Bravura',
          fontSize: CLEF_FONT_SIZE,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        {TREBLE_CLEF}
      </span>
    </div>
  );
}
