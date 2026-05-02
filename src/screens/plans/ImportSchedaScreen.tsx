import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';

import { COLORS } from '../../theme/colors';
import { getActivePlans, createPlan } from '../../database/planRepository';
import { createCard } from '../../database/cardRepository';
import { addExerciseToCard } from '../../database/cardExerciseRepository';
import { createGroup, setExerciseGroup } from '../../database/exerciseGroupRepository';
import { findExerciseByName, createExercise } from '../../database/exerciseRepository';
import type { PianiStackParamList } from '../../navigation/types';
import type { WorkoutFileCard, WorkoutFileExercise } from '../../utils/workoutFile';

type NavProp    = NativeStackNavigationProp<PianiStackParamList, 'ImportScheda'>;
type RouteProps = RouteProp<PianiStackParamList, 'ImportScheda'>;

const TYPE_META: Record<string, { icon: string; color: string }> = {
  reps:       { icon: 'dumbbell',  color: COLORS.primary },
  time:       { icon: 'stopwatch', color: COLORS.accent  },
  bodyweight: { icon: 'running',   color: COLORS.success },
};

function formatRest(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

function groupTypeLabel(type: string): string {
  return type === 'superset' ? 'SUPERSERIE' : type === 'circuit' ? 'CIRCUITO' : 'GRUPPO';
}
function groupTypeIcon(type: string): string {
  return type === 'superset' ? 'bolt' : type === 'circuit' ? 'redo-alt' : 'layer-group';
}
function groupTypeColor(type: string): string {
  return type === 'superset' ? COLORS.accent : type === 'circuit' ? COLORS.primary : COLORS.success;
}

function resolveUniqueName(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base} (${i})`)) i++;
  return `${base} (${i})`;
}

function importCard(planId: number, card: WorkoutFileCard): void {
  const newCard = createCard(planId, card.name, card.description, card.notes);

  const groupKeyToId = new Map<string, number>();
  (card.groups ?? []).forEach((g, idx) => {
    const grp = createGroup(newCard.id, g.type, g.rounds, g.rest_time, g.name, idx);
    groupKeyToId.set(g.key, grp.id);
  });

  (card.exercises ?? []).forEach((ex: WorkoutFileExercise) => {
    const found    = findExerciseByName(ex.name);
    const exercise = found ?? createExercise(ex.name);
    const ceId     = addExerciseToCard(
      newCard.id, exercise.id, ex.sets, ex.reps, ex.rest_time,
      ex.notes, ex.exercise_type, ex.duration
    );
    if (ex.group_key) {
      const groupId = groupKeyToId.get(ex.group_key);
      if (groupId != null) setExerciseGroup(ceId, groupId);
    }
  });
}

export default function ImportSchedaScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteProps>();
  const { workoutData } = route.params;
  const { plan } = workoutData;
  const insets = useSafeAreaInsets();

  const [importing, setImporting] = useState(false);

  const resolvedName = useMemo(() => {
    const existing = new Set(getActivePlans().map(p => p.name));
    return resolveUniqueName(plan.name, existing);
  }, [plan.name]);

  const nameChanged = resolvedName !== plan.name;

  const handleImport = () => {
    setImporting(true);
    try {
      const newPlan = createPlan(resolvedName, plan.description ?? null);
      for (const card of plan.cards) {
        importCard(newPlan.id, card);
      }
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: 'PianiAttivi' },
            { name: 'DettaglioPiano', params: { pianoId: newPlan.id } },
          ],
        })
      );
    } catch (e: any) {
      setImporting(false);
      Alert.alert('Errore importazione', e?.message ?? String(e));
    }
  };

  const totalExercises = plan.cards.reduce((sum, c) => sum + (c.exercises?.length ?? 0), 0);
  const totalGroups    = plan.cards.reduce((sum, c) => sum + (c.groups?.length ?? 0), 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}
      >
        {/* Anteprima piano */}
        <View style={styles.planPreview}>
          <View style={styles.planPreviewIcon}>
            <FontAwesome5 name="clipboard-list" size={20} color={COLORS.primary} solid />
          </View>
          <View style={styles.planPreviewInfo}>
            <Text style={styles.planPreviewName}>{resolvedName}</Text>
            {nameChanged && (
              <View style={styles.renamedBadge}>
                <FontAwesome5 name="info-circle" size={10} color={COLORS.accent} solid />
                <Text style={styles.renamedText}>rinominato da "{plan.name}"</Text>
              </View>
            )}
            {plan.description ? (
              <Text style={styles.planPreviewDesc}>{plan.description}</Text>
            ) : null}
            <View style={styles.statsRow}>
              <View style={styles.statBadge}>
                <FontAwesome5 name="th-list" size={9} color={COLORS.textSub} solid />
                <Text style={styles.statText}>{plan.cards.length} {plan.cards.length === 1 ? 'scheda' : 'schede'}</Text>
              </View>
              <View style={styles.statBadge}>
                <FontAwesome5 name="dumbbell" size={9} color={COLORS.textSub} solid />
                <Text style={styles.statText}>{totalExercises} esercizi</Text>
              </View>
              {totalGroups > 0 && (
                <View style={styles.statBadge}>
                  <FontAwesome5 name="object-group" size={9} color={COLORS.accent} solid />
                  <Text style={[styles.statText, { color: COLORS.accent }]}>{totalGroups} gruppi</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Lista schede */}
        <Text style={styles.sectionLabel}>Schede incluse</Text>
        <View style={styles.cardList}>
          {plan.cards.map((card, cardIdx) => {
            const groupMeta = new Map((card.groups ?? []).map(g => [g.key, g]));

            type Row =
              | { kind: 'standalone'; ex: WorkoutFileExercise }
              | { kind: 'group-header'; groupKey: string }
              | { kind: 'group-ex'; ex: WorkoutFileExercise };
            const rows: Row[] = [];
            const seen = new Set<string>();
            for (const ex of card.exercises) {
              if (ex.group_key) {
                if (!seen.has(ex.group_key)) { seen.add(ex.group_key); rows.push({ kind: 'group-header', groupKey: ex.group_key }); }
                rows.push({ kind: 'group-ex', ex });
              } else {
                rows.push({ kind: 'standalone', ex });
              }
            }

            return (
              <View key={cardIdx} style={styles.cardBlock}>
                <View style={styles.cardBlockHeader}>
                  <FontAwesome5 name="clipboard" size={12} color={COLORS.primary} solid />
                  <Text style={styles.cardBlockName}>{card.name}</Text>
                  <View style={styles.cardBlockBadge}>
                    <Text style={styles.cardBlockBadgeText}>{card.exercises.length} es.</Text>
                  </View>
                </View>
                {card.description ? (
                  <Text style={styles.cardBlockDesc}>{card.description}</Text>
                ) : null}

                {rows.map((row, rowIdx) => {
                  if (row.kind === 'group-header') {
                    const g = groupMeta.get(row.groupKey);
                    const tc = groupTypeColor(g?.type ?? 'simple');
                    return (
                      <View key={`gh-${rowIdx}`} style={styles.groupHeader}>
                        <View style={[styles.groupBadge, { backgroundColor: tc + '22', borderColor: tc + '55' }]}>
                          <FontAwesome5 name={groupTypeIcon(g?.type ?? 'simple')} size={9} color={tc} solid />
                          <Text style={[styles.groupBadgeText, { color: tc }]}>{groupTypeLabel(g?.type ?? 'simple')}</Text>
                        </View>
                        {g?.type !== 'simple' && (
                          <Text style={styles.groupMeta}>{g ? `${g.rounds} giri · ${formatRest(g.rest_time)} rec.` : ''}</Text>
                        )}
                        {g?.name ? <Text style={styles.groupName}>{g.name}</Text> : null}
                      </View>
                    );
                  }
                  const ex = row.ex;
                  const tm = TYPE_META[ex.exercise_type] ?? TYPE_META.reps;
                  return (
                    <View key={`ex-${rowIdx}`} style={[styles.exRow, row.kind === 'group-ex' && styles.exRowGrouped]}>
                      <View style={[styles.typeDot, { backgroundColor: tm.color + '22' }]}>
                        <FontAwesome5 name={tm.icon} size={10} color={tm.color} solid />
                      </View>
                      <View style={styles.exInfo}>
                        <Text style={styles.exName}>{ex.name}</Text>
                        <View style={styles.exTags}>
                          <Text style={styles.exTag}>{ex.sets} serie</Text>
                          {ex.exercise_type === 'time'
                            ? <Text style={styles.exTag}>{formatRest(ex.duration ?? 0)}</Text>
                            : <Text style={styles.exTag}>{ex.reps} reps</Text>
                          }
                          <Text style={styles.exTag}>{formatRest(ex.rest_time)} rec.</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>

        {/* Pulsante importa */}
        <TouchableOpacity
          style={[styles.importBtn, importing && styles.importBtnDisabled]}
          onPress={handleImport}
          disabled={importing}
          activeOpacity={0.85}
        >
          <FontAwesome5 name={importing ? 'hourglass-half' : 'download'} size={15} color={COLORS.white} solid />
          <Text style={styles.importBtnText}>
            {importing ? 'Importazione...' : `Importa piano`}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content:   { padding: 16 },

  sectionLabel: {
    color: COLORS.textSub, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 10,
  },

  planPreview: {
    backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 16, marginBottom: 24,
    borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
  },
  planPreviewIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  planPreviewInfo: { flex: 1, gap: 4 },
  planPreviewName: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  planPreviewDesc: { color: COLORS.textSub, fontSize: 13, lineHeight: 18 },
  renamedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.accent + '18',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, alignSelf: 'flex-start',
  },
  renamedText: { color: COLORS.accent, fontSize: 11, fontWeight: '500' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  statBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  statText: { color: COLORS.textSub, fontSize: 11, fontWeight: '500' },

  cardList: { gap: 10 },
  cardBlock: {
    backgroundColor: COLORS.surface,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardBlockHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
  },
  cardBlockName: { color: COLORS.text, fontSize: 14, fontWeight: '700', flex: 1 },
  cardBlockBadge: {
    backgroundColor: COLORS.primary + '1A', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  cardBlockBadgeText: { color: COLORS.primary, fontSize: 11, fontWeight: '600' },
  cardBlockDesc: {
    color: COLORS.textSub, fontSize: 12, lineHeight: 18,
    paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border + '60',
  },

  groupHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    gap: 8,
  },
  groupBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 5, borderWidth: 1,
  },
  groupBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  groupMeta:      { color: COLORS.textMuted, fontSize: 11, flex: 1 },
  groupName:      { color: COLORS.textSub, fontSize: 11 },

  exRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11,
    borderTopWidth: 1, borderTopColor: COLORS.border + '60',
    gap: 12,
  },
  exRowGrouped: { paddingLeft: 22 },
  typeDot: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  exInfo:  { flex: 1 },
  exName:  { color: COLORS.text, fontSize: 13, fontWeight: '600', marginBottom: 3 },
  exTags:  { flexDirection: 'row', gap: 8 },
  exTag:   { color: COLORS.textMuted, fontSize: 11 },

  importBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginTop: 28,
  },
  importBtnDisabled: { opacity: 0.5 },
  importBtnText:     { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
