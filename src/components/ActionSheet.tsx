import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  TouchableWithoutFeedback, StyleSheet, Animated,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';

export interface ActionSheetOption {
  label:        string;
  icon?:        string;
  color?:       string;
  destructive?: boolean;
  onPress:      () => void;
}

interface Props {
  visible:  boolean;
  title?:   string;
  options:  ActionSheetOption[];
  onClose:  () => void;
}

export default function ActionSheet({ visible, title, options, onClose }: Props) {
  const insets       = useSafeAreaInsets();
  const translateY   = useRef(new Animated.Value(400)).current;
  const backdropOp   = useRef(new Animated.Value(0)).current;
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      Animated.parallel([
        Animated.timing(backdropOp, {
          toValue: 1, duration: 220, useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0, useNativeDriver: true,
          tension: 65, friction: 11,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOp, {
          toValue: 0, duration: 180, useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 400, duration: 200, useNativeDriver: true,
        }),
      ]).start(() => {
        setShow(false);
        translateY.setValue(400);
      });
    }
  }, [visible]);

  const handleOption = (opt: ActionSheetOption) => {
    onClose();
    setTimeout(opt.onPress, 50);
  };

  return (
    <Modal
      visible={show}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOp }]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 20), transform: [{ translateY }] },
        ]}
      >
        {/* Drag indicator */}
        <View style={styles.handle} />

        {/* Title */}
        {title && (
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          </View>
        )}

        {/* Options */}
        <View style={styles.optionsContainer}>
          {options.map((opt, i) => {
            const color = opt.destructive ? COLORS.danger : (opt.color ?? COLORS.text);
            const isLast = i === options.length - 1;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.option, !isLast && styles.optionDivider]}
                onPress={() => handleOption(opt)}
                activeOpacity={0.6}
              >
                {opt.icon && (
                  <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
                    <FontAwesome5 name={opt.icon as any} size={15} color={color} solid />
                  </View>
                )}
                <Text style={[styles.optionLabel, { color }]}>{opt.label}</Text>
                <FontAwesome5 name="chevron-right" size={11} color={COLORS.textMuted} solid />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Cancel */}
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Annulla</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 24,
  },

  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textMuted,
    marginBottom: 12,
    opacity: 0.5,
  },

  titleRow: {
    paddingHorizontal: 4,
    paddingBottom: 12,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  optionsContainer: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 16,
    marginTop: 12,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
    gap: 14,
  },
  optionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  iconWrap: {
    width: 36, height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },

  cancelBtn: {
    marginTop: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelText: {
    color: COLORS.textSub,
    fontSize: 16,
    fontWeight: '600',
  },
});
