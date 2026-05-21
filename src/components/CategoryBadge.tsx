import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DSType } from '../constants/colors';
import { hexToRgba } from '../utils/color';
import { useDS } from '../hooks/useDS';

type BadgeSize = 'sm' | 'md';

interface CategoryBadgeProps {
  icon: string;
  label: string;
  color: string;
  size?: BadgeSize;
}

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: ds.radius.full,
      gap: 4,
      alignSelf: 'flex-start',
    },
    label: {
      fontFamily: 'Inter_600SemiBold',
      letterSpacing: 0.3,
    },
  });
}

export default function CategoryBadge({
  icon,
  label,
  color,
  size = 'md',
}: CategoryBadgeProps) {
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);

  const isSm = size === 'sm';
  const iconSize = isSm ? 12 : 16;
  const fontSize = isSm ? 11 : 13;
  const paddingH = isSm ? 8 : 12;
  const paddingV = isSm ? 4 : 6;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: hexToRgba(color, 0.15),
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
        size={iconSize}
        color={color}
      />
      <Text style={[styles.label, { color, fontSize }]}>{label}</Text>
    </View>
  );
}
