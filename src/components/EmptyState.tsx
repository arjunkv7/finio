import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DS } from '../constants';
import PrimaryButton from './PrimaryButton';

interface EmptyStateProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  ctaLabel,
  onCtaPress,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconRing}>
        <MaterialCommunityIcons name={icon} size={32} color={DS.text.muted} />
      </View>

      <Text style={styles.title}>{title}</Text>

      {subtitle != null && (
        <Text style={styles.subtitle}>{subtitle}</Text>
      )}

      {ctaLabel != null && onCtaPress != null && (
        <PrimaryButton
          label={ctaLabel}
          onPress={onCtaPress}
          style={styles.cta}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: DS.surface.elevated,
    borderWidth: 1,
    borderColor: DS.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
    color: DS.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: DS.text.muted,
    textAlign: 'center',
    marginBottom: 28,
  },
  cta: {
    width: 200,
  },
});
