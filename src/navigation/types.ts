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
  Riepilogo:         { sessionId: number; durationS: number };
};

export type RootTabParamList = {
  Piani:        undefined;
  Allenamento:  undefined;
  Catalogo:     undefined;
  Storico:      undefined;
  Impostazioni: undefined;
};
