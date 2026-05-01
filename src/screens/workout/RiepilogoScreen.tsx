import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';

import { COLORS } from '../../theme/colors';
import { getSessionSets, type SessionSetRow } from '../../database/sessionRepository';
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

interface ExerciseSummary { name: string; sets: SessionSetRow[] }

export default function RiepilogoScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteProps>();
  const { sessionId, durationS } = route.params;

  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);

  useEffect(() => {
    const sets = getSessionSets(sessionId);
    const map  = new Map<string, SessionSetRow[]>();
    for (const set of sets) {
      const key = `${set.card_exercise_id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(set);
    }
    const grouped: ExerciseSummary[] = [];
    map.forEach((s) => grouped.push({ name: s[0].exercise_name, sets: s }));
    setExercises(grouped);
  }, [sessionId]);

  const totalSets   = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const totalVolume = exercises.reduce((acc, ex) =>
    acc + ex.sets.reduce((a, s) =>
      s.exercise_type === 'time' ? a : a + (s.weight ?? 0) * s.reps, 0
    ), 0
  );

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

        {/* Esercizi */}
        {exercises.map((ex, idx) => (
          <View key={idx} style={styles.exerciseCard}>
            <View style={styles.accentBar} />
            <View style={styles.exerciseCardContent}>
              <Text style={styles.exerciseName}>{ex.name}</Text>
              <View style={styles.setsGrid}>
                {ex.sets.map((set) => (
                  <View key={set.set_number} style={styles.setChip}>
                    <Text style={styles.setChipLabel}>S{set.set_number}</Text>
                    {set.exercise_type === 'time' ? (
                      <Text style={[styles.setChipWeight, { color: COLORS.accent }]}>
                        {set.reps}s
                      </Text>
                    ) : (
                      <Text style={styles.setChipWeight}>
                        {set.weight != null ? `${set.weight} kg` : '—'}
                      </Text>
                    )}
                    {set.exercise_type !== 'time' && (
                      <Text style={styles.setChipReps}>{set.reps} reps</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}

      </ScrollView>

      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => navigation.popToTop()}
        activeOpacity={0.85}
      >
        <FontAwesome5 name="check" size={15} color={COLORS.text} solid />
        <Text style={styles.closeBtnText}>Chiudi</Text>
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
  exerciseName: {
    color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 12,
  },
  setsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  setChip: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    alignItems: 'center', minWidth: 72,
  },
  setChipLabel:  { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', marginBottom: 3 },
  setChipWeight: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  setChipReps:   { color: COLORS.textSub, fontSize: 10, marginTop: 2 },

  closeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface,
    margin: 12, borderRadius: 14, paddingVertical: 16,
    gap: 8,
    borderWidth: 1, borderColor: COLORS.border,
    elevation: 1,
  },
  closeBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
});
