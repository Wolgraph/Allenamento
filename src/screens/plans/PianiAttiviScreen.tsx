import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
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
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setMenuPlan(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <FontAwesome5 name="ellipsis-v" size={16} color={COLORS.textMuted} solid />
          </TouchableOpacity>
        </View>
        <View style={styles.cardMeta}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {item.card_count ?? 0} {item.card_count === 1 ? 'scheda' : 'schede'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const hasPlans = plans.length > 0;

  return (
    <View style={styles.container}>
      <FlatList
        data={plans}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, !hasPlans && styles.listContentEmpty]}
        ListFooterComponent={hasPlans ? (
          <TouchableOpacity
            style={styles.addRow}
            onPress={() => navigation.navigate('CreaPiano', {})}
            activeOpacity={0.7}
          >
            <View style={styles.addCircle}>
              <FontAwesome5 name="plus" size={13} color={COLORS.primary} solid />
            </View>
            <Text style={styles.addRowText}>Nuovo piano</Text>
          </TouchableOpacity>
        ) : null}
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

      {!hasPlans && (
        <View style={[styles.saveFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.createFirstBtn}
            onPress={() => navigation.navigate('CreaPiano', {})}
            activeOpacity={0.85}
          >
            <FontAwesome5 name="plus" size={15} color={COLORS.white} solid />
            <Text style={styles.createFirstBtnText}>Crea il tuo primo piano</Text>
          </TouchableOpacity>
        </View>
      )}

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
  listContentEmpty: { flex: 1 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
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
    paddingVertical: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  menuBtn: { padding: 4, marginTop: 2 },
  cardDesc: {
    color: COLORS.textSub,
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  badge: {
    backgroundColor: COLORS.primary + '1A',
    borderWidth: 1,
    borderColor: COLORS.primary + '55',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  addCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '66',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRowText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '500',
  },

  saveFooter: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  createFirstBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  createFirstBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

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
});
