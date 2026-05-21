import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DS } from '../constants';

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  style?: ViewStyle;
}

export default function SecondaryButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
  style,
}: SecondaryButtonProps) {
  const inactive = loading || disabled;

  return (
    <TouchableOpacity
      style={[styles.button, inactive && styles.dimmed, style]}
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={DS.text.primary} size="small" />
      ) : (
        <View style={styles.inner}>
          {icon != null && (
            <MaterialCommunityIcons name={icon} size={18} color={DS.text.primary} />
          )}
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'transparent',
    borderRadius: DS.radius.md,
    borderWidth: 1.5,
    borderColor: DS.border.medium,
    height: 52,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: DS.text.primary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    letterSpacing: 0.14,
  },
  dimmed: {
    opacity: 0.45,
  },
});
