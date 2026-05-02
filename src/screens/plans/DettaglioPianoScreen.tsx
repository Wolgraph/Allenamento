import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';

import { COLORS } from '../../theme/colors';
import { getPlan, deletePlan } from '../../database/planRepository';
import { getCardsForPlan, deleteCard, reorderCards, getTagsForCard } from '../../database/cardRepository';
import { exportPlanToFile } from '../../utils/workoutFile';
import ActionSheet from '../../components/ActionSheet';
import ConfirmDialog from '../../components/ConfirmDialog';
import type { WorkoutCard, TrainingPlan, ExerciseTag } from '../../types';
import type { PianiStackParamList } from '../../navigation/types';

type NavProp    = NativeStackNavigationProp<PianiStackParamList, 'DettaglioPiano'>;
type RouteProps = RouteProp<PianiStackParamList, 'DettaglioPiano'>;

export default function DettaglioPianoScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteProps>();
  const { pianoId } = route.params;

  const [plan,         setPlan]         = useState<TrainingPlan | null>(null);
  const [cards,        setCards]        = useState<WorkoutCard[]>([]);
  const [cardTagsMap,  setCardTagsMap]  = useState<Record<number, ExerciseTag[]>>({});

  const [menuCard,      setMenuCard]      = useState<WorkoutCard | null>(null);
  const [confirmCard,   setConfirmCard]   = useState<WorkoutCard | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    setPlan(getPlan(pianoId));
    const c = getCardsForPlan(pianoId);
    setCards(c);
    const map: Record<number, ExerciseTag[]> = {};
    for (const card of c) map[card.id] = getTagsForCard(card.id);
    setCardTagsMap(map);
  }, [pianoId]);

  useFocusEffect(load);

  // Sostituisce l'header nativo del navigator con un back link "< Piani"
  // che rispecchia lo stile hero invece del titolo "Dettaglio Piano" standard.
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
          <Text style={styles.backBtnText}>Piani</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const renderCard = ({ item, drag, isActive }: RenderItemParams<WorkoutCard>) => {
    const tags = cardTagsMap[item.id] ?? [];
    return (
    <ScaleDecorator>
      <TouchableOpacity
        style={[styles.card, isActive && styles.cardDragging]}
        onPress={() => navigation.navigate('DettaglioScheda', { schedaId: item.id, pianoId })}
        activeOpacity={0.75}
      >
        <View style={styles.accentBar} />
        <View style={styles.cardContent}>
          <View style={styles.cardRow}>
            <View style={styles.cardLeft}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
              {tags.length > 0 && (
                <View style={styles.tagRow}>
                  {tags.map(t => (
                    <View key={t.id} style={styles.tagBadge}>
                      <Text style={styles.tagBadgeText}>{t.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.cardRight}>
              <View style={styles.exBadge}>
                <Text style={styles.exBadgeNum}>{item.exercise_count ?? 0}</Text>
                <Text style={styles.exBadgeLabel}>es.</Text>
              </View>
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => setMenuCard(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <FontAwesome5 name="ellipsis-v" size={14} color={COLORS.textMuted} solid />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dragHandle}
                onLongPress={drag}
                delayLongPress={150}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <FontAwesome5 name="bars" size={14} color={COLORS.textMuted} solid />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </ScaleDecorator>
    );
  };

  return (
    <View style={styles.container}>
      {plan && (
        <View style={styles.hero}>
          <Text style={styles.planName}>{plan.name}</Text>
          {plan.description ? (
            <Text style={styles.planDesc}>{plan.description}</Text>
          ) : null}
          <View style={styles.statusRow}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>Attivo</Text>
            </View>
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('CreaPiano', { pianoId })}
            >
              <FontAwesome5 name="pen" size={11} color={COLORS.textSub} solid />
              <Text style={styles.actionBtnText}>Modifica</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => {
                try { await exportPlanToFile(pianoId); }
                catch (e) { Alert.alert('Errore export', String(e)); }
              }}
            >
              <FontAwesome5 name="share-alt" size={11} color={COLORS.textSub} solid />
              <Text style={styles.actionBtnText}>Condividi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => setConfirmDelete(true)}
            >
              <FontAwesome5 name="trash" size={11} color={COLORS.danger} solid />
              <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Elimina</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <View style={styles.sectionSep} />
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>Schede</Text>
        <Text style={styles.sectionCount}>{cards.length}</Text>
      </View>

      <DraggableFlatList
        data={cards}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderCard}
        onDragEnd={({ data }) => {
          setCards(data);
          reorderCards(data.map((c) => c.id));
        }}
        contentContainerStyle={cards.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <FontAwesome5 name="clipboard" size={44} color={COLORS.textMuted} solid />
            <Text style={styles.emptyTitle}>Nessuna scheda</Text>
            <Text style={styles.emptyDesc}>
              Aggiungi la prima scheda di allenamento{'\n'}per questo piano.
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreaScheda', { pianoId })}
        activeOpacity={0.85}
      >
        <FontAwesome5 name="plus" size={20} color={COLORS.white} solid />
      </TouchableOpacity>

      {/* ⋮ menu scheda */}
      <ActionSheet
        visible={!!menuCard}
        title={menuCard?.name}
        onClose={() => setMenuCard(null)}
        options={[
          {
            label: 'Modifica scheda',
            icon:  'pen',
            color: COLORS.primary,
            onPress: () => navigation.navigate('CreaScheda', { pianoId, schedaId: menuCard!.id }),
          },
          {
            label:       'Elimina scheda',
            icon:        'trash',
            destructive: true,
            onPress: () => setConfirmCard(menuCard),
          },
        ]}
      />

      {/* Conferma elimina scheda */}
      <ConfirmDialog
        visible={!!confirmCard}
        title="Elimina scheda"
        message={`Eliminare "${confirmCard?.name}"? Verranno rimossi anche tutti gli esercizi.`}
        confirmLabel="Elimina"
        destructive
        onCancel={() => setConfirmCard(null)}
        onConfirm={() => {
          deleteCard(confirmCard!.id);
          setConfirmCard(null);
          load();
        }}
      />

      {/* Conferma elimina piano */}
      <ConfirmDialog
        visible={confirmDelete}
        title="Elimina piano"
        message={`Eliminare "${plan?.name}"? Verranno rimosse tutte le schede, gli esercizi e lo storico associato.`}
        icon="trash"
        confirmLabel="Elimina"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deletePlan(pianoId);
          setConfirmDelete(false);
          navigation.goBack();
        }}
      />
    </View>
  );
}

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
  planName: { color: COLORS.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.3 },
  planDesc: { color: COLORS.textSub, fontSize: 14, marginTop: 4, lineHeight: 20 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  statusBadge: {
    backgroundColor: COLORS.success + '22',
    borderWidth: 1,
    borderColor: COLORS.success + '55',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statusBadgeText: { color: COLORS.success, fontSize: 11, fontWeight: '600' },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  actionBtn: {
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
  actionBtnDanger: {
    borderColor: COLORS.danger + '44',
    backgroundColor: COLORS.danger + '10',
  },
  actionBtnText: { color: COLORS.textSub, fontSize: 13, fontWeight: '500' },
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

  listContent: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  accentBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
    backgroundColor: COLORS.accent,
  },
  cardContent: {
    paddingLeft: 20,
    paddingRight: 12,
    paddingVertical: 14,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardLeft: { flex: 1, marginRight: 8 },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  cardDesc:  { color: COLORS.textSub, fontSize: 13, marginTop: 2 },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  tagBadge: {
    backgroundColor: COLORS.primary + '1A',
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagBadgeText: { color: COLORS.primary, fontSize: 11, fontWeight: '600' },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exBadge: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  exBadgeNum: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  exBadgeLabel: { color: COLORS.textSub, fontSize: 10 },
  menuBtn: { padding: 4 },
  dragHandle: { padding: 6, marginLeft: 4 },
  cardDragging: { elevation: 8, shadowOpacity: 0.3 },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 40, gap: 12,
  },
  emptyTitle: {
    color: COLORS.text, fontSize: 18, fontWeight: '600',
    marginTop: 8, textAlign: 'center',
  },
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