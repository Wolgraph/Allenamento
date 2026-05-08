import type { WorkoutFileData } from '../utils/workoutFile';

export type PianiStackParamList = {
  PianiAttivi:       undefined;
  CreaPiano:         { pianoId?: number };
  DettaglioPiano:    { pianoId: number };
  CreaScheda:        { pianoId: number; schedaId?: number };
  DettaglioScheda:   { schedaId: number; pianoId: number };
  AggiungiEsercizio: { schedaId: number; cardExerciseId?: number };
  ImportScheda:      { workoutData: WorkoutFileData };
};

export type WorkoutStackParamList = {
  SceltaScheda:      undefined;
  AllenamentoAttivo: { cardId: number; planId: number; cardName: string };
  Riepilogo:         { sessionId: number; durationS: number; bufferedSets?: Array<{ exerciseName: string; cardExerciseId: number; exerciseId: number; setNumber: number; reps: number; weight: number | null; exerciseType: 'reps' | 'time'; skipped?: boolean; }> };
};

export type RootTabParamList = {
  Piani:        undefined;
  Allenamento:  undefined;
  Catalogo:     undefined;
  Storico:      undefined;
  Impostazioni: undefined;
};
