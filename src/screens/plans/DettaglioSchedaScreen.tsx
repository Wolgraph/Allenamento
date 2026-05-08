import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert, View, Text, TouchableOpacity, Modal, TextInput,
  StyleSheet, ScrollView,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';

import { COLORS } from '../../theme/colors';
import { getCard, deleteCard, getTagsForCard } from '../../database/cardRepository';
import { getExercisesForCard, deleteExerciseFromCard } from '../../database/cardExerciseRepository';
import {
  createGroup, updateGroup, dissolveGroup,
  setExerciseGroup, moveExerciseInGroup, renumberCardItems,
} from '../../database/exerciseGroupRepository';
import ActionSheet from '../../components/ActionSheet';
import ConfirmDialog from '../../components/ConfirmDialog';
import type { CardExerciseWithName, ExerciseTag, WorkoutCard, CardItem } from '../../types';
import type { PianiStackParamList } from '../../navigation/types';
import { registerUnsavedChanges, unregisterUnsavedChanges } from '../../utils/unsavedChangesStore';

type NavProp    = NativeStackNavigationProp<PianiStackParamList, 'DettaglioScheda'>;
type RouteProps = RouteProp<PianiStackParamList, 'DettaglioScheda'>;

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatRest(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function filterOutDeleted(built: CardItem[], pendingDelete: Set<number>): CardItem[] {
  if (pendingDelete.size === 0) return built;
  return built
    .map(item => {
      if (item.kind === 'group') {
        return { ...item, exercises: item.exercises.filter(e => !pendingDelete.has(e.id)) };
      }
      return item;
    })
    .filter(item => {
      if (item.kind === 'exercise') return !pendingDelete.has(item.data.id);
      if (item.kind === 'group')    return item.exercises.length > 0;
      return true;
    });
}

function buildItems(exercises: CardExerciseWithName[]): CardItem[] {
  // Exercises are already sorted by COALESCE(eg.sort_order, ce.sort_order)
  // Collect groups first, then interleave
  const groupMap   = new Map<number, CardExerciseWithName[]>();
  const groupMeta  = new Map<number, { type: 'superset'|'circuit'|'simple'; rounds: number; restTime: number; name: string|null; sortOrder: number }>();
  const standalones: CardExerciseWithName[] = [];

  for (const ex of exercises) {
    if (ex.group_id != null) {
      if (!groupMap.has(ex.group_id)) {
        groupMap.set(ex.group_id, []);
        groupMeta.set(ex.group_id, {
          type:      (ex.group_type ?? 'superset') as 'superset'|'circuit'|'simple',
          rounds:    ex.group_rounds    ?? 3,
          restTime:  ex.group_rest_time ?? 90,
          name:      ex.group_name      ?? null,
          sortOrder: ex.group_sort_order ?? 0,
        });
      }
      groupMap.get(ex.group_id)!.push(ex);
    } else {
      standalones.push(ex);
    }
  }

  type Slot = { sortKey: number; item: CardItem };
  const slots: Slot[] = [];

  for (const ex of standalones) {
    slots.push({ sortKey: ex.sort_order, item: { kind: 'exercise', data: ex } });
  }
  for (const [groupId, exs] of groupMap) {
    const meta = groupMeta.get(groupId)!;
    slots.push({
      sortKey: meta.sortOrder,
      item: { kind: 'group', groupId, ...meta, exercises: exs },
    });
  }
  slots.sort((a, b) => a.sortKey - b.sortKey);
  return slots.map(s => s.item);
}

// ─── Group config modal ───────────────────────────────────────────────────────

interface GroupModalState {
  visible:    boolean;
  editGroupId: number | null;
  // exercise that triggered "Crea gruppo" (null = edit existing)
  sourceExerciseId: number | null;
  type:    'superset' | 'circuit' | 'simple';
  rounds:  number;
  restTime: number;
  name:    string;
}

const INITIAL_MODAL: GroupModalState = {
  visible: false, editGroupId: null, sourceExerciseId: null,
  type: 'simple', rounds: 3, restTime: 90, name: '',
};

interface GroupModalProps {
  state: GroupModalState;
  onChange: (patch: Partial<GroupModalState>) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function GroupModal({ state, onChange, onConfirm, onCancel }: GroupModalProps) {
  const isEdit = state.editGroupId !== null;
  return (
    <Modal visible={state.visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={ms.overlay}>
        <View style={ms.sheet}>
          <Text style={ms.title}>{isEdit ? 'Modifica gruppo' : 'Nuovo gruppo'}</Text>

          {/* Type toggle */}
          <Text style={ms.label}>Tipo</Text>
          <View style={ms.typeRow}>
            {([
              { key: 'simple',   icon: 'layer-group', label: 'Semplice',   color: COLORS.success },
              { key: 'superset', icon: 'bolt',        label: 'Superserie', color: COLORS.accent  },
              { key: 'circuit',  icon: 'redo-alt',    label: 'Circuito',   color: COLORS.primary },
            ] as const).map(({ key, icon, label, color }) => (
              <TouchableOpacity
                key={key}
                style={[ms.typeBtn, state.type === key && { backgroundColor: color, borderColor: color }]}
                onPress={() => onChange({ type: key })}
                activeOpacity={0.75}
              >
                <FontAwesome5
                  name={icon}
                  size={12}
                  color={state.type === key ? COLORS.white : COLORS.textSub}
                  solid
                />
                <Text style={[ms.typeBtnText, state.type === key && ms.typeBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Rounds + Rest — hidden for simple groups */}
          {state.type !== 'simple' && (
            <>
              <Text style={ms.label}>Giri / Rounds</Text>
              <View style={ms.stepperRow}>
                <TouchableOpacity
                  style={ms.stepperBtn}
                  onPress={() => onChange({ rounds: Math.max(2, state.rounds - 1) })}
                >
                  <FontAwesome5 name="minus" size={12} color={COLORS.text} solid />
                </TouchableOpacity>
                <Text style={ms.stepperVal}>{state.rounds}</Text>
                <TouchableOpacity
                  style={ms.stepperBtn}
                  onPress={() => onChange({ rounds: Math.min(10, state.rounds + 1) })}
                >
                  <FontAwesome5 name="plus" size={12} color={COLORS.text} solid />
                </TouchableOpacity>
              </View>

              <Text style={ms.label}>Recupero tra i giri (s)</Text>
              <View style={ms.stepperRow}>
                {[30, 60, 90, 120].map(preset => (
                  <TouchableOpacity
                    key={preset}
                    style={[ms.restPreset, state.restTime === preset && ms.restPresetActive]}
                    onPress={() => onChange({ restTime: preset })}
                  >
                    <Text style={[ms.restPresetText, state.restTime === preset && ms.restPresetTextActive]}>
                      {preset}s
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[ms.stepperRow, { marginTop: 6 }]}>
                <TouchableOpacity
                  style={ms.stepperBtn}
                  onPress={() => onChange({ restTime: Math.max(0, state.restTime - 15) })}
                >
                  <FontAwesome5 name="minus" size={12} color={COLORS.text} solid />
                </TouchableOpacity>
                <Text style={ms.stepperVal}>{formatRest(state.restTime)}</Text>
                <TouchableOpacity
                  style={ms.stepperBtn}
                  onPress={() => onChange({ restTime: Math.min(300, state.restTime + 15) })}
                >
                  <FontAwesome5 name="plus" size={12} color={COLORS.text} solid />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Optional name */}
          <Text style={ms.label}>Nome gruppo (opzionale)</Text>
          <TextInput
            style={ms.input}
            value={state.name}
            onChangeText={v => onChange({ name: v })}
            placeholder="es. Petto + Tricipiti"
            placeholderTextColor={COLORS.textMuted}
            maxLength={50}
          />

          {/* Buttons */}
          <View style={ms.btnRow}>
            <TouchableOpacity style={ms.cancelBtn} onPress={onCancel} activeOpacity={0.75}>
              <Text style={ms.cancelBtnText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ms.confirmBtn} onPress={onConfirm} activeOpacity={0.85}>
              <Text style={ms.confirmBtnText}>{isEdit ? 'Salva' : 'Crea gruppo'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DettaglioSchedaScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteProps>();
  const { schedaId, pianoId } = route.params;

  const [card,     setCard]     = useState<WorkoutCard | null>(null);
  const [items,    setItems]    = useState<CardItem[]>([]);
  const [cardTags, setCardTags] = useState<ExerciseTag[]>([]);

  // Edit mode state
  const [editMode,     setEditMode]     = useState(false);
  const [editItems,    setEditItems]    = useState<CardItem[]>([]);
  const [expandedExId, setExpandedExId] = useState<number | null>(null);
  const editModeRef      = useRef(false);
  const editItemsRef     = useRef<CardItem[]>([]);
  // Buffered add/remove tracking
  const pendingDeleteRef  = useRef<Set<number>>(new Set()); // IDs to delete on Save
  const addedInSessionRef = useRef<Set<number>>(new Set()); // IDs to delete on Discard
  const originalIdsRef    = useRef<Set<number>>(new Set()); // snapshot on enterEditMode

  // Action sheet targets
  const [menuEx,    setMenuEx]    = useState<CardExerciseWithName | null>(null);
  const [menuGroup, setMenuGroup] = useState<CardItem & { kind: 'group' } | null>(null);

  // Confirm dialogs
  const [confirmEx,    setConfirmEx]    = useState<CardExerciseWithName | null>(null);
  const [confirmGroup, setConfirmGroup] = useState<(CardItem & { kind: 'group' }) | null>(null);

  // Group create/edit modal
  const [groupModal, setGroupModal] = useState<GroupModalState>(INITIAL_MODAL);

  const [confirmDeleteCard, setConfirmDeleteCard] = useState(false);

  const load = useCallback(() => {
    setCard(getCard(schedaId));
    setCardTags(getTagsForCard(schedaId));
    const exs = getExercisesForCard(schedaId);
    const built = buildItems(exs);
    setItems(built);
    if (editModeRef.current) {
      // Detect exercises added since entering edit mode
      built.forEach(item => {
        const ids = item.kind === 'exercise'
          ? [item.data.id]
          : item.exercises.map(e => e.id);
        ids.forEach(id => {
          if (!originalIdsRef.current.has(id) && !addedInSessionRef.current.has(id)) {
            addedInSessionRef.current = new Set([...addedInSessionRef.current, id]);
          }
        });
      });
      // Build editItems: DB state minus pending deletes
      const filtered = filterOutDeleted(built, pendingDeleteRef.current);
      setEditItems(filtered);
      editItemsRef.current = filtered;
    }
  }, [schedaId]);

  useFocusEffect(load);

  // ── Edit mode helpers ────────────────────────────────────────────────────────

  const resetEditRefs = () => {
    editModeRef.current      = false;
    editItemsRef.current     = [];
    pendingDeleteRef.current  = new Set();
    addedInSessionRef.current = new Set();
    originalIdsRef.current    = new Set();
  };

  const saveEdit = useCallback(() => {
    pendingDeleteRef.current.forEach(id => deleteExerciseFromCard(id));
    renumberCardItems(editItemsRef.current);
    resetEditRefs();
    setEditMode(false);
    setEditItems([]);
    unregisterUnsavedChanges();
    load();
  }, [load]);

  const discardEdit = useCallback(() => {
    addedInSessionRef.current.forEach(id => deleteExerciseFromCard(id));
    resetEditRefs();
    setEditMode(false);
    setEditItems([]);
    unregisterUnsavedChanges();
    load();
  }, [load]);

  const enterEditMode = useCallback(() => {
    // Snapshot current exercise IDs
    const snapshot = new Set<number>();
    items.forEach(item => {
      if (item.kind === 'exercise') snapshot.add(item.data.id);
      else item.exercises.forEach(e => snapshot.add(e.id));
    });
    originalIdsRef.current    = snapshot;
    pendingDeleteRef.current  = new Set();
    addedInSessionRef.current = new Set();

    editModeRef.current  = true;
    editItemsRef.current = [...items];
    setEditMode(true);
    setEditItems([...items]);
    setExpandedExId(null);
    registerUnsavedChanges((onProceed) => {
      Alert.alert(
        'Modifiche in corso',
        'Cosa vuoi fare prima di uscire?',
        [
          { text: 'Rimani', style: 'cancel' },
          { text: 'Salva', onPress: () => { saveEdit(); onProceed(); } },
          { text: 'Annulla modifiche', style: 'destructive', onPress: () => { discardEdit(); onProceed(); } },
        ]
      );
    });
  }, [items, saveEdit, discardEdit]);

  // Sostituisce l'header nativo con un back link "< <nome piano>" coerente con il hero.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: '',
      headerLeft: () => (
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <FontAwesome5 name="chevron-left" size={13} color={COLORS.primary} solid />
          {/* TODO: [BACKEND] sostituire "Piano" con il nome reale del piano — es. route.params.pianoName */}
          <Text style={styles.backBtnText}>Piano</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // Intercept back navigation while in edit mode
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!editModeRef.current) return;
      e.preventDefault();
      Alert.alert(
        'Modifiche in corso',
        'Cosa vuoi fare prima di uscire?',
        [
          { text: 'Rimani', style: 'cancel' },
          { text: 'Salva', onPress: () => { saveEdit(); navigation.dispatch(e.data.action); } },
          { text: 'Annulla modifiche', style: 'destructive', onPress: () => { discardEdit(); navigation.dispatch(e.data.action); } },
        ]
      );
    });
    return unsubscribe;
  }, [navigation]); // saveEdit e discardEdit sono stabili (no dipendenze da state che cambiano)

  // ── Group modal handlers ────────────────────────────────────────────────────

  const openCreateGroup = (ex: CardExerciseWithName) => {
    const groupCount = items.filter(i => i.kind === 'group').length;
    setGroupModal({
      ...INITIAL_MODAL,
      visible: true,
      sourceExerciseId: ex.id,
      type: 'simple',
      rounds: 3,
      restTime: 90,
      name: `Gruppo ${groupCount + 1}`,
    });
  };

  const openEditGroup = (item: CardItem & { kind: 'group' }) => {
    setGroupModal({
      visible: true,
      editGroupId: item.groupId,
      sourceExerciseId: null,
      type: item.type,
      rounds: item.rounds,
      restTime: item.restTime,
      name: item.name ?? '',
    });
  };

  const handleGroupConfirm = () => {
    const { editGroupId, sourceExerciseId, type, rounds, restTime, name } = groupModal;
    const safeName = name.trim() || null;

    if (editGroupId !== null) {
      // Edit existing group
      updateGroup(editGroupId, type, rounds, restTime, safeName);
    } else if (sourceExerciseId !== null) {
      // Create new group from this exercise
      // Determine sort_order: find the exercise's current outer position
      let sortOrder = 0;
      items.forEach((item, idx) => {
        if (item.kind === 'exercise' && item.data.id === sourceExerciseId) sortOrder = idx;
      });
      const group = createGroup(schedaId, type, rounds, restTime, safeName, sortOrder);
      setExerciseGroup(sourceExerciseId, group.id);
    }

    setGroupModal(INITIAL_MODAL);
    load();
  };

  // ── Add exercise to existing group ─────────────────────────────────────────
  const addExToGroup = (ex: CardExerciseWithName, groupId: number) => {
    setExerciseGroup(ex.id, groupId);
    load();
  };

  const removeExFromGroup = (ex: CardExerciseWithName) => {
    setExerciseGroup(ex.id, null);
    load();
  };

  // ── Delete exercise ─────────────────────────────────────────────────────────
  const handleDeleteEx = (ex: CardExerciseWithName) => {
    setConfirmEx(null);
    if (editModeRef.current) {
      if (addedInSessionRef.current.has(ex.id)) {
        // Added during this session: delete from DB immediately (will be cleaned up anyway)
        deleteExerciseFromCard(ex.id);
        addedInSessionRef.current.delete(ex.id);
      } else {
        // Original exercise: mark pending-delete (don't touch DB)
        pendingDeleteRef.current = new Set([...pendingDeleteRef.current, ex.id]);
      }
      const filtered = filterOutDeleted(editItemsRef.current, pendingDeleteRef.current);
      setEditItems(filtered);
      editItemsRef.current = filtered;
    } else {
      deleteExerciseFromCard(ex.id);
      load();
    }
  };

  // ── Dissolve group ──────────────────────────────────────────────────────────
  const handleDissolveGroup = (item: CardItem & { kind: 'group' }) => {
    dissolveGroup(item.groupId);
    setConfirmGroup(null);
    load();
  };

  // ── Build actionSheet options for an exercise ───────────────────────────────
  const exMenuOptions = (ex: CardExerciseWithName) => {
    const isInGroup = ex.group_id != null;
    // Find groups in the card (for "Aggiungi al gruppo" option)
    const groups = items.filter(i => i.kind === 'group') as (CardItem & { kind: 'group' })[];
    const otherGroups = groups.filter(g => g.groupId !== ex.group_id);

    const opts: any[] = [
      {
        label: 'Modifica esercizio',
        icon:  'pen',
        color: COLORS.primary,
        onPress: () => navigation.navigate('AggiungiEsercizio', { schedaId, cardExerciseId: ex.id }),
      },
    ];

    if (isInGroup) {
      opts.push({
        label:   'Rimuovi dal gruppo',
        icon:    'object-ungroup',
        color:   COLORS.accent,
        onPress: () => removeExFromGroup(ex),
      });
    } else {
      // Can create group or add to existing
      opts.push({
        label:   'Crea gruppo',
        icon:    'object-group',
        color:   COLORS.accent,
        onPress: () => openCreateGroup(ex),
      });
      const groupTypeName = (g: CardItem & { kind: 'group' }) =>
        g.type === 'superset' ? 'superserie' : g.type === 'circuit' ? 'circuito' : 'gruppo';

      if (otherGroups.length === 1) {
        const g = otherGroups[0];
        const label = g.name ? `Aggiungi a "${g.name}"` : `Aggiungi alla ${groupTypeName(g)}`;
        opts.push({
          label,
          icon:    'plus-circle',
          color:   COLORS.primary,
          onPress: () => addExToGroup(ex, g.groupId),
        });
      } else if (otherGroups.length > 1) {
        otherGroups.forEach(g => {
          const label = g.name ?? `Gruppo (${groupTypeName(g)})`;
          opts.push({
            label:   `Aggiungi a "${label}"`,
            icon:    'plus-circle',
            color:   COLORS.primary,
            onPress: () => addExToGroup(ex, g.groupId),
          });
        });
      }
    }

    opts.push({
      label:       'Rimuovi dalla scheda',
      icon:        'trash',
      destructive: true,
      onPress: () => setConfirmEx(ex),
    });

    return opts;
  };

  // ── Move exercise within its group ─────────────────────────────────────────
  const moveInGroup = (ex: CardExerciseWithName, direction: 'up' | 'down') => {
    const source = editModeRef.current ? editItems : items;
    const groupItem = source.find(i => i.kind === 'group' && i.groupId === ex.group_id);
    if (!groupItem || groupItem.kind !== 'group') return;
    if (editModeRef.current) {
      // In edit mode: update editItems optimistically, persist on save
      const groupIdx = editItems.findIndex(i => i.kind === 'group' && i.groupId === ex.group_id);
      if (groupIdx === -1) return;
      const group = editItems[groupIdx] as CardItem & { kind: 'group' };
      const exs = [...group.exercises];
      const exIdx = exs.findIndex(e => e.id === ex.id);
      const swapIdx = direction === 'up' ? exIdx - 1 : exIdx + 1;
      if (swapIdx < 0 || swapIdx >= exs.length) return;
      [exs[exIdx], exs[swapIdx]] = [exs[swapIdx], exs[exIdx]];
      const updatedGroup = { ...group, exercises: exs };
      const next = [...editItems];
      next[groupIdx] = updatedGroup;
      setEditItems(next);
      editItemsRef.current = next;
    } else {
      moveExerciseInGroup(ex.id, groupItem.exercises, direction);
      load();
    }
  };

  // ── Move outer item (standalone exercise or group block) ───────────────────
  const moveOuterItem = (idx: number, direction: 'up' | 'down') => {
    const source = editModeRef.current ? editItems : items;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= source.length) return;
    const next = [...source];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    if (editModeRef.current) {
      setEditItems(next);
      editItemsRef.current = next;
    } else {
      setItems(next);
      renumberCardItems(next);
    }
  };

  // ── Exercise card renderer (reusable for standalone + inside group) ─────────
  const renderExerciseCard = (
    item: CardExerciseWithName,
    index: number,
    insideGroup?: boolean,
    isFirst?: boolean,
    isLast?: boolean,
    groupSize?: number,
    onMoveUp?: () => void,
    onMoveDown?: () => void,
  ) => {
    const isExpanded = !editMode && expandedExId === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          insideGroup && styles.cardInGroup,
        ]}
        onPress={() =>
          editMode
            ? navigation.navigate('AggiungiEsercizio', { schedaId, cardExerciseId: item.id })
            : setExpandedExId(prev => prev === item.id ? null : item.id)
        }
        activeOpacity={0.75}
      >
        {!insideGroup && <View style={styles.accentBar} />}
        <View style={[styles.cardContent, insideGroup && styles.cardContentInGroup]}>
          <View style={styles.exerciseRow}>
            <View style={styles.indexBadge}>
              <Text style={styles.indexText}>{index + 1}</Text>
            </View>
            <View style={styles.exerciseInfo}>
              <View style={styles.exerciseNameRow}>
                <Text style={styles.exerciseName} numberOfLines={1}>{item.exercise_name}</Text>
                {editMode && (
                  <TouchableOpacity
                    style={styles.menuBtn}
                    onPress={() => setMenuEx(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <FontAwesome5 name="ellipsis-v" size={14} color={COLORS.textMuted} solid />
                  </TouchableOpacity>
                )}
                {!editMode && (
                  <FontAwesome5
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={11}
                    color={COLORS.textMuted}
                    solid
                    style={{ marginLeft: 8 }}
                  />
                )}
                {editMode && (
                  insideGroup ? (
                    <View style={styles.groupReorderBtns}>
                      <TouchableOpacity
                        style={[styles.reorderBtn, index === 0 && styles.reorderBtnDisabled]}
                        onPress={() => index > 0 && moveInGroup(item, 'up')}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <FontAwesome5 name="chevron-up" size={11} color={index === 0 ? COLORS.border : COLORS.textMuted} solid />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.reorderBtn, groupSize !== undefined && index === groupSize - 1 && styles.reorderBtnDisabled]}
                        onPress={() => groupSize !== undefined && index < groupSize - 1 && moveInGroup(item, 'down')}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <FontAwesome5 name="chevron-down" size={11} color={groupSize !== undefined && index === groupSize - 1 ? COLORS.border : COLORS.textMuted} solid />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.groupReorderBtns}>
                      <TouchableOpacity
                        style={[styles.reorderBtn, isFirst && styles.reorderBtnDisabled]}
                        onPress={onMoveUp}
                        disabled={isFirst}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <FontAwesome5 name="chevron-up" size={11} color={isFirst ? COLORS.border : COLORS.textMuted} solid />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.reorderBtn, isLast && styles.reorderBtnDisabled]}
                        onPress={onMoveDown}
                        disabled={isLast}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <FontAwesome5 name="chevron-down" size={11} color={isLast ? COLORS.border : COLORS.textMuted} solid />
                      </TouchableOpacity>
                    </View>
                  )
                )}
              </View>
              <View style={styles.tagsRow}>
                <View style={styles.tag}>
                  <FontAwesome5 name="layer-group" size={10} color={COLORS.textSub} solid />
                  <Text style={styles.tagText}>{item.sets} serie</Text>
                </View>
                {item.exercise_type === 'time' ? (
                  <View style={[styles.tag, styles.tagTime]}>
                    <FontAwesome5 name="stopwatch" size={10} color={COLORS.accent} solid />
                    <Text style={[styles.tagText, { color: COLORS.accent }]}>{item.duration ?? '—'}s</Text>
                  </View>
                ) : item.exercise_type === 'bodyweight' ? (
                  <View style={[styles.tag, styles.tagBodyweight]}>
                    <FontAwesome5 name="running" size={10} color={COLORS.success} solid />
                    <Text style={[styles.tagText, { color: COLORS.success }]}>{item.reps} reps</Text>
                  </View>
                ) : (
                  <View style={styles.tag}>
                    <FontAwesome5 name="dumbbell" size={10} color={COLORS.textSub} solid />
                    <Text style={styles.tagText}>{item.reps} reps</Text>
                  </View>
                )}
                {/* Show per-exercise rest for standalone, circuit, or simple group */}
                {(!insideGroup || item.group_type === 'circuit' || item.group_type === 'simple') && (
                  <View style={[styles.tag, styles.tagRest]}>
                    <FontAwesome5 name="stopwatch" size={10} color={COLORS.primary} solid />
                    <Text style={[styles.tagText, { color: COLORS.primary }]}>{formatRest(item.rest_time)}</Text>
                  </View>
                )}
              </View>
              {item.notes && !isExpanded ? (
                <Text style={styles.exerciseNotes} numberOfLines={2}>{item.notes}</Text>
              ) : null}
            </View>
          </View>

          {/* Expanded detail — consultazione only */}
          {isExpanded && (
            <View style={styles.exerciseDetail}>
              {item.exercise_description ? (
                <Text style={styles.exerciseDetailDesc}>{item.exercise_description}</Text>
              ) : item.notes ? null : (
                <Text style={[styles.exerciseDetailDesc, { fontStyle: 'italic' }]}>Nessuna descrizione disponibile.</Text>
              )}
              {item.notes && (
                <Text style={styles.exerciseDetailNotes}>{item.notes}</Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Sequential display index for exercises (groups do not consume an index)
  let exCounter = 0;

  const displayItems = editMode ? editItems : items;

  return (
    <View style={styles.container}>
      {card && (
        <View style={styles.hero}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.cardName, { flex: 1 }]}>{card.name}</Text>
            {editMode && (
              <TouchableOpacity
                style={styles.pencilBtn}
                onPress={() => navigation.navigate('CreaScheda', { pianoId, schedaId })}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <FontAwesome5 name="pen" size={13} color={COLORS.primary} solid />
              </TouchableOpacity>
            )}
          </View>
          {cardTags.length > 0 && (
            <View style={styles.heroTagsRow}>
              {cardTags.map(t => (
                <View key={t.id} style={styles.heroTagChip}>
                  <Text style={styles.heroTagChipText}>{t.name}</Text>
                </View>
              ))}
            </View>
          )}
          {card.notes ? (
            <View style={styles.notesRow}>
              <FontAwesome5 name="thumbtack" size={11} color={COLORS.textMuted} solid />
              <Text style={styles.cardNotes}>{card.notes}</Text>
            </View>
          ) : null}
          <View style={styles.heroActions}>
            {!editMode ? (
              <>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={enterEditMode}
                >
                  <FontAwesome5 name="pen" size={11} color={COLORS.textSub} solid />
                  <Text style={styles.editBtnText}>Modifica</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editBtn, styles.editBtnDanger]}
                  onPress={() => setConfirmDeleteCard(true)}
                >
                  <FontAwesome5 name="trash" size={11} color={COLORS.danger} solid />
                  <Text style={[styles.editBtnText, { color: COLORS.danger }]}>Elimina</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.editBtn, styles.editBtnSave]}
                  onPress={saveEdit}
                >
                  <FontAwesome5 name="check" size={11} color={COLORS.white} solid />
                  <Text style={[styles.editBtnText, { color: COLORS.white }]}>Salva</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={discardEdit}
                >
                  <FontAwesome5 name="times" size={11} color={COLORS.textSub} solid />
                  <Text style={styles.editBtnText}>Annulla</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
      <View style={styles.sectionSep} />
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>Esercizi</Text>
        <Text style={styles.sectionCount}>{displayItems.length}</Text>
      </View>

      <ScrollView
        contentContainerStyle={displayItems.length === 0 ? styles.emptyContainer : styles.listContent}
      >
        {displayItems.length === 0 ? (
          <View style={styles.empty}>
            <FontAwesome5 name="running" size={44} color={COLORS.textMuted} solid />
            <Text style={styles.emptyTitle}>Nessun esercizio</Text>
            <Text style={styles.emptyDesc}>
              Aggiungi gli esercizi che compongono questa scheda.
            </Text>
          </View>
        ) : (
          displayItems.map((item, outerIdx) => {
            const isFirst = outerIdx === 0;
            const isLast  = outerIdx === displayItems.length - 1;

            if (item.kind === 'exercise') {
              const displayIdx = exCounter++;
              return (
                <View key={`ex-${item.data.id}`}>
                  {renderExerciseCard(
                    item.data, displayIdx,
                    false, isFirst, isLast, undefined,
                    () => moveOuterItem(outerIdx, 'up'),
                    () => moveOuterItem(outerIdx, 'down'),
                  )}
                </View>
              );
            }

            // Group block
            const typeLabel = item.type === 'superset' ? 'SUPERSERIE'
              : item.type === 'circuit' ? 'CIRCUITO' : 'GRUPPO';
            const typeIcon  = item.type === 'superset' ? 'bolt'
              : item.type === 'circuit' ? 'redo-alt' : 'layer-group';
            const typeColor = item.type === 'superset' ? COLORS.accent
              : item.type === 'circuit' ? COLORS.primary : COLORS.success;

            return (
              <View key={`grp-${item.groupId}`} style={styles.groupBlock}>
                <View style={styles.groupHeader}>
                  <View style={[styles.groupTypeBadge, { backgroundColor: typeColor + '22', borderColor: typeColor + '55' }]}>
                    <FontAwesome5 name={typeIcon} size={10} color={typeColor} solid />
                    <Text style={[styles.groupTypeText, { color: typeColor }]}>{typeLabel}</Text>
                  </View>
                  <View style={styles.groupMeta}>
                    {item.type !== 'simple' && (
                      <>
                        <FontAwesome5 name="redo-alt" size={9} color={COLORS.textMuted} solid />
                        <Text style={styles.groupMetaText}>{item.rounds} giri</Text>
                        <FontAwesome5 name="stopwatch" size={9} color={COLORS.textMuted} solid style={{ marginLeft: 8 }} />
                        <Text style={styles.groupMetaText}>{formatRest(item.restTime)}</Text>
                      </>
                    )}
                    {item.name ? (
                      <Text style={styles.groupName} numberOfLines={1}>{item.type !== 'simple' ? ' · ' : ''}{item.name}</Text>
                    ) : null}
                  </View>
                  {editMode && (
                    <TouchableOpacity
                      style={styles.menuBtn}
                      onPress={() => setMenuGroup(item)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <FontAwesome5 name="ellipsis-v" size={14} color={COLORS.textMuted} solid />
                    </TouchableOpacity>
                  )}
                  {editMode && (
                    <View style={styles.groupReorderBtns}>
                      <TouchableOpacity
                        style={[styles.reorderBtn, isFirst && styles.reorderBtnDisabled]}
                        onPress={() => moveOuterItem(outerIdx, 'up')}
                        disabled={isFirst}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <FontAwesome5 name="chevron-up" size={11} color={isFirst ? COLORS.border : COLORS.textMuted} solid />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.reorderBtn, isLast && styles.reorderBtnDisabled]}
                        onPress={() => moveOuterItem(outerIdx, 'down')}
                        disabled={isLast}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <FontAwesome5 name="chevron-down" size={11} color={isLast ? COLORS.border : COLORS.textMuted} solid />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <View style={styles.groupDivider} />
                {item.exercises.map((ex, idx) => (
                  <View key={ex.id}>
                    {renderExerciseCard(ex, idx, true, false, false, item.exercises.length)}
                    {idx < item.exercises.length - 1 && <View style={styles.groupExDivider} />}
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      {editMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('AggiungiEsercizio', { schedaId })}
          activeOpacity={0.85}
        >
          <FontAwesome5 name="plus" size={20} color={COLORS.white} solid />
        </TouchableOpacity>
      )}

      {/* ⋮ menu esercizio */}
      <ActionSheet
        visible={!!menuEx}
        title={menuEx?.exercise_name}
        onClose={() => setMenuEx(null)}
        options={menuEx ? exMenuOptions(menuEx) : []}
      />

      {/* ⋮ menu gruppo */}
      <ActionSheet
        visible={!!menuGroup}
        title={menuGroup?.name ?? (
          menuGroup?.type === 'superset' ? 'Superserie' :
          menuGroup?.type === 'circuit'  ? 'Circuito'   : 'Gruppo semplice'
        )}
        onClose={() => setMenuGroup(null)}
        options={menuGroup ? [
          {
            label:   'Modifica gruppo',
            icon:    'pen',
            color:   COLORS.primary,
            onPress: () => openEditGroup(menuGroup),
          },
          {
            label:       'Dissolvi gruppo',
            icon:        'object-ungroup',
            destructive: true,
            onPress: () => setConfirmGroup(menuGroup),
          },
        ] : []}
      />

      {/* Conferma rimuovi esercizio */}
      <ConfirmDialog
        visible={!!confirmEx}
        title="Rimuovi esercizio"
        message={`Rimuovere "${confirmEx?.exercise_name}" dalla scheda?`}
        confirmLabel="Rimuovi"
        destructive
        onCancel={() => setConfirmEx(null)}
        onConfirm={() => handleDeleteEx(confirmEx!)}
      />

      {/* Conferma dissolvi gruppo */}
      <ConfirmDialog
        visible={!!confirmGroup}
        title="Dissolvi gruppo"
        message={`Gli esercizi torneranno standalone. Continuare?`}
        confirmLabel="Dissolvi"
        destructive
        onCancel={() => setConfirmGroup(null)}
        onConfirm={() => handleDissolveGroup(confirmGroup!)}
      />

      {/* Conferma elimina scheda */}
      <ConfirmDialog
        visible={confirmDeleteCard}
        title="Elimina scheda"
        message={`Eliminare "${card?.name}"? Verranno rimossi tutti gli esercizi associati.`}
        icon="trash"
        confirmLabel="Elimina"
        destructive
        onCancel={() => setConfirmDeleteCard(false)}
        onConfirm={() => {
          deleteCard(schedaId);
          setConfirmDeleteCard(false);
          navigation.goBack();
        }}
      />

      {/* Group create / edit modal */}
      <GroupModal
        state={groupModal}
        onChange={patch => setGroupModal(prev => ({ ...prev, ...patch }))}
        onConfirm={handleGroupConfirm}
        onCancel={() => setGroupModal(INITIAL_MODAL)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 4,
  },
  backBtnText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '500',
  },

  hero: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  cardName: { color: COLORS.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.3 },
  heroTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  heroTagChip: {
    backgroundColor: COLORS.primary + '18',
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  heroTagChipText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
  notesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  cardNotes: { color: COLORS.textSub, fontSize: 13, fontStyle: 'italic', flex: 1 },
  heroActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editBtnText: { color: COLORS.textSub, fontSize: 13, fontWeight: '500' },
  editBtnDanger: {
    borderColor: COLORS.danger + '44',
    backgroundColor: COLORS.danger + '10',
  },
  editBtnSave: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pencilBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center', justifyContent: 'center',
  },

  sectionSep: { height: 1, backgroundColor: COLORS.border },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionCount: { fontSize: 12, color: COLORS.textMuted },

  listContent: { padding: 16, gap: 10 },
  emptyContainer: { flex: 1 },

  /* Standalone exercise card */
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  cardInGroup: {
    borderRadius: 0,
    elevation: 0,
    shadowOpacity: 0,
    backgroundColor: COLORS.surface,
  },
  accentBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
    backgroundColor: COLORS.success,
  },
  cardContent: { paddingLeft: 20, paddingRight: 14, paddingVertical: 14 },
  cardContentInGroup: { paddingLeft: 16 },
  cardDragging: { elevation: 8, shadowOpacity: 0.3 },

  exerciseRow: { flexDirection: 'row', alignItems: 'flex-start' },
  indexBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10, marginTop: 2,
  },
  indexText: { color: COLORS.textSub, fontSize: 12, fontWeight: '700' },
  exerciseInfo: { flex: 1 },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseName: {
    color: COLORS.text, fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8,
  },
  menuBtn: { padding: 4 },
  dragHandle: { padding: 6, marginLeft: 2 },
  groupReorderBtns: { flexDirection: 'column', gap: 2, marginLeft: 4 },
  reorderBtn: {
    width: 26, height: 26, borderRadius: 6,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  reorderBtnDisabled: { opacity: 0.3 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 20,
  },
  tagRest: {
    backgroundColor: COLORS.primary + '18',
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
  },
  tagTime: {
    backgroundColor: COLORS.accent + '22',
    borderWidth: 1,
    borderColor: COLORS.accent + '44',
  },
  tagBodyweight: {
    backgroundColor: COLORS.success + '22',
    borderWidth: 1,
    borderColor: COLORS.success + '44',
  },
  tagText: { color: COLORS.textSub, fontSize: 11, fontWeight: '500' },
  exerciseNotes: { color: COLORS.textMuted, fontSize: 12, marginTop: 8, fontStyle: 'italic' },

  /* Expand detail — consultazione */
  exerciseDetail: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 6,
  },
  exerciseDetailDesc: { color: COLORS.textSub, fontSize: 13, lineHeight: 19 },
  exerciseDetailNotes: { color: COLORS.textMuted, fontSize: 12, fontStyle: 'italic' },

  /* Group block */
  groupBlock: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  groupTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  groupTypeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  groupMeta: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  groupMetaText: { color: COLORS.textMuted, fontSize: 11, marginLeft: 4 },
  groupName: { color: COLORS.textSub, fontSize: 11, fontWeight: '500', flex: 1 },
  groupDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 14 },
  groupExDivider: { height: 1, backgroundColor: COLORS.border + '80', marginLeft: 16 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  emptyDesc: { color: COLORS.textSub, fontSize: 14, textAlign: 'center', lineHeight: 22 },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});

// ─── Group modal styles ───────────────────────────────────────────────────────

const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    color: COLORS.text,
    fontSize: 18, fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    color: COLORS.textSub,
    fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginTop: 16, marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  typeBtnText:       { color: COLORS.textSub, fontSize: 13, fontWeight: '600' },
  typeBtnTextActive: { color: COLORS.white },

  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperVal: {
    flex: 1,
    color: COLORS.text,
    fontSize: 20, fontWeight: '700',
    textAlign: 'center',
  },

  restPreset: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center',
  },
  restPresetActive: {
    backgroundColor: COLORS.primary + '33',
    borderColor: COLORS.primary,
  },
  restPresetText:       { color: COLORS.textSub, fontSize: 12, fontWeight: '600' },
  restPresetTextActive: { color: COLORS.primary },

  input: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
  },
  cancelBtnText: { color: COLORS.textSub, fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  confirmBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
