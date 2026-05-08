import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';

import { COLORS } from '../../theme/colors';
import {
  getSessionSets,
  saveSet,
  finalizeSession,
  type SessionSetRow,
} from '../../database/sessionRepository';
import type { WorkoutStackParamList } from '../../navigation/types';

type NavProp    = NativeStackNavigationProp<WorkoutStackParamList, 'Riepilogo'>;
type RouteProps = RouteProp<WorkoutStackParamList, 'Riepilogo'>;

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

interface EditableSet {
  exerciseId?:   number;
  setNumber:     number;
  reps:          number;
  weight:        number | null;
  exerciseType:  'reps' | 'time';
}

interface ExerciseSummary {
  name:          string;
  cardExerciseId: number;
  exerciseId?:   number;
  sets:          EditableSet[];
}

export default function RiepilogoScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteProps>();
  const { sessionId, durationS, bufferedSets } = route.params;

  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);
  const [isSaving, setIsSaving]   = useState(false);

  useEffect(() => {
    if (bufferedSets && bufferedSets.length > 0) {
      const filteredSets = bufferedSets.filter(set => !set.skipped);
      const map = new Map<number, ExerciseSummary>();
      for (const set of filteredSets) {
        if (!map.has(set.cardExerciseId)) {
          map.set(set.cardExerciseId, {
            name: set.exerciseName,
            cardExerciseId: set.cardExerciseId,
            exerciseId: set.exerciseId,
            sets: [],
          });
        }
        map.get(set.cardExerciseId)!.sets.push({
          exerciseId: set.exerciseId,
          setNumber: set.setNumber,
          reps: set.reps,
          weight: set.weight,
          exerciseType: set.exerciseType,
        });
      }
      const grouped = Array.from(map.values()).map((item) => ({
        ...item,
        sets: item.sets.sort((a, b) => a.setNumber - b.setNumber),
      }));
      setExercises(grouped);
      return;
    }

    const sets = getSessionSets(sessionId);
    const map  = new Map<number, ExerciseSummary>();
    for (const set of sets) {
      if (!map.has(set.card_exercise_id)) {
        map.set(set.card_exercise_id, {
          name: set.exercise_name,
          cardExerciseId: set.card_exercise_id,
          sets: [],
        });
      }
      map.get(set.card_exercise_id)!.sets.push({
        setNumber: set.set_number,
        reps: set.reps,
        weight: set.weight,
        exerciseType: set.exercise_type,
      });
    }
    setExercises(Array.from(map.values()));
  }, [sessionId, bufferedSets]);

  const totalSets = useMemo(
    () => exercises.reduce((acc, ex) => acc + ex.sets.length, 0),
    [exercises],
  );

  const totalVolume = useMemo(
    () => exercises.reduce((acc, ex) =>
      acc + ex.sets.reduce((a, s) =>
        s.exerciseType === 'time' ? a : a + (s.weight ?? 0) * s.reps, 0
      ), 0),
    [exercises],
  );

  const updateSetField = (
    exerciseIndex: number,
    setIndex: number,
    field: 'reps' | 'weight',
    value: string,
  ) => {
    setExercises((prev) => {
      const next = [...prev];
      const setItem = { ...next[exerciseIndex].sets[setIndex] };
      if (field === 'reps') {
        const parsed = parseInt(value, 10);
        setItem.reps = Number.isNaN(parsed) ? 0 : parsed;
      } else {
        const parsed = parseFloat(value.replace(',', '.'));
        setItem.weight = Number.isNaN(parsed) ? null : parsed;
      }
      next[exerciseIndex].sets[setIndex] = setItem;
      return next;
    });
  };

  const addSet = (exerciseIndex: number) => {
    setExercises((prev) => {
      const next = [...prev];
      const exercise = next[exerciseIndex];
      const last = exercise.sets[exercise.sets.length - 1];
      exercise.sets = [
        ...exercise.sets,
        {
          exerciseId: exercise.exerciseId,
          setNumber: exercise.sets.length + 1,
          reps: last?.reps ?? 0,
          weight: null,
          exerciseType: last?.exerciseType ?? 'reps',
        },
      ];
      return next;
    });
  };

  const removeSet = (exerciseIndex: number) => {
    setExercises((prev) => {
      const next = [...prev];
      const exercise = next[exerciseIndex];
      if (exercise.sets.length <= 1) return next;
      exercise.sets = exercise.sets.slice(0, -1).map((set, index) => ({
        ...set,
        setNumber: index + 1,
      }));
      return next;
    });
  };

  const handleConfirm = () => {
    if (!bufferedSets || bufferedSets.length === 0) {
      finalizeSession(sessionId, durationS);
      navigation.popToTop();
      return;
    }

    setIsSaving(true);
    const filteredSets = bufferedSets.filter(set => !set.skipped);
    const map = new Map<number, EditableSet[]>();
    for (const set of filteredSets) {
      if (!map.has(set.cardExerciseId)) map.set(set.cardExerciseId, []);
      map.get(set.cardExerciseId)!.push({
        exerciseId: set.exerciseId,
        setNumber: set.setNumber,
        reps: set.reps,
        weight: set.weight,
        exerciseType: set.exerciseType,
      });
    }
    for (const exercise of exercises) {
      const originalSets = map.get(exercise.cardExerciseId) || [];
      for (const set of exercise.sets) {
        const original = originalSets.find(s => s.setNumber === set.setNumber);
        if (original) {
          if (set.exerciseType === 'time') {
            saveSet(
              sessionId,
              exercise.cardExerciseId,
              set.exerciseId ?? 0,
              set.setNumber,
              set.reps,
              null,
              'time',
            );
          } else {
            saveSet(
              sessionId,
              exercise.cardExerciseId,
              set.exerciseId ?? 0,
              set.setNumber,
              set.reps,
              set.weight,
              'reps',
            );
          }
        }
      }
    }
    finalizeSession(sessionId, durationS);
    navigation.popToTop();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.trophyCircle}>
            <FontAwesome5 name="trophy" size={36} color="#F59E0B" solid />
          </View>
          <Text style={styles.title}>Allenamento completato!</Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <FontAwesome5 name="stopwatch" size={16} color={COLORS.primary} solid />
              <Text style={styles.statValue}>{formatDuration(durationS)}</Text>
              <Text style={styles.statLabel}>Durata</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <FontAwesome5 name="layer-group" size={16} color={COLORS.success} solid />
              <Text style={styles.statValue}>{totalSets}</Text>
              <Text style={styles.statLabel}>Serie</Text>
            </View>
            {totalVolume > 0 && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <FontAwesome5 name="weight-hanging" size={16} color={COLORS.accent} solid />
                  <Text style={styles.statValue}>{totalVolume.toLocaleString('it')} kg</Text>
                  <Text style={styles.statLabel}>Volume</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {exercises.map((ex, idx) => (
          <View key={ex.cardExerciseId} style={styles.exerciseCard}>
            <View style={styles.accentBar} />
            <View style={styles.exerciseCardContent}>
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseName}>{ex.name}</Text>
                {bufferedSets ? (
                  <View style={styles.exerciseSetControls}>
                    <TouchableOpacity style={styles.setControlBtn} onPress={() => removeSet(idx)} activeOpacity={0.75}>
                      <Text style={styles.setControlText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.setControlCount}>{ex.sets.length}</Text>
                    <TouchableOpacity style={styles.setControlBtn} onPress={() => addSet(idx)} activeOpacity={0.75}>
                      <Text style={styles.setControlText}>+</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
              <View style={styles.setsList}>
                {ex.sets.map((set, setIdx) => (
                  <View key={setIdx} style={styles.setRow}>
                    <Text style={styles.setRowLabel}>S{set.setNumber}</Text>
                    <View style={styles.setField}>
                      <Text style={styles.setFieldLabel}>Rip.</Text>
                      <TextInput
                        style={styles.setInput}
                        value={String(set.reps)}
                        keyboardType="number-pad"
                        onChangeText={(value) => updateSetField(idx, setIdx, 'reps', value)}
                      />
                    </View>
                    {set.exerciseType === 'time' ? (
                      <View style={styles.setField}>
                        <Text style={styles.setFieldLabel}>Durata</Text>
                        <Text style={styles.setText}>{set.reps}s</Text>
                      </View>
                    ) : (
                      <View style={styles.setField}>
                        <Text style={styles.setFieldLabel}>Peso</Text>
                        <TextInput
                          style={styles.setInput}
                          value={set.weight != null ? String(set.weight) : ''}
                          keyboardType="decimal-pad"
                          onChangeText={(value) => updateSetField(idx, setIdx, 'weight', value)}
                          placeholder="—"
                          placeholderTextColor={COLORS.textMuted}
                        />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.closeBtn, bufferedSets ? styles.confirmBtn : null]}
        onPress={handleConfirm}
        activeOpacity={0.85}
        disabled={isSaving}
      >
        <FontAwesome5 name={bufferedSets ? 'check' : 'check'} size={15} color={COLORS.text} solid />
        <Text style={styles.closeBtnText}>{bufferedSets ? 'Conferma allenamento' : 'Chiudi'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content:   { padding: 16, gap: 12, paddingBottom: 8 },

  header: {
    backgroundColor: COLORS.surface,
    borderRadius: 18, padding: 24,
    alignItems: 'center', gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  trophyCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#F59E0B' + '20',
    borderWidth: 2, borderColor: '#F59E0B' + '50',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    color: COLORS.text, fontSize: 22, fontWeight: '700', textAlign: 'center',
  },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 16,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 10,
    width: '100%',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginTop: 2 },
  statLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '500' },
  statDivider: { width: 1, height: 40, backgroundColor: COLORS.border },

  exerciseCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14, overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  accentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 4, backgroundColor: COLORS.primary,
  },
  exerciseCardContent: { paddingLeft: 20, paddingRight: 14, paddingVertical: 14 },
  exerciseHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  exerciseName: { color: COLORS.text, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 10 },
  exerciseSetControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setControlBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  setControlText: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  setControlCount: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  setsList: { gap: 10 },
  setRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12, padding: 12,
  },
  setRowLabel: { width: 28, color: COLORS.text, fontWeight: '700' },
  setField: { flex: 1 },
  setFieldLabel: { color: COLORS.textMuted, fontSize: 11, marginBottom: 4 },
  setInput: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 14,
  },
  setText: { color: COLORS.text, fontSize: 14, fontWeight: '700' },

  closeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface,
    margin: 12, borderRadius: 14, paddingVertical: 16,
    gap: 8,
    borderWidth: 1, borderColor: COLORS.border,
    elevation: 1,
  },
  confirmBtn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  closeBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
});
