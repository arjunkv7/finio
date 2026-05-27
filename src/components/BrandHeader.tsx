import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDS } from '../hooks/useDS';

interface BrandHeaderProps {
  right?: React.ReactNode | null;
  onBack?: () => void;
}

export default function BrandHeader({ right, onBack }: BrandHeaderProps) {
  const ds = useDS();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          borderBottomColor: ds.border.subtle,
        },
      ]}
    >
      {/* Left — back button or brand */}
      {onBack != null ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={ds.text.primary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.brand}>
          <View style={[styles.dot, { backgroundColor: ds.primary }]}>
            <MaterialCommunityIcons name="leaf" size={18} color="#fff" />
          </View>
          <Text style={[styles.name, { color: ds.primary }]}>Finio</Text>
        </View>
      )}

      {/* Right slot — pass right={null} to hide, omit for default bell */}
      <View style={styles.rightSlot}>
        {right === undefined ? (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: ds.surface.card, borderColor: ds.border.subtle }]}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="bell-outline" size={20} color={ds.text.secondary} />
          </TouchableOpacity>
        ) : (
          right
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
  },
  backBtn: {
    height: 40,
    justifyContent: 'center',
    padding: 4,
    marginLeft: -4,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    letterSpacing: -0.5,
  },
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
