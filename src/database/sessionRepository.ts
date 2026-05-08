import { getDB } from './db';
import type { WorkoutSession } from '../types';

export function createSession(planId: number, cardId: number): number {
  const result = getDB().runSync(
    'INSERT INTO workout_sessions (plan_id, card_id, started_at) VALUES (?, ?, ?)',
    [planId, cardId, new Date().toISOString()]
  );
  return result.lastInsertRowId;
}

export function finalizeSession(id: number, durationS: number): void {
  getDB().runSync(
    'UPDATE workout_sessions SET ended_at = ?, duration_s = ? WHERE id = ?',
    [new Date().toISOString(), durationS, id]
  );
}

export function deleteSession(id: number): void {
  getDB().runSync('DELETE FROM workout_sessions WHERE id = ?', [id]);
}

export function getSession(id: number): WorkoutSession | null {
  return getDB().getFirstSync<WorkoutSession>(
    'SELECT * FROM workout_sessions WHERE id = ?',
    [id]
  ) ?? null;
}

export function getLastCardForPlan(planId: number): number | null {
  const row = getDB().getFirstSync<{ card_id: number }>(
    "SELECT card_id FROM workout_sessions WHERE plan_id = ? AND ended_at IS NOT NULL ORDER BY started_at DESC LIMIT 1",
    [planId]
  );
  return row?.card_id ?? null;
}

export interface SessionSetRow {
  exercise_name: string;
  set_number: number;
  reps: number;
  weight: number | null;
  card_exercise_id: number;
  exercise_type: 'reps' | 'time';
}

export function getSessionSets(sessionId: number): SessionSetRow[] {
  return getDB().getAllSync<SessionSetRow>(`
    SELECT ss.set_number, ss.reps, ss.weight, ss.card_exercise_id,
           e.name AS exercise_name,
           COALESCE(ss.exercise_type, 'reps') AS exercise_type
    FROM session_sets ss
    JOIN exercises e ON ss.exercise_id = e.id
    WHERE ss.session_id = ?
    ORDER BY ss.card_exercise_id ASC, ss.set_number ASC
  `, [sessionId]);
}

export interface SessionRow {
  id: number;
  plan_id: number;
  card_id: number;
  plan_name: string;
  card_name: string;
  started_at: string;
  ended_at: string | null;
  duration_s: number | null;
  set_count: number;
}

export function getCompletedSessions(): SessionRow[] {
  return getDB().getAllSync<SessionRow>(`
    SELECT ws.id, ws.plan_id, ws.card_id, ws.started_at, ws.ended_at, ws.duration_s,
           tp.name AS plan_name, wc.name AS card_name,
           (SELECT COUNT(*) FROM session_sets WHERE session_id = ws.id) AS set_count
    FROM workout_sessions ws
    LEFT JOIN training_plans tp ON ws.plan_id = tp.id
    LEFT JOIN workout_cards  wc ON ws.card_id  = wc.id
    WHERE ws.ended_at IS NOT NULL
    ORDER BY ws.started_at DESC
  `);
}

export function getCompletedSessionsForPlan(planId: number): SessionRow[] {
  return getDB().getAllSync<SessionRow>(`
    SELECT ws.id, ws.plan_id, ws.card_id, ws.started_at, ws.ended_at, ws.duration_s,
           tp.name AS plan_name, wc.name AS card_name,
           (SELECT COUNT(*) FROM session_sets WHERE session_id = ws.id) AS set_count
    FROM workout_sessions ws
    LEFT JOIN training_plans tp ON ws.plan_id = tp.id
    LEFT JOIN workout_cards  wc ON ws.card_id  = wc.id
    WHERE ws.ended_at IS NOT NULL AND ws.plan_id = ?
    ORDER BY ws.started_at DESC
  `, [planId]);
}

// ─── Bulk save ────────────────────────────────────────────────────────────────

interface ExerciseSaveData {
  cardExerciseId: number;
  exerciseId:     number;
  sets:           number;
  reps:           number;
  exerciseType:   'reps' | 'time' | 'bodyweight';
  duration:       number | null;
  groupId:        number | null;
  groupRounds:    number | null;
}

interface ExerciseProgressData {
  weights:    string[];
  isDone:     boolean;
  currentSet: number;
}

/**
 * Creates the session row, inserts all completed sets, and returns the new sessionId.
 * Called once at the very end of the workout (replaces createSession + per-set saveSet + finalizeSession).
 */
export function bulkSaveAndFinalize(
  planId:        number,
  cardId:        number,
  startedAt:     string,
  durationS:     number,
  exercises:     ExerciseSaveData[],
  progressItems: ExerciseProgressData[]
): number {
  const db = getDB();

  const result = db.runSync(
    'INSERT INTO workout_sessions (plan_id, card_id, started_at, ended_at, duration_s) VALUES (?, ?, ?, ?, ?)',
    [planId, cardId, startedAt, new Date().toISOString(), durationS]
  );
  const sessionId = Number(result.lastInsertRowId);

  exercises.forEach((ex, idx) => {
    const prog = progressItems[idx];
    if (!prog?.isDone) return;
    const nSets = ex.groupId != null ? (ex.groupRounds ?? 1) : ex.sets;
    for (let s = 0; s < nSets; s++) {
      const weightStr = prog.weights[s] ?? '';
      const w = weightStr ? parseFloat(weightStr) : null;
      const isTime = ex.exerciseType === 'time';
      saveSet(
        sessionId,
        ex.cardExerciseId,
        ex.exerciseId,
        s + 1,
        isTime ? (ex.duration ?? 0) : ex.reps,
        isTime ? null : (isNaN(w as number) ? null : w),
        ex.exerciseType
      );
    }
  });

  return sessionId;
}

export function saveSet(
  sessionId: number,
  cardExerciseId: number,
  exerciseId: number,
  setNumber: number,
  reps: number,
  weight: number | null,
  exerciseType: 'reps' | 'time' = 'reps'
): void {
  // Build SQL dynamically — never pass null as a bind param (expo-sqlite v15 bug)
  const cols: string[] = ['session_id', 'card_exercise_id', 'exercise_id', 'set_number', 'reps', 'completed_at', 'exercise_type'];
  const vals: (number | string)[] = [
    Number(sessionId), Number(cardExerciseId), Number(exerciseId),
    Number(setNumber), Number(reps), new Date().toISOString(), String(exerciseType),
  ];

  const safeWeight = weight != null ? Number(weight) : null;
  if (safeWeight !== null) { cols.push('weight'); vals.push(safeWeight); }

  getDB().runSync(
    `INSERT INTO session_sets (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    vals
  );
}
