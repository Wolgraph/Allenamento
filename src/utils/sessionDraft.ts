import * as FileSystem from 'expo-file-system';
import type { CardExerciseWithName } from '../types';

const DRAFT_PATH = `${FileSystem.documentDirectory}session_draft.json`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DraftExercise {
  cardExerciseId: number;
  exerciseId:     number;
  exerciseName:   string;
  sets:           number;
  reps:           number;
  restTime:       number;
  exerciseType:   'reps' | 'time' | 'bodyweight';
  duration:       number | null;
  groupId:        number | null;
  groupType:      'superset' | 'circuit' | 'simple' | null;
  groupRounds:    number | null;
  groupRestTime:  number | null;
}

export interface DraftExerciseProgress {
  weights:    string[];   // one slot per set/round
  isDone:     boolean;
  currentSet: number;
}

export interface DraftProgress {
  elapsedS:   number;
  activeIdx:  number;
  groupRound: Record<string, number>;  // groupId (string key) → current round
  exercises:  DraftExerciseProgress[];
}

export interface SessionDraft {
  version:   number;
  startedAt: string;
  planId:    number;
  cardId:    number;
  cardName:  string;
  exercises: DraftExercise[];  // immutable template
  progress:  DraftProgress;   // updated on every action
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function effectiveSets(ex: CardExerciseWithName): number {
  return ex.group_id != null ? (ex.group_rounds ?? 1) : ex.sets;
}

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Creates the draft file at the start of a workout.
 * initialWeights[i] is the pre-filled weights array for exercise i (one entry per set/round).
 */
export async function createDraft(
  planId:         number,
  cardId:         number,
  cardName:       string,
  startedAt:      string,
  exercises:      CardExerciseWithName[],
  initialWeights: string[][]
): Promise<void> {
  const draft: SessionDraft = {
    version:   1,
    startedAt,
    planId,
    cardId,
    cardName,
    exercises: exercises.map(ex => ({
      cardExerciseId: ex.id,
      exerciseId:     ex.exercise_id,
      exerciseName:   ex.exercise_name,
      sets:           ex.sets,
      reps:           ex.reps,
      restTime:       ex.rest_time,
      exerciseType:   ex.exercise_type,
      duration:       ex.duration,
      groupId:        ex.group_id,
      groupType:      ex.group_type,
      groupRounds:    ex.group_rounds,
      groupRestTime:  ex.group_rest_time,
    })),
    progress: {
      elapsedS:   0,
      activeIdx:  0,
      groupRound: {},
      exercises:  exercises.map((ex, i) => ({
        weights:    initialWeights[i] ?? Array(effectiveSets(ex)).fill(''),
        isDone:     false,
        currentSet: 1,
      })),
    },
  };
  await FileSystem.writeAsStringAsync(DRAFT_PATH, JSON.stringify(draft));
}

/**
 * Fire-and-forget update of the progress section.
 * Safe to call on every action without blocking the UI.
 */
export function updateDraftProgress(progress: DraftProgress): void {
  FileSystem.readAsStringAsync(DRAFT_PATH)
    .then(raw => {
      const draft: SessionDraft = JSON.parse(raw);
      draft.progress = progress;
      return FileSystem.writeAsStringAsync(DRAFT_PATH, JSON.stringify(draft));
    })
    .catch(() => {});
}

/** Returns the draft if it exists, null otherwise. */
export async function readDraft(): Promise<SessionDraft | null> {
  try {
    const info = await FileSystem.getInfoAsync(DRAFT_PATH);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(DRAFT_PATH);
    return JSON.parse(raw) as SessionDraft;
  } catch {
    return null;
  }
}

/**
 * Deletes the draft file. Must be awaited before navigating away
 * from the workout screen to avoid false-positive recovery prompts.
 */
export async function deleteDraft(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(DRAFT_PATH);
    if (info.exists) await FileSystem.deleteAsync(DRAFT_PATH);
  } catch {}
}
