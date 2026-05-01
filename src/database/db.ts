import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDB(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('mygymtracker.db');
  }
  return _db;
}

export function initDatabase(): void {
  const db = getDB();
  db.execSync('PRAGMA foreign_keys = ON;');

  db.execSync(`
    CREATE TABLE IF NOT EXISTS exercises (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS training_plans (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT,
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS workout_cards (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id    INTEGER NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      description TEXT,
      notes      TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS card_exercises (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id       INTEGER NOT NULL REFERENCES workout_cards(id) ON DELETE CASCADE,
      exercise_id   INTEGER NOT NULL REFERENCES exercises(id),
      sets          INTEGER NOT NULL,
      reps          INTEGER NOT NULL,
      rest_time     INTEGER NOT NULL,
      notes         TEXT,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      exercise_type TEXT NOT NULL DEFAULT 'reps',
      duration      INTEGER
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id    INTEGER NOT NULL REFERENCES training_plans(id),
      card_id    INTEGER NOT NULL REFERENCES workout_cards(id),
      started_at DATETIME NOT NULL,
      ended_at   DATETIME,
      duration_s INTEGER
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS session_sets (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id       INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
      card_exercise_id INTEGER NOT NULL REFERENCES card_exercises(id),
      exercise_id      INTEGER NOT NULL REFERENCES exercises(id),
      set_number       INTEGER NOT NULL,
      reps             INTEGER NOT NULL,
      weight           REAL,
      completed_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      exercise_type    TEXT NOT NULL DEFAULT 'reps'
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS exercise_tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS exercise_tag_map (
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      tag_id      INTEGER NOT NULL REFERENCES exercise_tags(id) ON DELETE CASCADE,
      PRIMARY KEY (exercise_id, tag_id)
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS card_tag_map (
      card_id INTEGER NOT NULL REFERENCES workout_cards(id) ON DELETE CASCADE,
      tag_id  INTEGER NOT NULL REFERENCES exercise_tags(id) ON DELETE CASCADE,
      PRIMARY KEY (card_id, tag_id)
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS exercise_groups (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id    INTEGER NOT NULL REFERENCES workout_cards(id) ON DELETE CASCADE,
      type       TEXT NOT NULL DEFAULT 'superset',
      name       TEXT,
      rounds     INTEGER NOT NULL DEFAULT 3,
      rest_time  INTEGER NOT NULL DEFAULT 90,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Idempotent migrations — NO NOT NULL on ALTER TABLE (fails silently on older Android SQLite)
  try { db.execSync("ALTER TABLE card_exercises ADD COLUMN exercise_type TEXT DEFAULT 'reps'"); } catch (_) {}
  try { db.execSync('ALTER TABLE card_exercises ADD COLUMN duration INTEGER'); } catch (_) {}
  try { db.execSync("ALTER TABLE session_sets ADD COLUMN exercise_type TEXT DEFAULT 'reps'"); } catch (_) {}
  try { db.execSync("ALTER TABLE exercises ADD COLUMN default_type TEXT DEFAULT 'reps'"); } catch (_) {}
  try { db.execSync('ALTER TABLE exercises ADD COLUMN description TEXT'); } catch (_) {}
  try { db.execSync("ALTER TABLE exercises ADD COLUMN lang TEXT DEFAULT 'it'"); } catch (_) {}
  try { db.execSync('ALTER TABLE card_exercises ADD COLUMN group_id INTEGER'); } catch (_) {}
}
