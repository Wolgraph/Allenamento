import { getDB } from './db';
import type { Exercise, ExerciseWithMeta } from '../types';
import { SEED_TAGS, SEED_EXERCISES } from '../data/exercisesSeed';

export function getAllExercises(): Exercise[] {
  return getDB().getAllSync<Exercise>(
    'SELECT id, name FROM exercises ORDER BY name ASC'
  );
}

export function getAllExercisesWithMeta(): ExerciseWithMeta[] {
  return getDB().getAllSync<ExerciseWithMeta>(
    "SELECT id, name, COALESCE(default_type, 'reps') AS default_type, description, COALESCE(lang, 'it') AS lang FROM exercises ORDER BY name ASC"
  );
}

export function createExercise(name: string): Exercise {
  const db = getDB();
  const trimmed = name.trim();
  const result = db.runSync(
    "INSERT INTO exercises (name, default_type, lang) VALUES (?, 'reps', 'it')",
    [trimmed]
  );
  return { id: result.lastInsertRowId, name: trimmed };
}

export function findExerciseByName(name: string): Exercise | null {
  return getDB().getFirstSync<Exercise>(
    'SELECT id, name FROM exercises WHERE LOWER(name) = LOWER(?)',
    [name.trim()]
  ) ?? null;
}

export function exerciseExists(name: string): boolean {
  const row = getDB().getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM exercises WHERE LOWER(name) = LOWER(?)',
    [name.trim()]
  );
  return (row?.count ?? 0) > 0;
}

export function seedExercisesIfEmpty(): void {
  const db = getDB();

  const count = db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM exercises');
  if ((count?.n ?? 0) > 0) return;

  // Insert tags and capture name→id mapping
  const tagIdMap: Record<string, number> = {};
  for (const tag of SEED_TAGS) {
    const existing = db.getFirstSync<{ id: number }>(
      'SELECT id FROM exercise_tags WHERE name = ?', [tag.name]
    );
    if (existing) {
      tagIdMap[tag.name] = existing.id;
    } else {
      const r = db.runSync(
        'INSERT INTO exercise_tags (name, type) VALUES (?, ?)',
        [tag.name, tag.type]
      );
      tagIdMap[tag.name] = r.lastInsertRowId;
    }
  }

  // Insert exercises and tag mappings
  for (const ex of SEED_EXERCISES) {
    const safeDesc = ex.description ? ex.description : null;

    const cols = ['name', 'default_type', 'lang'];
    const vals: (string | number)[] = [ex.name, ex.default_type, ex.lang];
    if (safeDesc) { cols.push('description'); vals.push(safeDesc); }

    const r = db.runSync(
      `INSERT OR IGNORE INTO exercises (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      vals
    );

    let exerciseId = r.lastInsertRowId;
    if (r.changes === 0) {
      const row = db.getFirstSync<{ id: number }>(
        'SELECT id FROM exercises WHERE name = ?', [ex.name]
      );
      if (!row) continue;
      exerciseId = row.id;

      // Update meta columns for pre-existing rows (e.g. user-created before seed)
      if (safeDesc) {
        db.runSync(
          "UPDATE exercises SET default_type = ?, lang = ?, description = ? WHERE id = ?",
          [ex.default_type, ex.lang, safeDesc, exerciseId]
        );
      } else {
        db.runSync(
          "UPDATE exercises SET default_type = ?, lang = ? WHERE id = ?",
          [ex.default_type, ex.lang, exerciseId]
        );
      }
    }

    for (const tagName of ex.tags) {
      const tagId = tagIdMap[tagName];
      if (tagId == null) continue;
      try {
        db.runSync(
          'INSERT OR IGNORE INTO exercise_tag_map (exercise_id, tag_id) VALUES (?, ?)',
          [exerciseId, tagId]
        );
      } catch (_) {}
    }
  }
}
