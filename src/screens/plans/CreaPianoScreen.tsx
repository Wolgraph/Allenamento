import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, Keyboard,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';

import { COLORS } from '../../theme/colors';
import { createPlan, updatePlan, getPlan } from '../../database/planRepository';
import type { PianiStackParamList } from '../../navigation/types';

type NavProp    = NativeStackNavigationProp<PianiStackParamList, 'CreaPiano'>;
type RouteProps = RouteProp<PianiStackParamList, 'CreaPiano'>;

export default function CreaPianoScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteProps>();
  const pianoId    = route.params?.pianoId;
  const insets     = useSafeAreaInsets();

  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (pianoId) {
      const plan = getPlan(pianoId);
      if (plan) {
        setName(plan.name);
        setDescription(plan.description ?? '');
      }
    }
  }, [pianoId]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Campo obbligatorio', 'Il nome del piano è richiesto.');
      return;
    }
    Keyboard.dismiss();
    try {
      if (pianoId) {
        updatePlan(pianoId, name, description || null);
        navigation.goBack();
      } else {
        const plan = createPlan(name, description || null);
        navigation.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [
              { name: 'PianiAttivi' },
              { name: 'DettaglioPiano', params: { pianoId: plan.id } },
            ],
          })
        );
      }
    } catch (e: any) {
      Alert.alert('Errore salvataggio', e?.message ?? String(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Nome piano *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="es. Ipertrofia 3 giorni"
          placeholderTextColor={COLORS.textMuted}
          maxLength={60}
          autoFocus
        />

        <Text style={styles.label}>Descrizione</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Obiettivi, note generali..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={4}
          maxLength={300}
        />
      </ScrollView>

      <View style={[styles.saveFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <FontAwesome5 name="check" size={15} color={COLORS.white} solid />
          <Text style={styles.saveBtnText}>
            {pianoId ? 'Salva modifiche' : 'Crea piano'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content:   { padding: 20, paddingBottom: 16 },

  label: {
    color: COLORS.textSub,
    fontSize: 12, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginTop: 16, marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
  },
  inputMultiline: { minHeight: 100, textAlignVertical: 'top' },

  saveFooter: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
