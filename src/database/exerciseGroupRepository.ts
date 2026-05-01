import { getDB } from './db';
import type { ExerciseGroup, CardItem, CardExerciseWithName } from '../types';

export function getGroup(id: number): ExerciseGroup | null {
  return getDB().getFirstSync<ExerciseGroup>(
    'SELECT * FROM exercise_groups WHERE id = ?', [Number(id)]
  ) ?? null;
}

export function createGroup(
  cardId: number,
  type: 'superset' | 'circuit' | 'simple',
  rounds: number,
  restTime: number,
  name: string | null,
  sortOrder: number
): ExerciseGroup {
  const db = getDB();
  const safeName = name?.trim() || null;
  const cols: string[] = ['card_id', 'type', 'rounds', 'rest_time', 'sort_order'];
  const vals: (string | number)[] = [Number(cardId), type, Number(rounds), Number(restTime), Number(sortOrder)];
  if (safeName) { cols.push('name'); vals.push(safeName); }

  const result = db.runSync(
    `INSERT INTO exercise_groups (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    vals
  );
  return getGroup(Number(result.lastInsertRowId))!;
}

export function updateGroup(
  id: number,
  type: 'superset' | 'circuit' | 'simple',
  rounds: number,
  restTime: number,
  name: string | null
): void {
  const safeName = name?.trim() || null;
  const vals: (string | number)[] = [type, Number(rounds), Number(restTime)];
  const nameClause = safeName !== null ? (vals.push(safeName), '?') : 'NULL';
  vals.push(Number(id));

  getDB().runSync(
    `UPDATE exercise_groups SET type = ?, rounds = ?, rest_time = ?, name = ${nameClause} WHERE id = ?`,
    vals
  );
}

/** Set group_id on a card_exercise. Pass null to remove from group. */
export function setExerciseGroup(cardExerciseId: number, groupId: number | null): void {
  const db = getDB();
  if (groupId !== null) {
    db.runSync('UPDATE card_exercises SET group_id = ? WHERE id = ?', [Number(groupId), Number(cardExerciseId)]);
  } else {
    db.runSync('UPDATE card_exercises SET group_id = NULL WHERE id = ?', [Number(cardExerciseId)]);
  }
}

/** Dissolve a group: unlink all exercises, then delete the group row. */
export function dissolveGroup(groupId: number): void {
  const db = getDB();
  db.runSync('UPDATE card_exercises SET group_id = NULL WHERE group_id = ?', [Number(groupId)]);
  db.runSync('DELETE FROM exercise_groups WHERE id = ?', [Number(groupId)]);
}

/**
 * Persist the full order of card items after a drag-end.
 * - standalone exercises → card_exercises.sort_order = outer position
 * - groups → exercise_groups.sort_order = outer position
 *            + card_exercises.sort_order = inner position within group
 */
export function saveCardItemOrder(items: CardItem[]): void {
  const db = getDB();
  items.forEach((item, outerIdx) => {
    if (item.kind === 'exercise') {
      db.runSync('UPDATE card_exercises SET sort_order = ? WHERE id = ?', [outerIdx, Number(item.data.id)]);
    } else {
      db.runSync('UPDATE exercise_groups SET sort_order = ? WHERE id = ?', [outerIdx, Number(item.groupId)]);
      item.exercises.forEach((ex, innerIdx) => {
        db.runSync('UPDATE card_exercises SET sort_order = ? WHERE id = ?', [innerIdx, Number(ex.id)]);
      });
    }
  });
}

/**
 * After structural changes (create/dissolve group, add/remove exercise from group),
 * renumber all outer positions and inner group positions for a card.
 */
export function renumberCardItems(items: CardItem[]): void {
  saveCardItemOrder(items);
}

/**
 * Swap a group exercise one position up or down within its group.
 * `groupExercises` must already be sorted by sort_order ASC.
 */
export function moveExerciseInGroup(
  cardExerciseId: number,
  groupExercises: CardExerciseWithName[],
  direction: 'up' | 'down'
): void {
  const db  = getDB();
  const idx = groupExercises.findIndex(e => e.id === cardExerciseId);
  if (idx < 0) return;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= groupExercises.length) return;

  const aId    = Number(cardExerciseId);
  const bId    = Number(groupExercises[swapIdx].id);
  const aOrder = groupExercises[idx].sort_order;
  const bOrder = groupExercises[swapIdx].sort_order;

  db.runSync('UPDATE card_exercises SET sort_order = ? WHERE id = ?', [bOrder, aId]);
  db.runSync('UPDATE card_exercises SET sort_order = ? WHERE id = ?', [aOrder, bId]);
}
