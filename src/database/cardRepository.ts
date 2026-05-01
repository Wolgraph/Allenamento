import { getDB } from './db';
import type { WorkoutCard, ExerciseTag } from '../types';

export function getCardsForPlan(planId: number): WorkoutCard[] {
  return getDB().getAllSync<WorkoutCard>(`
    SELECT wc.*,
           (SELECT COUNT(*) FROM card_exercises WHERE card_id = wc.id) AS exercise_count
    FROM workout_cards wc
    WHERE wc.plan_id = ?
    ORDER BY wc.sort_order ASC, wc.id ASC
  `, [planId]);
}

export function getCard(id: number): WorkoutCard | null {
  return getDB().getFirstSync<WorkoutCard>(
    'SELECT * FROM workout_cards WHERE id = ?',
    [id]
  ) ?? null;
}

export function createCard(
  planId: number,
  name: string,
  description: string | null,
  notes: string | null
): WorkoutCard {
  const db = getDB();
  const maxOrder = db.getFirstSync<{ max_order: number | null }>(
    'SELECT MAX(sort_order) AS max_order FROM workout_cards WHERE plan_id = ?',
    [planId]
  );
  const nextOrder = (maxOrder?.max_order ?? -1) + 1;

  // Never pass null as a bind param — omit column when value is null (expo-sqlite v15 bug)
  const safeDesc  = description?.trim() || null;
  const safeNotes = notes?.trim() || null;
  const cols: string[] = ['plan_id', 'name', 'sort_order'];
  const vals: (string | number)[] = [Number(planId), name.trim(), Number(nextOrder)];
  if (safeDesc)  { cols.push('description'); vals.push(safeDesc); }
  if (safeNotes) { cols.push('notes');       vals.push(safeNotes); }

  const result = db.runSync(
    `INSERT INTO workout_cards (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    vals
  );
  return getCard(Number(result.lastInsertRowId))!;
}

export function updateCard(
  id: number,
  name: string,
  description: string | null,
  notes: string | null
): void {
  const safeDesc  = description?.trim() || null;
  const safeNotes = notes?.trim() || null;
  const setClauses = [
    'name = ?',
    `description = ${safeDesc  !== null ? '?' : 'NULL'}`,
    `notes = ${safeNotes !== null ? '?' : 'NULL'}`,
  ];
  const vals: (string | number)[] = [name.trim()];
  if (safeDesc  !== null) vals.push(safeDesc);
  if (safeNotes !== null) vals.push(safeNotes);
  vals.push(Number(id));

  getDB().runSync(
    `UPDATE workout_cards SET ${setClauses.join(', ')} WHERE id = ?`,
    vals
  );
}

export function deleteCard(id: number): void {
  getDB().runSync('DELETE FROM workout_cards WHERE id = ?', [Number(id)]);
}

export function reorderCards(orderedIds: number[]): void {
  const db = getDB();
  orderedIds.forEach((id, index) => {
    db.runSync('UPDATE workout_cards SET sort_order = ? WHERE id = ?', [index, Number(id)]);
  });
}

export function getTagsForCard(cardId: number): ExerciseTag[] {
  return getDB().getAllSync<ExerciseTag>(`
    SELECT t.id, t.name, t.type
    FROM exercise_tags t
    JOIN card_tag_map m ON m.tag_id = t.id
    WHERE m.card_id = ?
    ORDER BY t.name ASC
  `, [Number(cardId)]);
}

export function setTagsForCard(cardId: number, tagIds: number[]): void {
  const db = getDB();
  db.runSync('DELETE FROM card_tag_map WHERE card_id = ?', [Number(cardId)]);
  for (const tagId of tagIds) {
    try {
      db.runSync(
        'INSERT INTO card_tag_map (card_id, tag_id) VALUES (?, ?)',
        [Number(cardId), Number(tagId)]
      );
    } catch (_) {}
  }
}
