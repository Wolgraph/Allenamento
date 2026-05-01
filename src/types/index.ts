export interface Exercise {
  id: number;
  name: string;
}

export interface ExerciseTag {
  id: number;
  name: string;
  type: 'zone' | 'muscle';
}

export interface ExerciseWithMeta extends Exercise {
  default_type: 'reps' | 'time' | 'bodyweight';
  description: string | null;
  lang: string;
  tags?: ExerciseTag[];
}

export interface TrainingPlan {
  id: number;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  created_at: string;
  card_count?: number;
}

export interface WorkoutCard {
  id: number;
  plan_id: number;
  name: string;
  description: string | null;
  notes: string | null;
  sort_order: number;
  exercise_count?: number;
}

export interface CardExercise {
  id: number;
  card_id: number;
  exercise_id: number;
  sets: number;
  reps: number;
  rest_time: number;
  notes: string | null;
  sort_order: number;
  exercise_type: 'reps' | 'time' | 'bodyweight';
  duration: number | null;
  group_id: number | null;
}

export interface CardExerciseWithName extends CardExercise {
  exercise_name: string;
  // Joined from exercise_groups (null when not in a group)
  group_type: 'superset' | 'circuit' | 'simple' | null;
  group_rounds: number | null;
  group_rest_time: number | null;
  group_name: string | null;
  group_sort_order: number | null;
}

export interface ExerciseGroup {
  id: number;
  card_id: number;
  type: 'superset' | 'circuit' | 'simple';
  name: string | null;
  rounds: number;
  rest_time: number;
  sort_order: number;
}

export type CardItem =
  | { kind: 'exercise'; data: CardExerciseWithName }
  | {
      kind: 'group';
      groupId: number;
      type: 'superset' | 'circuit' | 'simple';
      name: string | null;
      rounds: number;
      restTime: number;
      sortOrder: number;
      exercises: CardExerciseWithName[];
    };

export interface WorkoutSession {
  id: number;
  plan_id: number;
  card_id: number;
  started_at: string;
  ended_at: string | null;
  duration_s: number | null;
}

export interface SessionSet {
  id: number;
  session_id: number;
  card_exercise_id: number;
  exercise_id: number;
  set_number: number;
  reps: number;
  weight: number | null;
  completed_at: string;
}
