import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, Keyboard,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';

import { COLORS } from '../../theme/colors';
import { createCard, updateCard, getCard, getTagsForCard, setTagsForCard } from '../../database/cardRepository';
import { getAllTags } from '../../database/tagRepository';
import type { ExerciseTag } from '../../types';
import type { PianiStackParamList } from '../../navigation/types';

type NavProp    = NativeStackNavigationProp<PianiStackParamList, 'CreaScheda'>;
type RouteProps = RouteProp<PianiStackParamList, 'CreaScheda'>;

const ZONE_ORDER = ['Petto','Schiena','Spalle','Braccia','Gambe','Glutei','Core','Full Body','Cardio'];

export default function CreaSchedaScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteProps>();
  const { pianoId, schedaId } = route.params;
  const insets = useSafeAreaInsets();

  const [name,  setName]  = useState('');
  const [notes, setNotes] = useState('');
  const [zoneTags,       setZoneTags]       = useState<ExerciseTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  useEffect(() => {
    if (!pianoId) {
      Alert.alert('Errore', 'Nessun piano associato a questa scheda.');
      navigation.goBack();
      return;
    }
    const allZone = getAllTags()
      .filter(t => t.type === 'zone')
      .sort((a, b) => ZONE_ORDER.indexOf(a.name) - ZONE_ORDER.indexOf(b.name));
    setZoneTags(allZone);

    if (schedaId) {
      const card = getCard(schedaId);
      if (card) {
        setName(card.name);
        setNotes(card.notes ?? '');
      }
      const existing = getTagsForCard(schedaId);
      setSelectedTagIds(existing.map(t => t.id));
    }
  }, [pianoId, schedaId]);

  const toggleTag = (id: number) =>
    setSelectedTagIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Campo obbligatorio', 'Il nome della scheda è richiesto.');
      return;
    }
    if (!pianoId) return;
    Keyboard.dismiss();
    try {
      if (schedaId) {
        updateCard(schedaId, name, null, notes || null);
        setTagsForCard(schedaId, selectedTagIds);
        navigation.goBack();
      } else {
        const card = createCard(pianoId, name, null, notes || null);
        setTagsForCard(card.id, selectedTagIds);
        navigation.dispatch(
          CommonActions.reset({
            index: 2,
            routes: [
              { name: 'PianiAttivi' },
              { name: 'DettaglioPiano',  params: { pianoId } },
              { name: 'DettaglioScheda', params: { schedaId: card.id, pianoId } },
            ],
          })
        );
      }
    } catch (e: any) {
      Alert.alert('Errore salvataggio', e?.message ?? String(e));
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Nome scheda *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="es. Giorno A - Push"
          placeholderTextColor={COLORS.textMuted}
          maxLength={60}
          autoFocus
        />

        <Text style={styles.label}>Note</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Note libere per questa scheda..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={3}
          maxLength={300}
        />

        {zoneTags.length > 0 && (
          <>
            <View style={styles.tagLabelRow}>
              <Text style={styles.label}>Zona / Focus</Text>
              {selectedTagIds.length > 0 && (
                <TouchableOpacity onPress={() => setSelectedTagIds([])}>
                  <Text style={styles.clearText}>Rimuovi tutti</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.tagGrid}>
              {zoneTags.map(tag => {
                const active = selectedTagIds.includes(tag.id);
                return (
                  <TouchableOpacity
                    key={tag.id}
                    style={[styles.tagChip, active && styles.tagChipActive]}
                    onPress={() => toggleTag(tag.id)}
                    activeOpacity={0.75}
                  >
                    {active && (
                      <FontAwesome5 name="check" size={9} color={COLORS.white} solid style={{ marginRight: 4 }} />
                    )}
                    <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
                      {tag.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.saveFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <FontAwesome5 name="check" size={15} color={COLORS.white} solid />
          <Text style={styles.saveBtnText}>
            {schedaId ? 'Salva modifiche' : 'Crea scheda'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  tagLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16, marginBottom: 8,
  },
  clearText: { color: COLORS.textMuted, fontSize: 12 },

  input: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },

  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tagChipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tagChipText:       { color: COLORS.textSub, fontSize: 13, fontWeight: '500' },
  tagChipTextActive: { color: COLORS.white },

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
