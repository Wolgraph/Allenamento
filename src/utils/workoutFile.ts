import * as FileSystem from 'expo-file-system';
import * as Sharing    from 'expo-sharing';

import type { WorkoutCard, CardExerciseWithName, TrainingPlan } from '../types';
import { getPlan }           from '../database/planRepository';
import { getCardsForPlan }   from '../database/cardRepository';
import { getExercisesForCard } from '../database/cardExerciseRepository';

export const WORKOUT_MIME = 'application/x-workout';
export const WORKOUT_EXT  = '.workout';

// ─── Formato file ─────────────────────────────────────────────────────────────

export interface WorkoutFileGroup {
  key:       string;
  name:      string | null;
  type:      'superset' | 'circuit' | 'simple';
  rounds:    number;
  rest_time: number;
}

export interface WorkoutFileExercise {
  name:          string;
  sets:          number;
  reps:          number;
  rest_time:     number;
  exercise_type: 'reps' | 'time' | 'bodyweight';
  duration:      number | null;
  notes:         string | null;
  group_key:     string | null;
}

export interface WorkoutFileCard {
  name:        string;
  description: string | null;
  notes:       string | null;
  groups:      WorkoutFileGroup[];
  exercises:   WorkoutFileExercise[];
}

export interface WorkoutFilePlan {
  name:        string;
  description: string | null;
  cards:       WorkoutFileCard[];
}

export interface WorkoutFileData {
  mygymbuddy_version: 1;
  exported_at:        string;
  plan:               WorkoutFilePlan;
}

// ─── Build helpers ────────────────────────────────────────────────────────────

function buildCardSection(
  card:      WorkoutCard,
  exercises: CardExerciseWithName[]
): WorkoutFileCard {
  const groupIdToKey = new Map<number, string>();
  const groups: WorkoutFileGroup[] = [];
  let gIdx = 0;

  for (const ex of exercises) {
    if (ex.group_id != null && !groupIdToKey.has(ex.group_id)) {
      const key = `g${gIdx++}`;
      groupIdToKey.set(ex.group_id, key);
      groups.push({
        key,
        name:      ex.group_name      ?? null,
        type:      (ex.group_type     ?? 'superset') as 'superset' | 'circuit' | 'simple',
        rounds:    ex.group_rounds    ?? 3,
        rest_time: ex.group_rest_time ?? 90,
      });
    }
  }

  return {
    name:        card.name,
    description: card.description ?? null,
    notes:       card.notes       ?? null,
    groups,
    exercises: exercises.map(ex => ({
      name:          ex.exercise_name,
      sets:          ex.sets,
      reps:          ex.reps,
      rest_time:     ex.rest_time,
      exercise_type: ex.exercise_type as 'reps' | 'time' | 'bodyweight',
      duration:      ex.duration ?? null,
      notes:         ex.notes    ?? null,
      group_key:     ex.group_id != null
        ? (groupIdToKey.get(ex.group_id) ?? null)
        : null,
    })),
  };
}

export function buildPlanFile(
  plan:  TrainingPlan,
  cards: WorkoutCard[],
  exercisesByCardId: Map<number, CardExerciseWithName[]>
): WorkoutFileData {
  return {
    mygymbuddy_version: 1,
    exported_at: new Date().toISOString(),
    plan: {
      name:        plan.name,
      description: plan.description ?? null,
      cards: cards.map(card =>
        buildCardSection(card, exercisesByCardId.get(card.id) ?? [])
      ),
    },
  };
}

// ─── Export (file I/O + share) ────────────────────────────────────────────────

export async function exportPlanToFile(planId: number): Promise<void> {
  const plan = getPlan(planId);
  if (!plan) throw new Error('Piano non trovato.');

  const cards = getCardsForPlan(planId);
  const exercisesMap = new Map<number, CardExerciseWithName[]>();
  for (const card of cards) {
    exercisesMap.set(card.id, getExercisesForCard(card.id));
  }

  const data    = buildPlanFile(plan, cards, exercisesMap);
  const json    = JSON.stringify(data, null, 2);
  const fileName = workoutFileName(plan.name);
  const fileUri  = (FileSystem.cacheDirectory ?? '') + fileName;

  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: 'utf8',
  });
  await Sharing.shareAsync(fileUri, {
    mimeType:    WORKOUT_MIME,
    dialogTitle: 'Esporta piano',
  });
}

// ─── Parse ────────────────────────────────────────────────────────────────────

export function parseWorkoutFile(content: string): WorkoutFileData {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error('Il file non contiene JSON valido.');
  }
  const data = raw as Record<string, unknown>;
  if (data?.mygymbuddy_version !== 1) {
    throw new Error('Formato non riconosciuto o versione non supportata.');
  }
  const plan = data.plan as Record<string, unknown> | undefined;
  if (!plan || typeof plan.name !== 'string' || !Array.isArray(plan.cards)) {
    throw new Error('Struttura del file non valida (campo "plan" mancante o malformato).');
  }
  return data as unknown as WorkoutFileData;
}

// ─── Filename helper ──────────────────────────────────────────────────────────

export function workoutFileName(name: string): string {
  const safe = name
    .replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `${safe || 'piano'}${WORKOUT_EXT}`;
}
