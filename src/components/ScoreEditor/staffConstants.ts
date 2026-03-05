// Shared visual layout constants for the staff system.
// Both StaffClef and Measure draw staff lines using these values,
// and position their content relative to the same coordinate space.

export const STAFF_HEIGHT = 80;       // px, top to bottom staff line
export const STAFF_LINE_HEIGHT = 2;   // px, thickness of each line
export const STAFF_LINES = 5;
export const STAFF_SPACE = STAFF_HEIGHT / (STAFF_LINES - 1); // 20px — derived, not set directly

// --- Header zone (above the staff) ---
// Three rows stacked top-to-bottom:
//   Row A (ACCEL_ROW_TOP):  accel/rit markings — less common, sits highest
//   Row B (TEMPO_ROW_TOP):  tempo marking — q = 120 etc.
//   Row C (LABEL_ROW_TOP):  measure number + edit controls

export const ACCEL_ROW_TOP = 0;       // px from component top
export const ACCEL_ROW_HEIGHT = 36;   // px — height of the accel/rit row
export const TEMPO_ROW_TOP = 46;      // px — one text-row below accel
export const LABEL_ROW_TOP = 91;      // px — breathing room before staff top

// Distance from component top to the top staff line.
// LABEL_ROW_TOP (~91) + input height (~25) + small gap = 126.
export const HEADER_HEIGHT = 126;     // px

// --- Footer zone (below the staff) ---
// Time sig and subdivision inputs live here.
export const FOOTER_HEIGHT = 80;      // px below bottom staff line

export const TOTAL_HEIGHT = HEADER_HEIGHT + STAFF_HEIGHT + FOOTER_HEIGHT; // 286px

// --- Notation sizing ---
export const NOTATION_FONT_SIZE = STAFF_SPACE * 4;  // 80px — standard SMuFL sizing for staff-sized glyphs

// Vertical positions for time-sig glyphs (empirically tuned for Bravura)
export const TIMESIG_NUM_TOP  = HEADER_HEIGHT;                  // numerator — staff spaces 1–2
export const TIMESIG_DEN_TOP  = HEADER_HEIGHT + 2 * STAFF_SPACE; // denominator — staff spaces 3–4

// --- Horizontal measure layout ---
// NOTE: Time sig glyph width is ~35px for single-digit, ~60px for double-digit.
// When one digit is single and the other double, offset the single digit's left by ~15px to center it.
// Not yet implemented — revisit when making the time sig editable or computing dynamic widths.
export const TIME_SIG_WIDTH      = STAFF_SPACE * 3;    // 40px — width allocated for time sig glyphs
export const SPACE_AFTER_TIMESIG = STAFF_SPACE * 1.0;  // 10px
export const NOTE_SPACING        = STAFF_SPACE * 1.8;  // 50px — gap between consecutive note glyphs
export const SPACE_AFTER_NOTES   = STAFF_SPACE * 1.5;  // 10px — breathing room before barline
export const BARLINE_WIDTH       = 3;                   // px

// Width of the StaffClef component (treble clef + staff lines, leftmost scroll item).
// Formula mirrors StaffClef.tsx: left padding + glyph width + right padding.
// CLEF_H_PADDING = STAFF_SPACE * 0.4, glyph width ≈ STAFF_SPACE * 2.9.
export const STAFF_CLEF_WIDTH = Math.round(STAFF_SPACE * 0.4 + STAFF_SPACE * 2.9 + STAFF_SPACE * 0.4); // 74px

// Per-note-type glyph widths (approximate, for layout computation)
export const NOTE_WIDTH_WHOLE    = STAFF_SPACE * 1.6;  // 32px
export const NOTE_WIDTH_HALF     = STAFF_SPACE * 1.2;  // 24px
export const NOTE_WIDTH_QUARTER  = STAFF_SPACE * 1.2;  // 24px
export const NOTE_WIDTH_FLAGGED  = STAFF_SPACE * 1.4;  // 28px — notehead + flag
export const DOT_EXTRA_WIDTH     = STAFF_SPACE * 0.5;  // 10px — added for dotted notes
