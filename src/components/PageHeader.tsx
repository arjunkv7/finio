import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDS } from '../hooks/useDS';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, onBack, right }: PageHeaderProps) {
  const ds = useDS();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {onBack != null && (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={ds.text.primary} />
        </TouchableOpacity>
      )}
      <View style={styles.titles}>
        <Text style={[styles.title, { color: ds.text.primary }]} numberOfLines={1}>{title}</Text>
        {subtitle != null && (
          <Text style={[styles.subtitle, { color: ds.text.muted }]} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>
      {right != null && right}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    height: 40,
    justifyContent: 'center',
    padding: 4,
    marginLeft: -4,
    marginRight: 4,
  },
  titles: {
    flex: 1,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.48,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
});
