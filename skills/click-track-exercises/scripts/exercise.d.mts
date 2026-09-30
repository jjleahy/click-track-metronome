// Type declarations for exercise.mjs (used by the repo's tests; not needed to run the script).

export interface Beat {
  subdivisions: number;
  hold: number | null;
  highlightSubdivisions?: number;
  highlights?: number[];
}
export interface GradualTempo {
  measureLength: number;
  endTempo: number | null;
}
export interface Measure {
  meter: [number, number];
  beats: Beat[];
  tempo: number | null;
  rehearsalNumber: string | number | null;
  gradualTempo: GradualTempo | null;
}
export interface Exercise {
  id: string;
  name: string;
  measures: Measure[];
}
export interface Issue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

export const DEFAULT_BASE_URL: string;
export const TEMPO_MIN: number;
export const TEMPO_MAX: number;
export const DEFAULT_TEMPO: number;
export const HOLD_MAX_SECONDS: number;
export const NUMERATOR_MAX: number;
export const DENOMINATOR_MAX: number;
export const HIGHLIGHT_SUBDIVISIONS_MAX: number;

export function defaultGrouping(numerator: number, denominator: number): number[];
export function beatName(denominator: number, subdivisions: number): string | null;
export function parseTempo(spec: unknown): { internal: number; exact: number };
export function toDisplayTempo(internal: number, denominator: number, firstSubdivision: number): number;
export function resolveLabels(measures: unknown[]): (string | number)[];
export function validateExercise(exercise: unknown): Issue[];
export function estimateDurationMs(exercise: Exercise): number;
export function encodeExercise(exercise: Exercise): string;
export function shareUrl(exercise: Exercise, base?: string): string;
export function decodeShare(input: string): Exercise;
export function buildExercise(input: unknown): { exercise: Exercise | null; issues: Issue[] };
export function describeExercise(exercise: Exercise): string;
export function main(argv: string[], log?: (line: string) => void): number;
