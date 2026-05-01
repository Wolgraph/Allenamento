import React from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  TouchableWithoutFeedback, StyleSheet,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

interface Props {
  visible:       boolean;
  title:         string;
  message?:      string;
  icon?:         string;
  iconColor?:    string;
  confirmLabel?: string;
  cancelLabel?:  string;
  destructive?:  boolean;
  onConfirm:     () => void;
  onCancel:      () => void;
}

export default function ConfirmDialog({
  visible, title, message,
  icon, iconColor,
  confirmLabel = 'Conferma',
  cancelLabel  = 'Annulla',
  destructive  = false,
  onConfirm, onCancel,
}: Props) {
  const confirmColor = destructive ? COLORS.danger : COLORS.primary;
  const resolvedIcon = icon ?? (destructive ? 'exclamation-triangle' : 'question-circle');
  const resolvedIconColor = iconColor ?? confirmColor;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.centerer}>
        <View style={styles.dialog}>
          {/* Icon */}
          <View style={[styles.iconWrap, { backgroundColor: resolvedIconColor + '20' }]}>
            <FontAwesome5 name={resolvedIcon as any} size={26} color={resolvedIconColor} solid />
          </View>

          {/* Text */}
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.75}>
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: confirmColor }]}
              onPress={onConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmLabel}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  centerer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    pointerEvents: 'box-none' as any,
  },

  dialog: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    width: '100%',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  iconWrap: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },

  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: COLORS.textSub,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 2,
    marginBottom: 4,
  },

  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelLabel: {
    color: COLORS.textSub,
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmLabel: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
