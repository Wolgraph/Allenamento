import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';

import { COLORS } from '../../theme/colors';
import {
  getTimerFeedbackSync, setTimerFeedback,
  type TimerFeedback,
} from '../../utils/settings';
import { getArchivedPlans, reactivatePlan } from '../../database/planRepository';
import { importPlanFromFile } from '../../utils/workoutFile';
import ConfirmDialog from '../../components/ConfirmDialog';
import type { TrainingPlan } from '../../types';

interface FeedbackOption {
  value:    TimerFeedback;
  label:    string;
  icon:     string;
  color:    string;
}

const FEEDBACK_OPTIONS: FeedbackOption[] = [
  { value: 'vibration', label: 'Solo vibrazione',    icon: 'mobile-alt',  color: COLORS.primary },
  { value: 'sound',     label: 'Solo suono',          icon: 'bell',        color: COLORS.accent  },
  { value: 'both',      label: 'Vibrazione + suono',  icon: 'volume-up',   color: COLORS.success },
  { value: 'none',      label: 'Nessuno',             icon: 'bell-slash',  color: COLORS.textMuted },
];

export default function ImpostazioniScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [feedback,      setFeedbackState] = useState<TimerFeedback>(getTimerFeedbackSync());
  const [archivedPlans,  setArchivedPlans]  = useState<TrainingPlan[]>([]);
  const [importing,      setImporting]      = useState(false);
  const [confirmPlan,    setConfirmPlan]    = useState<TrainingPlan | null>(null);

  const load = useCallback(() => {
    setFeedbackState(getTimerFeedbackSync());
    setArchivedPlans(getArchivedPlans());
  }, []);

  useFocusEffect(load);

  const handleFeedbackChange = async (value: TimerFeedback) => {
    setFeedbackState(value);
    await setTimerFeedback(value);
  };

  const handleReactivate = (plan: TrainingPlan) => setConfirmPlan(plan);

  const handleImport = async () => {
    setImporting(true);
    try {
      const name = await importPlanFromFile();
      if (name) {
        Alert.alert(
          'Piano importato',
          `"${name}" è stato aggiunto ai tuoi piani attivi.`,
          [{ text: 'OK', onPress: () => navigation.navigate('Piani') }]
        );
      }
    } catch (e) {
      Alert.alert('Errore import', String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>

      <Text style={styles.screenTitle}>Impostazioni</Text>

      {/* Feedback timer */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="stopwatch" size={14} color={COLORS.primary} solid />
          <Text style={styles.sectionTitle}>Feedback fine recupero</Text>
        </View>
        {FEEDBACK_OPTIONS.map((opt) => {
          const isActive = feedback === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionRow, isActive && styles.optionRowActive]}
              onPress={() => handleFeedbackChange(opt.value)}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIcon, isActive && { backgroundColor: opt.color + '22' }]}>
                <FontAwesome5 name={opt.icon as any} size={16} color={isActive ? opt.color : COLORS.textMuted} solid />
              </View>
              <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>
                {opt.label}
              </Text>
              {isActive && (
                <FontAwesome5 name="check-circle" size={18} color={COLORS.primary} solid />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Import */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="file-import" size={14} color={COLORS.accent} solid />
          <Text style={styles.sectionTitle}>Import piano</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Importa un file .workout ricevuto dal tuo personal trainer.
          Gli esercizi non presenti verranno aggiunti automaticamente.
        </Text>
        <TouchableOpacity
          style={styles.importBtn}
          onPress={handleImport}
          disabled={importing}
          activeOpacity={0.85}
        >
          {importing
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <>
                <FontAwesome5 name="download" size={15} color={COLORS.white} solid />
                <Text style={styles.importBtnText}>Importa .workout</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {/* Piani archiviati */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="archive" size={14} color={COLORS.textSub} solid />
          <Text style={styles.sectionTitle}>Piani archiviati</Text>
        </View>
        {archivedPlans.length === 0 ? (
          <Text style={styles.emptyText}>Nessun piano archiviato.</Text>
        ) : (
          archivedPlans.map((plan) => (
            <View key={plan.id} style={styles.archivedRow}>
              <View style={styles.archivedInfo}>
                <Text style={styles.archivedName} numberOfLines={1}>{plan.name}</Text>
                {plan.description ? (
                  <Text style={styles.archivedDesc} numberOfLines={1}>{plan.description}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.reactivateBtn}
                onPress={() => handleReactivate(plan)}
                activeOpacity={0.8}
              >
                <FontAwesome5 name="redo" size={11} color={COLORS.success} solid />
                <Text style={styles.reactivateBtnText}>Riattiva</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* Conferma riattiva */}
      <ConfirmDialog
        visible={!!confirmPlan}
        title="Riattiva piano"
        message={`Riattivare "${confirmPlan?.name}"? Tornerà tra i piani attivi.`}
        icon="redo"
        confirmLabel="Riattiva"
        onCancel={() => setConfirmPlan(null)}
        onConfirm={() => {
          reactivatePlan(confirmPlan!.id);
          setArchivedPlans((prev) => prev.filter((p) => p.id !== confirmPlan!.id));
          setConfirmPlan(null);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content:   { padding: 16, paddingBottom: 32 },

  screenTitle: {
    color: COLORS.text, fontSize: 22, fontWeight: '700',
    marginBottom: 16, marginTop: 8,
  },

  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 16, padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 14,
  },
  sectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  sectionDesc:  { color: COLORS.textSub, fontSize: 13, lineHeight: 18, marginBottom: 14 },

  optionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 4,
    gap: 12, borderRadius: 10,
  },
  optionRowActive: { backgroundColor: COLORS.primary + '10' },
  optionIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  optionLabel:       { color: COLORS.textSub, fontSize: 15, flex: 1 },
  optionLabelActive: { color: COLORS.text, fontWeight: '600' },

  importBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  importBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },

  emptyText: { color: COLORS.textMuted, fontSize: 13, fontStyle: 'italic', paddingVertical: 4 },

  archivedRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    gap: 12,
  },
  archivedInfo:  { flex: 1 },
  archivedName:  { color: COLORS.text, fontSize: 15, fontWeight: '500' },
  archivedDesc:  { color: COLORS.textSub, fontSize: 12, marginTop: 2 },
  reactivateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.success + '18',
    borderWidth: 1, borderColor: COLORS.success,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  reactivateBtnText: { color: COLORS.success, fontSize: 13, fontWeight: '600' },
});
