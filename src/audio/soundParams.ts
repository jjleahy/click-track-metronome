import type { SoundType } from '../models/SoundConfig';

// Sound parameters per type — each entry is an array of sine wave partials
export const SOUND_PARAMS: Record<SoundType, { freq: number; gain: number; dur: number }[] | null> = {

  // ── Emphasis variants ──────────────────────────────────

  // Original but with inharmonic high partials for a "crack" on top
  emphasis: [
    { freq: 1000, gain: 0.28, dur: 0.028 },
    { freq: 1570, gain: 0.22, dur: 0.020 },
    { freq: 2340, gain: 0.18, dur: 0.012 },
    { freq: 3450, gain: 0.13, dur: 0.008 },
    { freq: 4200, gain: 0.11, dur: 0.005 }
  ],

  emphasisTone: [{ freq: 1000, gain: 0.5, dur: 0.04 }],

  // Brighter and more piercing — leans into the sensitivity peak
  emphasisThin: [
    { freq: 1200, gain: 0.20, dur: 0.025 },
    { freq: 2100, gain: 0.25, dur: 0.018 },
    { freq: 3300, gain: 0.25, dur: 0.012 },
    { freq: 4700, gain: 0.15, dur: 0.007 },
    { freq: 6200, gain: 0.08, dur: 0.004 },
  ],

  // ── Standard variants ──────────────────────────────────

  // Tighter, more woodblock-like — fewer partials, all short
  standard: [
    { freq: 900,  gain: 0.22, dur: 0.018 },
    { freq: 1430, gain: 0.18, dur: 0.012 },
    { freq: 2250, gain: 0.12, dur: 0.008 },
    { freq: 3800, gain: 0.05, dur: 0.005 },
  ],

  standardTone: [{ freq: 800, gain: 0.3, dur: 0.04 }],

  // Spread across octaves, faster high partials — "woody" noise character
  standardWood: [
    { freq: 500,  gain: 0.15, dur: 0.028 },
    { freq: 800,  gain: 0.20, dur: 0.025 },
    { freq: 1350, gain: 0.18, dur: 0.020 },
    { freq: 2200, gain: 0.12, dur: 0.012 },
    { freq: 3600, gain: 0.08, dur: 0.007 },
  ],

  // ── Low variants ───────────────────────────────────────

  // Warm count-in with subtle upper presence
  low: [
    { freq: 300,  gain: 0.30, dur: 0.050 },
    { freq: 620,  gain: 0.18, dur: 0.035 },
    { freq: 1150, gain: 0.08, dur: 0.020 },
  ],

  lowTone: [{ freq: 600, gain: 0.4, dur: 0.025 }],

  // Thuddy — deeper fundamental, short and muffled
  lowThud: [
    { freq: 180,  gain: 0.35, dur: 0.045 },
    { freq: 420,  gain: 0.20, dur: 0.028 },
    { freq: 750,  gain: 0.10, dur: 0.015 },
  ],

  // ── Click variants ─────────────────────────────────────

  quietClick: [{ freq: 400, gain: 0.2, dur: 0.015 }],

  // Louder through stacked partials in the sensitivity peak, not gain
  warmClick: [
    { freq: 1800, gain: 0.18, dur: 0.010 },
    { freq: 2800, gain: 0.22, dur: 0.008 },
    { freq: 4000, gain: 0.18, dur: 0.006 },
    { freq: 5500, gain: 0.10, dur: 0.004 },
  ],

  // Mechanical tick — very short, very high, almost all transient
  tick: [
    { freq: 1400, gain: 0.04, dur: 0.008 },
    { freq: 2500, gain: 0.20, dur: 0.006 },
    { freq: 4000, gain: 0.20, dur: 0.004 },
    { freq: 6000, gain: 0.09, dur: 0.003 },
  ],

  // ── Special ────────────────────────────────────────────

  // Rimshot-ish — low body with bright snappy attack
  straw: [
    { freq: 700,  gain: 0.15, dur: 0.030 },
    { freq: 1800, gain: 0.20, dur: 0.015 },
    { freq: 3100, gain: 0.22, dur: 0.010 },
    { freq: 4500, gain: 0.15, dur: 0.006 },
    { freq: 6500, gain: 0.08, dur: 0.004 },
  ],

  // Cowbell — the classic two-frequency beating pair
  bell: [
    { freq: 545,  gain: 0.25, dur: 0.070 },
    { freq: 815,  gain: 0.20, dur: 0.050 },
  ],

  none: null,
};
