import { getDB } from './db';
import type { TrainingPlan } from '../types';

export function getActivePlans(): TrainingPlan[] {
  return getDB().getAllSync<TrainingPlan>(`
    SELECT tp.*,
           (SELECT COUNT(*) FROM workout_cards WHERE plan_id = tp.id) AS card_count
    FROM training_plans tp
    WHERE tp.status = 'active'
    ORDER BY tp.created_at DESC
  `);
}

export function getArchivedPlans(): TrainingPlan[] {
  return getDB().getAllSync<TrainingPlan>(`
    SELECT tp.*,
           (SELECT COUNT(*) FROM workout_cards WHERE plan_id = tp.id) AS card_count
    FROM training_plans tp
    WHERE tp.status = 'archived'
    ORDER BY tp.created_at DESC
  `);
}

export function getPlan(id: number): TrainingPlan | null {
  return getDB().getFirstSync<TrainingPlan>(
    'SELECT * FROM training_plans WHERE id = ?',
    [id]
  ) ?? null;
}

export function createPlan(name: string, description: string | null): TrainingPlan {
  const db = getDB();

  // Never pass null as a bind param — omit column when value is null (expo-sqlite v15 bug)
  const safeDesc = description?.trim() || null;
  const cols: string[] = ['name'];
  const vals: string[] = [name.trim()];
  if (safeDesc) { cols.push('description'); vals.push(safeDesc); }

  const result = db.runSync(
    `INSERT INTO training_plans (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    vals
  );
  return getPlan(Number(result.lastInsertRowId))!;
}

export function updatePlan(id: number, name: string, description: string | null): void {
  const safeDesc = description?.trim() || null;
  const setClauses = [
    'name = ?',
    `description = ${safeDesc !== null ? '?' : 'NULL'}`,
  ];
  const vals: (string | number)[] = [name.trim()];
  if (safeDesc !== null) vals.push(safeDesc);
  vals.push(Number(id));

  getDB().runSync(
    `UPDATE training_plans SET ${setClauses.join(', ')} WHERE id = ?`,
    vals
  );
}

export function archivePlan(id: number): void {
  getDB().runSync(
    "UPDATE training_plans SET status = 'archived' WHERE id = ?",
    [Number(id)]
  );
}

export function reactivatePlan(id: number): void {
  getDB().runSync(
    "UPDATE training_plans SET status = 'active' WHERE id = ?",
    [Number(id)]
  );
}

export function deletePlan(id: number): void {
  getDB().runSync('DELETE FROM training_plans WHERE id = ?', [Number(id)]);
}
