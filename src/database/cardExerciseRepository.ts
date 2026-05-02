import { getDB } from './db';
import type { CardExerciseWithName } from '../types';

export function getExercisesForCard(cardId: number): CardExerciseWithName[] {
  return getDB().getAllSync<CardExerciseWithName>(`
    SELECT ce.*,
           e.name        AS exercise_name,
           e.description AS exercise_description,
           eg.type       AS group_type,
           eg.rounds     AS group_rounds,
           eg.rest_time  AS group_rest_time,
           eg.name       AS group_name,
           eg.sort_order AS group_sort_order
    FROM card_exercises ce
    JOIN exercises e ON ce.exercise_id = e.id
    LEFT JOIN exercise_groups eg ON ce.group_id = eg.id
    WHERE ce.card_id = ?
    ORDER BY COALESCE(eg.sort_order, ce.sort_order) ASC, ce.sort_order ASC, ce.id ASC
  `, [cardId]);
}

export function getCardExercise(id: number): CardExerciseWithName | null {
  return getDB().getFirstSync<CardExerciseWithName>(`
    SELECT ce.*,
           e.name        AS exercise_name,
           e.description AS exercise_description,
           eg.type       AS group_type,
           eg.rounds     AS group_rounds,
           eg.rest_time  AS group_rest_time,
           eg.name       AS group_name,
           eg.sort_order AS group_sort_order
    FROM card_exercises ce
    JOIN exercises e ON ce.exercise_id = e.id
    LEFT JOIN exercise_groups eg ON ce.group_id = eg.id
    WHERE ce.id = ?
  `, [id]) ?? null;
}

export function addExerciseToCard(
  cardId: number,
  exerciseId: number,
  sets: number,
  reps: number,
  restTime: number,
  notes: string | null,
  exerciseType: 'reps' | 'time' | 'bodyweight' = 'reps',
  duration: number | null = null
): number {
  const db = getDB();
  const maxOrder = db.getFirstSync<{ max_order: number | null }>(
    'SELECT MAX(sort_order) AS max_order FROM card_exercises WHERE card_id = ?',
    [cardId]
  );
  const nextOrder = (maxOrder?.max_order ?? -1) + 1;

  // Build SQL dynamically — never pass null as a bind param (expo-sqlite v15 bug with null in positional params)
  const cols: string[] = ['card_id', 'exercise_id', 'sets', 'reps', 'rest_time', 'sort_order', 'exercise_type'];
  const vals: (number | string)[] = [
    Number(cardId), Number(exerciseId), Number(sets), Number(reps),
    Number(restTime), Number(nextOrder), String(exerciseType),
  ];

  const safeNotes = notes != null ? String(notes).trim() : null;
  if (safeNotes) { cols.push('notes'); vals.push(safeNotes); }

  if (duration != null) { cols.push('duration'); vals.push(Number(duration)); }

  const result = db.runSync(
    `INSERT INTO card_exercises (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    vals
  );
  return Number(result.lastInsertRowId);
}

export function updateExerciseInCard(
  id: number,
  exerciseId: number,
  sets: number,
  reps: number,
  restTime: number,
  notes: string | null,
  exerciseType: 'reps' | 'time' | 'bodyweight' = 'reps',
  duration: number | null = null
): void {
  // SET notes and duration explicitly to NULL using SQL literal — avoid null bind params
  const safeNotes    = notes != null ? String(notes).trim() : null;
  const safeDuration = duration != null ? Number(duration) : null;

  const setClauses: string[] = [
    'exercise_id = ?', 'sets = ?', 'reps = ?', 'rest_time = ?',
    `notes = ${safeNotes !== null ? '?' : 'NULL'}`,
    'exercise_type = ?',
    `duration = ${safeDuration !== null ? '?' : 'NULL'}`,
  ];
  const vals: (number | string)[] = [
    Number(exerciseId), Number(sets), Number(reps), Number(restTime),
  ];
  if (safeNotes !== null) vals.push(safeNotes);
  vals.push(String(exerciseType));
  if (safeDuration !== null) vals.push(safeDuration);
  vals.push(Number(id));

  getDB().runSync(
    `UPDATE card_exercises SET ${setClauses.join(', ')} WHERE id = ?`,
    vals
  );
}

export function deleteExerciseFromCard(id: number): void {
  getDB().runSync('DELETE FROM card_exercises WHERE id = ?', [id]);
}

export function reorderExercises(orderedIds: number[]): void {
  const db = getDB();
  orderedIds.forEach((id, index) => {
    db.runSync('UPDATE card_exercises SET sort_order = ? WHERE id = ?', [index, Number(id)]);
  });
}

export function getLastWeightForExercise(
  exerciseId: number,
  reps: number
): number | null {
  const row = getDB().getFirstSync<{ weight: number | null }>(`
    SELECT ss.weight
    FROM session_sets ss
    WHERE ss.exercise_id = ? AND ss.reps = ? AND ss.weight IS NOT NULL
    ORDER BY ss.completed_at DESC
    LIMIT 1
  `, [exerciseId, reps]);
  return row?.weight ?? null;
}
