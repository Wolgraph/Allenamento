import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme/colors';

export default function AllenamentoPlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>💪</Text>
      <Text style={styles.title}>Allenamento</Text>
      <Text style={styles.desc}>Disponibile al completamento dello Step 2</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  icon:  { fontSize: 56, marginBottom: 16 },
  title: { color: COLORS.text,    fontSize: 22, fontWeight: '700', marginBottom: 8 },
  desc:  { color: COLORS.textSub, fontSize: 15, textAlign: 'center' },
});
