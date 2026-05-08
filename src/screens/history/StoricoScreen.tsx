import React, { useCallback, useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';

import { COLORS } from '../../theme/colors';
import {
  getCompletedSessions, getCompletedSessionsForPlan,
  getSessionSets, deleteSessionWithSets,
  type SessionRow, type SessionSetRow,
} from '../../database/sessionRepository';
import { getActivePlans, getArchivedPlans } from '../../database/planRepository';
import { exportSessionsToCsv } from '../../utils/exportCsv';
import type { TrainingPlan } from '../../types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function dayLabel(iso: string): string {
  const d     = new Date(iso);
  const today = new Date();
  const yest  = new Date(today);
  yest.setDate(yest.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

  if (sameDay(d, today)) return 'Oggi';
  if (sameDay(d, yest))  return 'Ieri';

  const months = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

interface SessionWithSets extends SessionRow {
  sets: SessionSetRow[];
  expanded: boolean;
}

interface SectionData {
  title: string;
  data: SessionWithSets[];
}

function groupByDay(sessions: SessionWithSets[]): SectionData[] {
  const map = new Map<string, SessionWithSets[]>();
  for (const s of sessions) {
    const key = new Date(s.started_at).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries()).map(([key, data]) => ({
    title: dayLabel(data[0].started_at),
    data,
  }));
}

function groupSets(sets: SessionSetRow[]) {
  const map = new Map<string, { name: string; sets: SessionSetRow[] }>();
  for (const s of sets) {
    const key = `${s.card_exercise_id}`;
    if (!map.has(key)) map.set(key, { name: s.exercise_name, sets: [] });
    map.get(key)!.sets.push(s);
  }
  return Array.from(map.values());
}

export default function StoricoScreen() {
  const insets = useSafeAreaInsets();
  const [sessions,     setSessions]     = useState<SessionWithSets[]>([]);
  const [plans,        setPlans]        = useState<TrainingPlan[]>([]);
  const [filterPlanId, setFilterPlanId] = useState<number | null>(null);
  const [exporting,    setExporting]    = useState(false);

  const load = useCallback(() => {
    const allPlans = [...getActivePlans(), ...getArchivedPlans()];
    setPlans(allPlans);
    const raw = filterPlanId != null
      ? getCompletedSessionsForPlan(filterPlanId)
      : getCompletedSessions();
    setSessions(raw.map((s) => ({ ...s, sets: [], expanded: false })));
  }, [filterPlanId]);

  useFocusEffect(load);

  const toggleExpand = (id: number) => {
    setSessions((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      const sets = s.expanded ? [] : getSessionSets(id);
      return { ...s, expanded: !s.expanded, sets };
    }));
  };

  const handleDelete = (item: SessionWithSets) => {
    const parts = [item.card_name, item.plan_name].filter(Boolean).join('  ·  ');
    Alert.alert(
      'Elimina allenamento',
      `Eliminare ${parts ? `"${parts}"` : 'questo allenamento'}?\nI dati non potranno essere recuperati.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: () => {
            deleteSessionWithSets(item.id);
            setSessions(prev => prev.filter(s => s.id !== item.id));
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    const raw = filterPlanId != null
      ? getCompletedSessionsForPlan(filterPlanId)
      : getCompletedSessions();
    if (raw.length === 0) {
      Alert.alert('Nessuna sessione', 'Non ci sono allenamenti da esportare.');
      return;
    }
    setExporting(true);
    try {
      await exportSessionsToCsv(raw);
    } catch (e) {
      Alert.alert('Errore export', String(e));
    } finally {
      setExporting(false);
    }
  };

  const plansWithSessions = plans.filter((p) =>
    sessions.some((s) => s.plan_id === p.id) || filterPlanId === p.id
  );

  const sections = groupByDay(sessions);

  const renderItem = ({ item }: { item: SessionWithSets }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => toggleExpand(item.id)}
      activeOpacity={0.75}
    >
      <View style={styles.accentBar} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.cardMeta}>
            <Text style={styles.cardTime}>{formatDate(item.started_at)}</Text>
            <Text style={styles.cardPlan} numberOfLines={1}>
              {item.card_name ?? '—'}
              {item.plan_name ? `  ·  ${item.plan_name}` : ''}
            </Text>
          </View>
          <View style={styles.cardStats}>
            <View style={styles.statBadge}>
              <FontAwesome5 name="stopwatch" size={10} color={COLORS.primary} solid />
              <Text style={styles.statBadgeText}>
                {item.duration_s != null ? formatDuration(item.duration_s) : '—'}
              </Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: COLORS.success + '18' }]}>
              <FontAwesome5 name="layer-group" size={10} color={COLORS.success} solid />
              <Text style={[styles.statBadgeText, { color: COLORS.success }]}>{item.set_count}</Text>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <FontAwesome5 name="trash-alt" size={13} color={COLORS.danger} solid />
            </TouchableOpacity>
            <FontAwesome5
              name={item.expanded ? 'chevron-up' : 'chevron-down'}
              size={12} color={COLORS.textMuted} solid
            />
          </View>
        </View>

        {item.expanded && item.sets.length > 0 && (
          <View style={styles.setsContainer}>
            {groupSets(item.sets).map((group, gi) => (
              <View key={gi} style={styles.exerciseGroup}>
                <Text style={styles.exerciseGroupName}>{group.name}</Text>
                <View style={styles.chipRow}>
                  {group.sets.map((set) => (
                    <View key={set.set_number} style={styles.chip}>
                      <Text style={styles.chipLabel}>S{set.set_number}</Text>
                      {set.exercise_type === 'time' ? (
                        <Text style={[styles.chipWeight, { color: COLORS.accent }]}>
                          {set.reps}s
                        </Text>
                      ) : (
                        <>
                          <Text style={styles.chipWeight}>
                            {set.weight != null ? `${set.weight}kg` : '—'}
                          </Text>
                          <Text style={styles.chipReps}>{set.reps}r</Text>
                        </>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: SectionData }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Storico</Text>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExport}
          disabled={exporting}
          activeOpacity={0.75}
        >
          {exporting
            ? <ActivityIndicator size="small" color={COLORS.accent} />
            : <>
                <FontAwesome5 name="download" size={13} color={COLORS.accent} solid />
                <Text style={styles.exportBtnText}>CSV</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      {plansWithSessions.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={styles.filterBarContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, filterPlanId == null && styles.filterChipActive]}
            onPress={() => setFilterPlanId(null)}
          >
            <Text style={[styles.filterChipText, filterPlanId == null && styles.filterChipTextActive]}>
              Tutti
            </Text>
          </TouchableOpacity>
          {plansWithSessions.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.filterChip, filterPlanId === p.id && styles.filterChipActive]}
              onPress={() => setFilterPlanId(p.id)}
            >
              <Text style={[styles.filterChipText, filterPlanId === p.id && styles.filterChipTextActive]}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* List */}
      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome5 name="chart-bar" size={48} color={COLORS.textMuted} solid />
          <Text style={styles.emptyTitle}>Nessun allenamento</Text>
          <Text style={styles.emptyDesc}>
            Completa il tuo primo allenamento{'\n'}per vedere lo storico qui.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  screenTitle: { color: COLORS.text, fontSize: 22, fontWeight: '700' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    minWidth: 64, justifyContent: 'center',
  },
  exportBtnText: { color: COLORS.accent, fontSize: 13, fontWeight: '700' },

  filterBar:        { maxHeight: 44, marginBottom: 4 },
  filterBarContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  filterChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
  },
  filterChipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText:       { color: COLORS.textSub, fontSize: 13, fontWeight: '500' },
  filterChipTextActive: { color: COLORS.white },

  listContent: { padding: 12, gap: 0, paddingBottom: 24 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 16, marginBottom: 8, gap: 10,
  },
  sectionTitle: {
    color: COLORS.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 0,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: COLORS.border },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14, overflow: 'hidden',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  accentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 4, backgroundColor: COLORS.primary,
  },
  cardContent: { paddingLeft: 20, paddingRight: 14, paddingVertical: 14 },

  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMeta:   { flex: 1, marginRight: 10 },
  cardTime:   { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  cardPlan:   { color: COLORS.textSub, fontSize: 12 },

  cardStats: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: COLORS.danger + '12',
    alignItems: 'center', justifyContent: 'center',
  },
  statBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary + '18',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  statBadgeText: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },

  setsContainer: { marginTop: 14, gap: 10 },
  exerciseGroup: { gap: 6 },
  exerciseGroupName: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 60,
  },
  chipLabel:  { color: COLORS.textMuted, fontSize: 10, fontWeight: '700' },
  chipWeight: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  chipReps:   { color: COLORS.textSub, fontSize: 10, marginTop: 1 },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12,
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginTop: 8 },
  emptyDesc:  { color: COLORS.textSub, fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
