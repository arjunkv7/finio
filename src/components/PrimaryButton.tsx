import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  style?: ViewStyle;
}

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    button: {
      backgroundColor: ds.primary,
      borderRadius: ds.radius.md,
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
      color: '#fff',
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      letterSpacing: 0.14,
    },
    dimmed: {
      opacity: 0.55,
    },
  });
}

export default function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
  style,
}: PrimaryButtonProps) {
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);
  const inactive = loading || disabled;

  return (
    <TouchableOpacity
      style={[styles.button, inactive && styles.dimmed, style]}
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <View style={styles.inner}>
          {icon != null && (
            <MaterialCommunityIcons name={icon} size={18} color="#fff" />
          )}
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
