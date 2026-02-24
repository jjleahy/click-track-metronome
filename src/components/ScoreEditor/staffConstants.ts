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

export const ACCEL_ROW_TOP = 10;      // px from component top
export const TEMPO_ROW_TOP = 40;      // px — one text-row below accel
export const LABEL_ROW_TOP = 85;      // px — breathing room before staff top

// Distance from component top to the top staff line.
// LABEL_ROW_TOP (~75) + input height (~25) + small gap = 120.
export const HEADER_HEIGHT = 120;     // px

// --- Footer zone (below the staff) ---
// Time sig and subdivision inputs live here.
export const FOOTER_HEIGHT = 80;      // px below bottom staff line

export const TOTAL_HEIGHT = HEADER_HEIGHT + STAFF_HEIGHT + FOOTER_HEIGHT; // 280px
