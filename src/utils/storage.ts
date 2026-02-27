import type { Exercise } from '../models/Exercise';

const EXERCISE_PREFIX = 'exercise_';
const EXERCISES_LIST_KEY = 'exercises_list';
const ACTIVE_ID_KEY = 'active_exercise_id';

export function saveExercise(exercise: Exercise): void {
  try {
    localStorage.setItem(EXERCISE_PREFIX + exercise.id, JSON.stringify(exercise));
  } catch (e) {
    console.error('Failed to save exercise', e);
  }
}

export function loadExercise(id: string): Exercise | null {
  try {
    const raw = localStorage.getItem(EXERCISE_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as Exercise;
  } catch {
    return null;
  }
}

export function deleteExercise(id: string): void {
  localStorage.removeItem(EXERCISE_PREFIX + id);
}

export function saveExerciseList(ids: string[]): void {
  try {
    localStorage.setItem(EXERCISES_LIST_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error('Failed to save exercise list', e);
  }
}

export function loadExerciseList(): string[] {
  try {
    const raw = localStorage.getItem(EXERCISES_LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadAllExercises(): Exercise[] {
  const ids = loadExerciseList();
  const exercises: Exercise[] = [];
  for (const id of ids) {
    const ex = loadExercise(id);
    if (ex) exercises.push(ex);
  }
  return exercises;
}

export function saveActiveId(id: string): void {
  localStorage.setItem(ACTIVE_ID_KEY, id);
}

export function loadActiveId(): string | null {
  return localStorage.getItem(ACTIVE_ID_KEY);
}
