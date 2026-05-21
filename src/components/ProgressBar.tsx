import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DS } from '../constants';

interface ProgressBarProps {
  value: number;
  max: number;
  color: string;
  height?: number;
  showPercent?: boolean;
  label?: string;
}

export default function ProgressBar({
  value,
  max,
  color,
  height = 6,
  showPercent = false,
  label,
}: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <View>
      {(label != null || showPercent) && (
        <View style={styles.meta}>
          {label != null && <Text style={styles.label}>{label}</Text>}
          {showPercent && (
            <Text style={[styles.percent, { color }]}>{percent}%</Text>
          )}
        </View>
      )}

      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${percent}%`,
              backgroundColor: color,
              height,
              borderRadius: height / 2,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: DS.surface.elevated,
    overflow: 'hidden',
  },
  fill: {},
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: DS.text.secondary,
  },
  percent: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
  },
});
