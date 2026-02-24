// StaffClef renders a five-line staff with a treble clef glyph.
// Used as the leftmost element in the score editor scroll container.
//
// Staff lines are drawn with div primitives (SMuFL recommends this over
// using the stave glyphs, which are intended for text-based applications).
// TODO: Once MeasureCard also draws staff lines, extract shared staff-line
// rendering into a StaffLines component if the duplication is straightforward.
//
// Layout constants (STAFF_TOP, STAFF_HEIGHT, STAFF_BOTTOM_PADDING) will move
// to a shared visual-constants file so MeasureCard can import the same values.
// STAFF_LINE_HEIGHT will likely move there too.
// All Bravura-specific ratios below stay here — they're internal to this component.
//
// Clef positioning is derived from STAFF_TOP and STAFF_SPACE so rescaling
// either constant keeps the glyph correctly placed on the staff.

const STAFF_TOP = 150;    // px from component top to top staff line
const STAFF_HEIGHT = 80;  // px from top staff line to bottom staff line
const STAFF_BOTTOM_PADDING = 80; // px below bottom staff line

const STAFF_LINES = 5;
const STAFF_SPACE = STAFF_HEIGHT / (STAFF_LINES - 1); // 20px — derived, not set directly
const STAFF_LINE_HEIGHT = 2; // px — thickness of each staff line

const TOTAL_HEIGHT = STAFF_TOP + STAFF_HEIGHT + STAFF_BOTTOM_PADDING;

// Treble clef: SMuFL U+E050
const TREBLE_CLEF = '\uE050';

// Font size scales linearly with staff space.
// Ratio 4.3 is empirically tuned for Bravura (verified at STAFF_SPACE=10px).
const CLEF_FONT_SIZE = STAFF_SPACE * 4.3;

// Horizontal padding on each side of the clef glyph.
// Ratio 0.4 gives ~8px at STAFF_SPACE=20, which fits left margin and right breathing room.
const CLEF_H_PADDING = STAFF_SPACE * 0.4;

// Bravura's treble clef glyph width ≈ 2.9× STAFF_SPACE at this font-size ratio.
// Total component width = left padding + glyph width + right padding.
const COMPONENT_WIDTH = Math.round(CLEF_H_PADDING + STAFF_SPACE * 2.9 + CLEF_H_PADDING); // ~74px at STAFF_SPACE=20

// The top pixel of Bravura's treble clef glyph aligns with the second staff
// line (one STAFF_SPACE below STAFF_TOP), minus 2px for the glyph's internal
// top padding. Empirically confirmed at STAFF_SPACE=20px.
const CLEF_TOP = STAFF_TOP + STAFF_SPACE - 2;
const CLEF_LEFT = CLEF_H_PADDING;

export function StaffClef() {
  return (
    <div
      className="staff-clef"
      style={{
        position: 'relative',
        width: COMPONENT_WIDTH,
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
            top: STAFF_TOP + i * STAFF_SPACE,
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
