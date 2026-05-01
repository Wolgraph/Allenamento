import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';

import { COLORS } from '../../theme/colors';
import { getActivePlans, archivePlan, deletePlan } from '../../database/planRepository';
import ActionSheet from '../../components/ActionSheet';
import ConfirmDialog from '../../components/ConfirmDialog';
import type { TrainingPlan } from '../../types';
import type { PianiStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<PianiStackParamList, 'PianiAttivi'>;

export default function PianiAttiviScreen() {
  const navigation = useNavigation<NavProp>();
  const [plans, setPlans] = useState<TrainingPlan[]>([]);

  const [menuPlan,      setMenuPlan]      = useState<TrainingPlan | null>(null);
  const [confirmPlan,   setConfirmPlan]   = useState<TrainingPlan | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TrainingPlan | null>(null);

  const loadPlans = useCallback(() => setPlans(getActivePlans()), []);
  useFocusEffect(loadPlans);

  const renderItem = ({ item }: { item: TrainingPlan }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('DettaglioPiano', { pianoId: item.id })}
      activeOpacity={0.75}
    >
      <View style={styles.accentBar} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {item.card_count ?? 0} {item.card_count === 1 ? 'scheda' : 'schede'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setMenuPlan(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <FontAwesome5 name="ellipsis-v" size={16} color={COLORS.textMuted} solid />
          </TouchableOpacity>
        </View>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={plans}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={plans.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={loadPlans} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <FontAwesome5 name="dumbbell" size={48} color={COLORS.textMuted} solid />
            <Text style={styles.emptyTitle}>Nessun piano attivo</Text>
            <Text style={styles.emptyDesc}>
              Crea il tuo primo piano di allenamento{'\n'}o importane uno dal tuo PT.
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreaPiano', {})}
        activeOpacity={0.85}
      >
        <FontAwesome5 name="plus" size={20} color={COLORS.white} solid />
      </TouchableOpacity>

      {/* ⋮ menu */}
      <ActionSheet
        visible={!!menuPlan}
        title={menuPlan?.name}
        onClose={() => setMenuPlan(null)}
        options={[
          {
            label: 'Modifica piano',
            icon:  'pen',
            color: COLORS.primary,
            onPress: () => navigation.navigate('CreaPiano', { pianoId: menuPlan!.id }),
          },
          {
            label:       'Archivia piano',
            icon:        'archive',
            destructive: true,
            onPress: () => setConfirmPlan(menuPlan),
          },
          {
            label:       'Elimina piano',
            icon:        'trash',
            destructive: true,
            onPress: () => setConfirmDelete(menuPlan),
          },
        ]}
      />

      {/* Conferma archivia */}
      <ConfirmDialog
        visible={!!confirmPlan}
        title="Archivia piano"
        message={`Archiviare "${confirmPlan?.name}"? Potrai riattivarlo dalle Impostazioni.`}
        icon="archive"
        confirmLabel="Archivia"
        destructive
        onCancel={() => setConfirmPlan(null)}
        onConfirm={() => {
          archivePlan(confirmPlan!.id);
          setConfirmPlan(null);
          loadPlans();
        }}
      />

      {/* Conferma elimina */}
      <ConfirmDialog
        visible={!!confirmDelete}
        title="Elimina piano"
        message={`Eliminare "${confirmDelete?.name}"? Verranno rimosse tutte le schede, gli esercizi e lo storico associato.`}
        icon="trash"
        confirmLabel="Elimina"
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          deletePlan(confirmDelete!.id);
          setConfirmDelete(null);
          loadPlans();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
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
    backgroundColor: COLORS.primary,
  },
  cardContent: {
    paddingLeft: 20,
    paddingRight: 14,
    paddingVertical: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
    flexWrap: 'wrap',
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    flexShrink: 1,
  },
  badge: {
    backgroundColor: COLORS.primary + '33',
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  badgeText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  menuBtn: { padding: 4 },
  cardDesc: {
    color: COLORS.textSub,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    color: COLORS.textSub,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});
