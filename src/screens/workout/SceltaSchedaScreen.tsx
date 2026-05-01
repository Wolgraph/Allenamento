import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ScrollView,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';

import { COLORS } from '../../theme/colors';
import { getActivePlans } from '../../database/planRepository';
import { getCardsForPlan } from '../../database/cardRepository';
import { getLastCardForPlan } from '../../database/sessionRepository';
import type { TrainingPlan, WorkoutCard } from '../../types';
import type { WorkoutStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<WorkoutStackParamList, 'SceltaScheda'>;

export default function SceltaSchedaScreen() {
  const navigation = useNavigation<NavProp>();

  const [plans,        setPlans]        = useState<TrainingPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<TrainingPlan | null>(null);
  const [cards,        setCards]        = useState<WorkoutCard[]>([]);
  const [lastCardId,   setLastCardId]   = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      const activePlans = getActivePlans();
      setPlans(activePlans);
      setSelectedPlan(null);
      setCards([]);
      setLastCardId(null);
      if (activePlans.length === 1) selectPlan(activePlans[0]);
    }, [])
  );

  const selectPlan = (plan: TrainingPlan) => {
    setSelectedPlan(plan);
    setCards(getCardsForPlan(plan.id));
    setLastCardId(getLastCardForPlan(plan.id));
  };

  const startWorkout = (card: WorkoutCard) => {
    if (!selectedPlan) return;
    navigation.navigate('AllenamentoAttivo', {
      cardId: card.id, planId: selectedPlan.id, cardName: card.name,
    });
  };

  if (plans.length === 0) {
    return (
      <View style={styles.empty}>
        <FontAwesome5 name="dumbbell" size={52} color={COLORS.textMuted} solid />
        <Text style={styles.emptyTitle}>Nessun piano attivo</Text>
        <Text style={styles.emptyDesc}>
          Crea un piano nella tab Piani{'\n'}prima di iniziare un allenamento.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {plans.length > 1 && (
        <>
          <Text style={styles.sectionLabel}>Seleziona piano</Text>
          <View style={styles.planList}>
            {plans.map((plan) => {
              const isSelected = selectedPlan?.id === plan.id;
              return (
                <TouchableOpacity
                  key={plan.id}
                  style={[styles.planCard, isSelected && styles.planCardSelected]}
                  onPress={() => selectPlan(plan)}
                  activeOpacity={0.75}
                >
                  {isSelected && <View style={styles.planAccent} />}
                  <View style={styles.planCardContent}>
                    <Text style={[styles.planCardTitle, isSelected && styles.planCardTitleSelected]}>
                      {plan.name}
                    </Text>
                    {plan.description ? (
                      <Text style={styles.planCardDesc} numberOfLines={1}>{plan.description}</Text>
                    ) : null}
                  </View>
                  {isSelected && (
                    <FontAwesome5 name="check-circle" size={18} color={COLORS.primary} solid />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {selectedPlan && (
        <>
          <Text style={styles.sectionLabel}>
            {plans.length > 1 ? 'Seleziona scheda' : selectedPlan.name}
          </Text>

          {cards.length === 0 ? (
            <View style={styles.noCards}>
              <Text style={styles.noCardsText}>
                Questo piano non ha schede. Aggiungile nella tab Piani.
              </Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {cards.map((card) => {
                const isLast = card.id === lastCardId;
                return (
                  <TouchableOpacity
                    key={card.id}
                    style={styles.cardItem}
                    onPress={() => startWorkout(card)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.cardAccentBar} />
                    <View style={styles.cardItemContent}>
                      <View style={styles.cardItemLeft}>
                        <View style={styles.cardItemTitleRow}>
                          <Text style={styles.cardItemTitle}>{card.name}</Text>
                          {isLast && (
                            <View style={styles.lastBadge}>
                              <FontAwesome5 name="history" size={9} color={COLORS.accent} solid />
                              <Text style={styles.lastBadgeText}>Ultima usata</Text>
                            </View>
                          )}
                        </View>
                        {card.description ? (
                          <Text style={styles.cardItemDesc} numberOfLines={1}>{card.description}</Text>
                        ) : null}
                        <Text style={styles.cardItemMeta}>
                          <FontAwesome5 name="list-ul" size={10} color={COLORS.textMuted} solid />
                          {'  '}{card.exercise_count ?? 0} esercizi
                        </Text>
                      </View>
                      <FontAwesome5 name="chevron-right" size={14} color={COLORS.primary} solid />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content:   { padding: 16, gap: 12 },

  sectionLabel: {
    color: COLORS.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase',
    marginTop: 4, marginBottom: 2, marginLeft: 4,
  },

  planList: { gap: 8 },
  planCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 16, paddingRight: 16, paddingVertical: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  planCardSelected: { backgroundColor: COLORS.primary + '18' },
  planAccent: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 4, backgroundColor: COLORS.primary,
  },
  planCardContent:      { flex: 1, marginRight: 8 },
  planCardTitle:        { color: COLORS.textSub, fontSize: 16, fontWeight: '600' },
  planCardTitleSelected:{ color: COLORS.text },
  planCardDesc:         { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },

  cardList: { gap: 10 },
  cardItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 14, overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  cardAccentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 4, backgroundColor: COLORS.success,
  },
  cardItemContent: {
    paddingLeft: 20, paddingRight: 16, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  cardItemLeft: { flex: 1 },
  cardItemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardItemTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  cardItemDesc:  { color: COLORS.textSub, fontSize: 13, marginTop: 3 },
  cardItemMeta:  { color: COLORS.textMuted, fontSize: 12, marginTop: 5 },

  lastBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.accent + '22',
    borderWidth: 1, borderColor: COLORS.accent,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20,
  },
  lastBadgeText: { color: COLORS.accent, fontSize: 10, fontWeight: '700' },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 40, backgroundColor: COLORS.bg, gap: 12,
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  emptyDesc:  { color: COLORS.textSub, fontSize: 15, textAlign: 'center', lineHeight: 22 },

  noCards: { padding: 20, alignItems: 'center' },
  noCardsText: { color: COLORS.textSub, fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
