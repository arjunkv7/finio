import React, { useMemo } from 'react';
import { View, StyleProp, ViewStyle, StyleSheet } from 'react-native';
import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';

interface AppCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accentColor?: string;
  padding?: number;
}

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    card: {
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.xl,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      ...ds.shadow.card,
    },
  });
}

export default function AppCard({
  children,
  style,
  accentColor,
  padding = 16,
}: AppCardProps) {
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);

  return (
    <View
      style={[
        styles.card,
        accentColor != null && {
          borderLeftColor: accentColor,
          borderLeftWidth: 3,
          borderRadius: ds.radius.xl,
          // Override left radius to keep accent flush
          borderTopLeftRadius: ds.radius.md,
          borderBottomLeftRadius: ds.radius.md,
        },
        { padding },
        style,
      ]}
    >
      {children}
    </View>
  );
}
