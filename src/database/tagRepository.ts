import { getDB } from './db';
import type { ExerciseTag, ExerciseWithMeta } from '../types';

export function getAllTags(): ExerciseTag[] {
  return getDB().getAllSync<ExerciseTag>(
    'SELECT id, name, type FROM exercise_tags ORDER BY type DESC, name ASC'
  );
}

export function getTagsForExercise(exerciseId: number): ExerciseTag[] {
  return getDB().getAllSync<ExerciseTag>(`
    SELECT t.id, t.name, t.type
    FROM exercise_tags t
    JOIN exercise_tag_map m ON m.tag_id = t.id
    WHERE m.exercise_id = ?
    ORDER BY t.type DESC, t.name ASC
  `, [exerciseId]);
}

export function getExercisesByTag(tagId: number): ExerciseWithMeta[] {
  return getDB().getAllSync<ExerciseWithMeta>(`
    SELECT e.id, e.name, e.default_type, e.description, e.lang
    FROM exercises e
    JOIN exercise_tag_map m ON m.exercise_id = e.id
    WHERE m.tag_id = ?
    ORDER BY e.name ASC
  `, [tagId]);
}

export function getExercisesByTagName(tagName: string): ExerciseWithMeta[] {
  return getDB().getAllSync<ExerciseWithMeta>(`
    SELECT e.id, e.name, e.default_type, e.description, e.lang
    FROM exercises e
    JOIN exercise_tag_map m ON m.exercise_id = e.id
    JOIN exercise_tags t ON t.id = m.tag_id
    WHERE LOWER(t.name) = LOWER(?)
    ORDER BY e.name ASC
  `, [tagName]);
}

export function getAllExercisesWithTags(): ExerciseWithMeta[] {
  const db = getDB();
  const exercises = db.getAllSync<ExerciseWithMeta>(
    'SELECT id, name, default_type, description, lang FROM exercises ORDER BY name ASC'
  );
  for (const ex of exercises) {
    ex.tags = getTagsForExercise(ex.id);
  }
  return exercises;
}
