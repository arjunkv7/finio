import React from 'react';
import { View, StyleProp, ViewStyle, StyleSheet } from 'react-native';
import { DS } from '../constants';

interface AppCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accentColor?: string;
  padding?: number;
}

export default function AppCard({
  children,
  style,
  accentColor,
  padding = 16,
}: AppCardProps) {
  return (
    <View
      style={[
        styles.card,
        accentColor != null && {
          borderLeftColor: accentColor,
          borderLeftWidth: 3,
          borderRadius: DS.radius.xl,
          // Override left radius to keep accent flush
          borderTopLeftRadius: DS.radius.md,
          borderBottomLeftRadius: DS.radius.md,
        },
        { padding },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DS.surface.card,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.border.subtle,
    ...DS.shadow.card,
  },
});
