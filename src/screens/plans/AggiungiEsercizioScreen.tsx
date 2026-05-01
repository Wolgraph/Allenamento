import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ScrollView, Modal, Alert, Keyboard,
  SectionList,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';

import { COLORS } from '../../theme/colors';
import { createExercise, exerciseExists } from '../../database/exerciseRepository';
import { getAllExercisesWithTags, getAllTags } from '../../database/tagRepository';
import { addExerciseToCard, updateExerciseInCard, getCardExercise } from '../../database/cardExerciseRepository';
import type { ExerciseWithMeta, ExerciseTag } from '../../types';
import type { PianiStackParamList } from '../../navigation/types';

type NavProp    = NativeStackNavigationProp<PianiStackParamList, 'AggiungiEsercizio'>;
type RouteProps = RouteProp<PianiStackParamList, 'AggiungiEsercizio'>;

const SETS_MIN  = 1;
const SETS_MAX  = 10;
const REST_MIN  = 30;
const REST_MAX  = 300;
const REST_STEP = 15;
const DUR_MIN   = 10;
const DUR_MAX   = 3000;
const DUR_STEP  = 5;

const ZONE_ORDER = ['Petto','Schiena','Spalle','Braccia','Gambe','Glutei','Core','Full Body','Cardio'];

function formatRest(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

type Section = { title: string; data: ExerciseWithMeta[] };

function buildSections(exercises: ExerciseWithMeta[]): Section[] {
  const map = new Map<string, ExerciseWithMeta[]>();
  for (const ex of exercises) {
    const muscle = ex.tags?.find(t => t.type === 'muscle')?.name ?? 'Altro';
    if (!map.has(muscle)) map.set(muscle, []);
    map.get(muscle)!.push(ex);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, data]) => ({ title, data: data.sort((a, b) => a.name.localeCompare(b.name)) }));
}

export default function AggiungiEsercizioScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteProps>();
  const { schedaId, cardExerciseId } = route.params;
  const insets = useSafeAreaInsets();

  const [selectedExercise, setSelectedExercise] = useState<{ id: number; name: string } | null>(null);
  const [sets,         setSets]         = useState(3);
  const [reps,         setReps]         = useState(10);
  const [restTime,     setRestTime]     = useState(60);
  const [notes,        setNotes]        = useState('');
  const [exerciseType, setExerciseType] = useState<'reps' | 'time' | 'bodyweight'>('reps');
  const [duration,     setDuration]     = useState(30);

  // Accelerating step state for duration
  const [durStep, setDurStep] = useState(DUR_STEP);
  const durTapCntRef   = useRef(0);
  const durTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Accelerating step state for rest time
  const [restStep, setRestStep] = useState(REST_STEP);
  const restTapCntRef   = useRef(0);
  const restTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onDurPress = useCallback((delta: 1 | -1) => {
    if (durTapTimerRef.current) clearTimeout(durTapTimerRef.current);
    durTapCntRef.current++;
    const cnt  = durTapCntRef.current;
    const step = cnt >= 10 ? 60 : cnt >= 5 ? 30 : DUR_STEP;
    setDurStep(step);
    durTapTimerRef.current = setTimeout(() => {
      durTapCntRef.current = 0;
      setDurStep(DUR_STEP);
      durTapTimerRef.current = null;
    }, 1500);
    setDuration(prev => Math.max(DUR_MIN, Math.min(DUR_MAX, prev + delta * step)));
  }, []);

  const onRestPress = useCallback((delta: 1 | -1) => {
    if (restTapTimerRef.current) clearTimeout(restTapTimerRef.current);
    restTapCntRef.current++;
    const cnt  = restTapCntRef.current;
    const step = cnt >= 10 ? 60 : cnt >= 5 ? 30 : REST_STEP;
    setRestStep(step);
    restTapTimerRef.current = setTimeout(() => {
      restTapCntRef.current = 0;
      setRestStep(REST_STEP);
      restTapTimerRef.current = null;
    }, 1500);
    setRestTime(prev => Math.max(REST_MIN, Math.min(REST_MAX, prev + delta * step)));
  }, []);

  const [modalVisible,    setModalVisible]    = useState(false);
  const [modalMode,       setModalMode]       = useState<'search' | 'create'>('search');
  const [search,          setSearch]          = useState('');
  const [newExerciseName, setNewExerciseName] = useState('');

  // Modal state
  const [allExMeta,       setAllExMeta]       = useState<ExerciseWithMeta[]>([]);
  const [zoneTags,        setZoneTags]        = useState<ExerciseTag[]>([]);
  const [selectedZones,   setSelectedZones]   = useState<string[]>([]);
  const [pendingExercise, setPendingExercise] = useState<ExerciseWithMeta | null>(null);
  const [expandedId,      setExpandedId]      = useState<number | null>(null);

  useEffect(() => {
    if (cardExerciseId) {
      const ce = getCardExercise(cardExerciseId);
      if (ce) {
        setSelectedExercise({ id: ce.exercise_id, name: ce.exercise_name });
        setSets(ce.sets);
        setReps(ce.reps);
        setRestTime(ce.rest_time);
        setNotes(ce.notes ?? '');
        setExerciseType((ce.exercise_type as 'reps' | 'time' | 'bodyweight') ?? 'reps');
        setDuration(ce.duration ?? 30);
      }
    }
  }, [cardExerciseId]);

  const openModal = useCallback(() => {
    setAllExMeta(getAllExercisesWithTags());
    setZoneTags(
      getAllTags()
        .filter(t => t.type === 'zone')
        .sort((a, b) => ZONE_ORDER.indexOf(a.name) - ZONE_ORDER.indexOf(b.name))
    );
    setSelectedZones([]);
    setSearch('');
    setModalMode('search');
    setPendingExercise(null);
    setExpandedId(null);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setPendingExercise(null);
    setExpandedId(null);
  }, []);

  const toggleZone = useCallback((name: string) => {
    setSelectedZones(prev =>
      prev.includes(name) ? prev.filter(z => z !== name) : [...prev, name]
    );
  }, []);

  const filteredEx: ExerciseWithMeta[] = allExMeta.filter(ex => {
    const matchSearch = search === '' || ex.name.toLowerCase().includes(search.toLowerCase());
    const matchZone   = selectedZones.length === 0 ||
      ex.tags?.some(t => t.type === 'zone' && selectedZones.includes(t.name));
    return matchSearch && matchZone;
  });

  const useGrouped = selectedZones.length > 0 && search === '';
  const sections   = useGrouped ? buildSections(filteredEx) : [];

  const handleSelectExercise = (exercise: ExerciseWithMeta) => {
    setSelectedExercise({ id: exercise.id, name: exercise.name });
    setPendingExercise(null);
    setExpandedId(null);
    setModalVisible(false);
  };

  const handleConfirmPending = () => {
    if (!pendingExercise) return;
    handleSelectExercise(pendingExercise);
  };

  const handleCreateExercise = () => {
    const name = newExerciseName.trim();
    if (!name) return;
    if (exerciseExists(name)) {
      Alert.alert('Esercizio esistente', `"${name}" è già presente nell'archivio.`);
      return;
    }
    const newEx = createExercise(name);
    setSelectedExercise({ id: newEx.id, name: newEx.name });
    setPendingExercise(null);
    setModalVisible(false);
  };

  const handleSave = () => {
    if (!selectedExercise) {
      Alert.alert('Campo obbligatorio', 'Seleziona un esercizio.');
      return;
    }
    Keyboard.dismiss();
    try {
      const dur = exerciseType === 'time' ? duration : null;
      if (cardExerciseId) {
        updateExerciseInCard(
          cardExerciseId, selectedExercise.id, sets, reps, restTime, notes || null,
          exerciseType, dur
        );
      } else {
        addExerciseToCard(
          schedaId, selectedExercise.id, sets, reps, restTime, notes || null,
          exerciseType, dur
        );
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Errore salvataggio', e?.message ?? String(e));
    }
  };

  const renderExItem = (item: ExerciseWithMeta) => {
    const isPending  = pendingExercise?.id === item.id;
    const isExpanded = expandedId === item.id;
    const muscleTags = item.tags?.filter(t => t.type === 'muscle') ?? [];

    return (
      <View key={item.id} style={[styles.exerciseItem, isPending && styles.exerciseItemPending]}>
        <TouchableOpacity
          style={styles.exerciseItemMain}
          onPress={() => {
            setPendingExercise(prev => prev?.id === item.id ? null : item);
            if (expandedId !== null && expandedId !== item.id) setExpandedId(null);
          }}
          activeOpacity={0.75}
        >
          <View style={styles.exerciseItemLeft}>
            {isPending && (
              <FontAwesome5 name="check" size={11} color={COLORS.primary} solid style={{ marginRight: 6 }} />
            )}
            <Text style={[styles.exerciseItemText, isPending && styles.exerciseItemTextPending]} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.expandBtn}
            onPress={() => setExpandedId(prev => prev === item.id ? null : item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <FontAwesome5
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={isExpanded ? COLORS.primary : COLORS.textMuted}
              solid
            />
          </TouchableOpacity>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.exerciseDetail}>
            {item.description ? (
              <Text style={styles.exerciseDetailDesc}>{item.description}</Text>
            ) : (
              <Text style={[styles.exerciseDetailDesc, { fontStyle: 'italic' }]}>Nessuna descrizione disponibile.</Text>
            )}
            {muscleTags.length > 0 && (
              <View style={styles.muscleTagsRow}>
                {muscleTags.map(t => (
                  <View key={t.id} style={styles.muscleTag}>
                    <Text style={styles.muscleTagText}>{t.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}
        keyboardShouldPersistTaps="handled"
        scrollEnabled
      >
        {/* Esercizio */}
        <Text style={styles.label}>Esercizio *</Text>
        <TouchableOpacity style={styles.exerciseSelector} onPress={openModal} activeOpacity={0.75}>
          <Text style={selectedExercise ? styles.exerciseSelectorText : styles.exerciseSelectorPlaceholder}>
            {selectedExercise ? selectedExercise.name : 'Seleziona o crea esercizio...'}
          </Text>
          <FontAwesome5 name="chevron-down" size={13} color={COLORS.textSub} solid />
        </TouchableOpacity>

        {/* Tipo esercizio */}
        <Text style={styles.label}>Tipo</Text>
        <View style={styles.typeGrid}>
          {([
            { key: 'reps',       icon: 'dumbbell',  label: 'Ripetizioni', color: COLORS.primary },
            { key: 'time',       icon: 'stopwatch', label: 'A tempo',     color: COLORS.accent  },
            { key: 'bodyweight', icon: 'running',   label: 'Corpo lib.',  color: COLORS.success },
          ] as const).map(({ key, icon, label, color }) => {
            const active = exerciseType === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.typeIconBtn, active && { backgroundColor: color + '22', borderColor: color }]}
                onPress={() => setExerciseType(key)}
                activeOpacity={0.75}
              >
                <View style={[styles.typeIconWrap, active && { backgroundColor: color + '33' }]}>
                  <FontAwesome5 name={icon} size={22} color={active ? color : COLORS.textMuted} solid />
                </View>
                <Text style={[styles.typeIconLabel, active && { color }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Serie */}
        <Text style={styles.label}>Serie</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={[styles.stepperBtn, sets <= SETS_MIN && styles.stepperBtnDisabled]}
            onPress={() => setSets(Math.max(SETS_MIN, sets - 1))}
            disabled={sets <= SETS_MIN}
          >
            <FontAwesome5 name="minus" size={14} color={sets <= SETS_MIN ? COLORS.textMuted : COLORS.text} solid />
          </TouchableOpacity>
          <View style={styles.stepperValue}>
            <Text style={styles.stepperValueText}>{sets}</Text>
          </View>
          <TouchableOpacity
            style={[styles.stepperBtn, sets >= SETS_MAX && styles.stepperBtnDisabled]}
            onPress={() => setSets(Math.min(SETS_MAX, sets + 1))}
            disabled={sets >= SETS_MAX}
          >
            <FontAwesome5 name="plus" size={14} color={sets >= SETS_MAX ? COLORS.textMuted : COLORS.text} solid />
          </TouchableOpacity>
        </View>

        {/* Ripetizioni o Durata */}
        {exerciseType === 'time' ? (
          <>
            <Text style={styles.label}>Durata</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepperBtn, duration <= DUR_MIN && styles.stepperBtnDisabled]}
                onPress={() => onDurPress(-1)}
                disabled={duration <= DUR_MIN}
              >
                <FontAwesome5 name="minus" size={14} color={duration <= DUR_MIN ? COLORS.textMuted : COLORS.text} solid />
              </TouchableOpacity>
              <View style={styles.stepperValue}>
                <FontAwesome5 name="stopwatch" size={12} color={COLORS.accent} solid style={{ marginBottom: 2 }} />
                <Text style={styles.stepperValueText}>{formatRest(duration)}</Text>
              </View>
              <TouchableOpacity
                style={[styles.stepperBtn, duration >= DUR_MAX && styles.stepperBtnDisabled]}
                onPress={() => onDurPress(1)}
                disabled={duration >= DUR_MAX}
              >
                <FontAwesome5 name="plus" size={14} color={duration >= DUR_MAX ? COLORS.textMuted : COLORS.text} solid />
              </TouchableOpacity>
            </View>
            <View style={styles.stepLabelRow}>
              {durStep > DUR_STEP && (
                <FontAwesome5 name="bolt" size={10} color={COLORS.accent} solid />
              )}
              <Text style={styles.stepLabel}>Passo: {durStep}s. Aspetta 1 secondo per resettare</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>Ripetizioni</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepperBtn, reps <= 1 && styles.stepperBtnDisabled]}
                onPress={() => setReps(Math.max(1, reps - 1))}
                disabled={reps <= 1}
              >
                <FontAwesome5 name="minus" size={14} color={reps <= 1 ? COLORS.textMuted : COLORS.text} solid />
              </TouchableOpacity>
              <View style={styles.stepperValue}>
                <Text style={styles.stepperValueText}>{reps}</Text>
              </View>
              <TouchableOpacity
                style={[styles.stepperBtn, reps >= 30 && styles.stepperBtnDisabled]}
                onPress={() => setReps(Math.min(30, reps + 1))}
                disabled={reps >= 30}
              >
                <FontAwesome5 name="plus" size={14} color={reps >= 30 ? COLORS.textMuted : COLORS.text} solid />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Recupero */}
        <Text style={styles.label}>Recupero</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={[styles.stepperBtn, restTime <= REST_MIN && styles.stepperBtnDisabled]}
            onPress={() => onRestPress(-1)}
            disabled={restTime <= REST_MIN}
          >
            <FontAwesome5 name="minus" size={14} color={restTime <= REST_MIN ? COLORS.textMuted : COLORS.text} solid />
          </TouchableOpacity>
          <View style={styles.stepperValue}>
            <FontAwesome5 name="stopwatch" size={12} color={COLORS.primary} solid style={{ marginBottom: 2 }} />
            <Text style={styles.stepperValueText}>{formatRest(restTime)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.stepperBtn, restTime >= REST_MAX && styles.stepperBtnDisabled]}
            onPress={() => onRestPress(1)}
            disabled={restTime >= REST_MAX}
          >
            <FontAwesome5 name="plus" size={14} color={restTime >= REST_MAX ? COLORS.textMuted : COLORS.text} solid />
          </TouchableOpacity>
        </View>
        <View style={styles.stepLabelRow}>
          {restStep > REST_STEP && (
            <FontAwesome5 name="bolt" size={10} color={COLORS.accent} solid />
          )}
          <Text style={styles.stepLabel}>Passo: {restStep}s. Aspetta 1 secondo per resettare</Text>
        </View>

        {/* Note */}
        <Text style={styles.label}>Note (facoltative)</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={notes}
          onChangeText={setNotes}
          placeholder="es. Con bilanciere, busto eretto..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={3}
          maxLength={200}
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <FontAwesome5 name="check" size={15} color={COLORS.white} solid />
          <Text style={styles.saveBtnText}>
            {cardExerciseId ? 'Salva modifiche' : 'Aggiungi esercizio'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal selezione esercizio */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={closeModal}>
        <View style={[styles.modal, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {modalMode === 'search' ? 'Seleziona esercizio' : 'Nuovo esercizio'}
            </Text>
            <TouchableOpacity onPress={closeModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome5 name="times" size={18} color={COLORS.textSub} solid />
            </TouchableOpacity>
          </View>

          {modalMode === 'search' ? (
            <>
              {/* Search */}
              <View style={styles.searchWrapper}>
                <FontAwesome5 name="search" size={14} color={COLORS.textMuted} solid style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={t => { setSearch(t); if (t) setSelectedZones([]); }}
                  placeholder="Cerca esercizio..."
                  placeholderTextColor={COLORS.textMuted}
                  autoFocus
                />
                {search !== '' && (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <FontAwesome5 name="times-circle" size={14} color={COLORS.textMuted} solid />
                  </TouchableOpacity>
                )}
              </View>

              {/* Zone chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.zoneChipRow}
                keyboardShouldPersistTaps="handled"
              >
                {zoneTags.map(tag => {
                  const active = selectedZones.includes(tag.name);
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      style={[styles.zoneChip, active && styles.zoneChipActive]}
                      onPress={() => toggleZone(tag.name)}
                    >
                      {active && (
                        <FontAwesome5 name="check" size={9} color={COLORS.white} solid style={{ marginRight: 4 }} />
                      )}
                      <Text style={[styles.zoneChipText, active && styles.zoneChipTextActive]}>
                        {tag.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {selectedZones.length > 0 && (
                  <TouchableOpacity
                    style={styles.zoneChipClear}
                    onPress={() => setSelectedZones([])}
                  >
                    <FontAwesome5 name="times" size={10} color={COLORS.textMuted} solid />
                  </TouchableOpacity>
                )}
              </ScrollView>

              {/* Results count */}
              <View style={styles.resultsBar}>
                <Text style={styles.resultsCount}>{filteredEx.length} esercizi</Text>
              </View>

              {/* Exercise list */}
              {useGrouped ? (
                <SectionList
                  sections={sections}
                  keyExtractor={item => String(item.id)}
                  renderItem={({ item }) => renderExItem(item)}
                  renderSectionHeader={({ section }) => (
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{section.title}</Text>
                      <Text style={styles.sectionCount}>{section.data.length}</Text>
                    </View>
                  )}
                  stickySectionHeadersEnabled
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={<EmptyExercises search={search} />}
                />
              ) : (
                <FlatList
                  data={filteredEx}
                  keyExtractor={item => String(item.id)}
                  renderItem={({ item }) => renderExItem(item)}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={<EmptyExercises search={search} />}
                />
              )}

              {/* Bottom action */}
              {pendingExercise ? (
                <TouchableOpacity
                  style={[styles.confirmBtn, { marginBottom: Math.max(insets.bottom, 16) }]}
                  onPress={handleConfirmPending}
                  activeOpacity={0.85}
                >
                  <FontAwesome5 name="check" size={15} color={COLORS.white} solid />
                  <Text style={styles.confirmBtnText} numberOfLines={1}>
                    Aggiungi "{pendingExercise.name}"
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.createNewBtn, { marginBottom: Math.max(insets.bottom, 16) }]}
                  onPress={() => { setNewExerciseName(search); setModalMode('create'); }}
                >
                  <FontAwesome5 name="plus-circle" size={16} color={COLORS.primary} solid />
                  <Text style={styles.createNewBtnText}>Aggiungi nuovo esercizio</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={[styles.createForm, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <Text style={styles.label}>Nome esercizio</Text>
              <TextInput
                style={styles.input}
                value={newExerciseName}
                onChangeText={setNewExerciseName}
                placeholder="es. Panca Piana"
                placeholderTextColor={COLORS.textMuted}
                autoFocus
                maxLength={80}
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateExercise} activeOpacity={0.85}>
                <FontAwesome5 name="check" size={15} color={COLORS.white} solid />
                <Text style={styles.saveBtnText}>Crea e seleziona</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => setModalMode('search')}>
                <FontAwesome5 name="arrow-left" size={13} color={COLORS.textSub} solid />
                <Text style={styles.backBtnText}>Torna alla ricerca</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function EmptyExercises({ search }: { search: string }) {
  return (
    <Text style={styles.emptyList}>
      {search ? `Nessun risultato per "${search}"` : 'Nessun esercizio trovato.'}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content:   { padding: 20 },

  label: {
    color: COLORS.textSub, fontSize: 12, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginTop: 16, marginBottom: 8,
  },

  exerciseSelector: {
    backgroundColor: COLORS.surface,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  exerciseSelectorText:        { color: COLORS.text,     fontSize: 16, flex: 1, marginRight: 8 },
  exerciseSelectorPlaceholder: { color: COLORS.textMuted, fontSize: 16, flex: 1, marginRight: 8 },

  typeGrid: { flexDirection: 'row', gap: 10 },
  typeIconBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, gap: 8,
  },
  typeIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
  },
  typeIconLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: COLORS.surface,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 10, minWidth: 44, alignItems: 'center',
  },
  chipSelected:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:         { color: COLORS.textSub, fontSize: 15, fontWeight: '600' },
  chipTextSelected: { color: COLORS.white },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  stepperBtn: {
    width: 52, height: 52,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnDisabled:  { opacity: 0.4 },
  stepperValue: {
    flex: 1, height: 52,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 8, borderRadius: 12,
  },
  stepperValueText:  { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  stepLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  stepLabel:    { color: COLORS.textMuted, fontSize: 12 },

  input: {
    backgroundColor: COLORS.surface, color: COLORS.text,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },

  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 28,
  },
  saveBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modal:       { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },

  searchWrapper: {
    margin: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
  },
  searchIcon:  { marginRight: 8 },
  searchInput: { flex: 1, color: COLORS.text, paddingVertical: 12, fontSize: 16 },

  zoneChipRow: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 6,
    gap: 8,
    alignItems: 'flex-start',
  },
  zoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  zoneChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  zoneChipText:       { color: COLORS.text, fontSize: 14, fontWeight: '500' },
  zoneChipTextActive: { color: COLORS.white, fontWeight: '600' },
  zoneChipClear: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 2,
  },

  resultsBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 6,
  },
  resultsCount: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  pendingHint:  { color: COLORS.primary, fontSize: 12, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 8 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  sectionTitle: { color: COLORS.textSub, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionCount: { color: COLORS.textMuted, fontSize: 12 },

  // Exercise list items
  exerciseItem: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  exerciseItemPending: {
    backgroundColor: COLORS.primary + '10',
  },
  exerciseItemMain: {
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  exerciseItemLeft: {
    flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8,
  },
  exerciseItemText: {
    color: COLORS.text, fontSize: 16, flex: 1,
  },
  exerciseItemTextPending: {
    color: COLORS.primary, fontWeight: '600',
  },
  expandBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  exerciseDetail: {
    paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border + '60',
    backgroundColor: COLORS.surfaceAlt + '80',
  },
  exerciseDetailDesc: {
    color: COLORS.textSub, fontSize: 13, lineHeight: 19,
  },
  muscleTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  muscleTag: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  muscleTagText: { color: COLORS.textSub, fontSize: 11, fontWeight: '500' },
  selectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 10, paddingVertical: 10,
    alignSelf: 'stretch',
  },
  selectBtnSelected: {
    backgroundColor: COLORS.success,
  },
  selectBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },

  emptyList: {
    color: COLORS.textSub, textAlign: 'center',
    marginTop: 40, fontSize: 15, paddingHorizontal: 20,
  },

  confirmBtn: {
    margin: 12, paddingVertical: 16, borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  confirmBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700', flexShrink: 1 },

  createNewBtn: {
    margin: 12, paddingVertical: 16, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  createNewBtnText: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },

  createForm: { padding: 20 },
  backBtn: {
    marginTop: 16, alignItems: 'center', paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  backBtnText: { color: COLORS.textSub, fontSize: 15 },
});
