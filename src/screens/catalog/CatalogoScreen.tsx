import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  SectionList, FlatList, StyleSheet, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';

import { COLORS } from '../../theme/colors';
import { getAllExercisesWithTags, getAllTags } from '../../database/tagRepository';
import type { ExerciseTag, ExerciseWithMeta } from '../../types';

const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
  reps:       { icon: 'dumbbell', color: COLORS.primary, label: 'Ripetizioni' },
  time:       { icon: 'stopwatch', color: COLORS.accent,  label: 'A tempo'     },
  bodyweight: { icon: 'running',   color: COLORS.success, label: 'Corpo libero' },
};

const ZONE_ORDER = ['Petto', 'Schiena', 'Spalle', 'Braccia', 'Gambe', 'Glutei', 'Core', 'Full Body', 'Cardio'];

type Section = { title: string; data: ExerciseWithMeta[] };

export default function CatalogoScreen() {
  const [exercises,    setExercises]    = useState<ExerciseWithMeta[]>([]);
  const [zoneTags,     setZoneTags]     = useState<ExerciseTag[]>([]);
  const [muscleTags,   setMuscleTags]   = useState<ExerciseTag[]>([]);
  const [selectedTag,  setSelectedTag]  = useState<string | null>(null);
  const [search,       setSearch]       = useState('');
  const [expandedId,   setExpandedId]   = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    const all = getAllExercisesWithTags();
    const tags = getAllTags();
    setExercises(all);
    setZoneTags(tags.filter(t => t.type === 'zone').sort((a, b) =>
      ZONE_ORDER.indexOf(a.name) - ZONE_ORDER.indexOf(b.name)
    ));
    setMuscleTags(tags.filter(t => t.type === 'muscle').sort((a, b) => a.name.localeCompare(b.name)));
  }, []));

  const filtered = exercises.filter(ex => {
    const matchSearch = search === '' ||
      ex.name.toLowerCase().includes(search.toLowerCase());
    const matchTag = !selectedTag ||
      ex.tags?.some(t => t.name === selectedTag);
    return matchSearch && matchTag;
  });

  const isGrouped = !selectedTag && search === '';

  const sections: Section[] = isGrouped
    ? ZONE_ORDER
        .map(zone => ({
          title: zone,
          data:  filtered.filter(ex => ex.tags?.some(t => t.name === zone)),
        }))
        .filter(s => s.data.length > 0)
    : [];

  const toggleExpand = (id: number) =>
    setExpandedId(prev => (prev === id ? null : id));

  const renderItem = (ex: ExerciseWithMeta) => {
    const isOpen = expandedId === ex.id;
    const tm = TYPE_META[ex.default_type] ?? TYPE_META.reps;
    const muscleTags = ex.tags?.filter(t => t.type === 'muscle') ?? [];

    return (
      <TouchableOpacity
        key={ex.id}
        style={styles.item}
        onPress={() => toggleExpand(ex.id)}
        activeOpacity={0.75}
      >
        <View style={styles.itemHeader}>
          <View style={styles.itemLeft}>
            <Text style={styles.itemName}>{ex.name}</Text>
            <View style={[styles.typeBadge, { backgroundColor: tm.color + '22', borderColor: tm.color + '55' }]}>
              <FontAwesome5 name={tm.icon} size={9} color={tm.color} solid />
              <Text style={[styles.typeBadgeText, { color: tm.color }]}>{tm.label}</Text>
            </View>
          </View>
          <FontAwesome5
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={COLORS.textMuted}
            solid
          />
        </View>

        {isOpen && (
          <View style={styles.detail}>
            {ex.description ? (
              <Text style={styles.description}>{ex.description}</Text>
            ) : null}
            {muscleTags.length > 0 && (
              <View style={styles.muscleRow}>
                {muscleTags.map(t => (
                  <View key={t.id} style={styles.muscleChip}>
                    <Text style={styles.muscleChipText}>{t.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchWrap}>
        <FontAwesome5 name="search" size={13} color={COLORS.textMuted} solid style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca esercizio…"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={t => { setSearch(t); setSelectedTag(null); }}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search !== '' && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome5 name="times-circle" size={14} color={COLORS.textMuted} solid />
          </TouchableOpacity>
        )}
      </View>

      {/* Tag chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <TouchableOpacity
          style={[styles.chip, !selectedTag && styles.chipActive]}
          onPress={() => setSelectedTag(null)}
        >
          <Text style={[styles.chipText, !selectedTag && styles.chipTextActive]}>Tutti</Text>
        </TouchableOpacity>

        <View style={styles.chipDivider} />

        {zoneTags.map(tag => {
          const active = selectedTag === tag.name;
          return (
            <TouchableOpacity
              key={tag.id}
              style={[styles.chip, styles.chipZone, active && styles.chipActive]}
              onPress={() => { setSelectedTag(active ? null : tag.name); setSearch(''); }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag.name}</Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.chipDivider} />

        {muscleTags.map(tag => {
          const active = selectedTag === tag.name;
          return (
            <TouchableOpacity
              key={tag.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => { setSelectedTag(active ? null : tag.name); setSearch(''); }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {isGrouped ? (
        <SectionList
          sections={sections}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => renderItem(item)}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled
          ListEmptyComponent={<EmptyState />}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => renderItem(item)}
          contentContainerStyle={[styles.listContent, filtered.length === 0 && styles.emptyFlex]}
          ListEmptyComponent={<EmptyState />}
        />
      )}
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <FontAwesome5 name="search" size={36} color={COLORS.textMuted} solid />
      <Text style={styles.emptyTitle}>Nessun esercizio trovato</Text>
      <Text style={styles.emptyDesc}>Prova con un altro termine o tag.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 44,
  },
  searchIcon:  { marginRight: 8 },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 15 },

  chipRow: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 6,
    alignItems: 'flex-start',

  },
  chip: {
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipZone: {
    borderColor: COLORS.primary + '55',
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText:       { color: COLORS.text, fontSize: 14, fontWeight: '500' },
  chipTextActive: { color: COLORS.white, fontWeight: '600' },
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.border,
    marginHorizontal: 2,
  },

  listContent: { paddingHorizontal: 12, paddingBottom: 32 },
  emptyFlex:   { flex: 1 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  sectionCount: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },

  item: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 6,
    overflow: 'hidden',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemLeft: { flex: 1, gap: 6 },
  itemName: { color: COLORS.text, fontSize: 15, fontWeight: '600' },

  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '500' },

  detail: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    gap: 10,
  },
  description: { color: COLORS.textSub, fontSize: 13, lineHeight: 20 },

  muscleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  muscleChip: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  muscleChipText: { color: COLORS.textSub, fontSize: 11, fontWeight: '500' },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { color: COLORS.text, fontSize: 17, fontWeight: '600' },
  emptyDesc:  { color: COLORS.textSub, fontSize: 14, textAlign: 'center' },
});
