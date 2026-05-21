import React from 'react';
import { Text, TextStyle } from 'react-native';
import { Typography } from '../constants';
import { useSettingsStore } from '../store/settingsStore';
import { useDS } from '../hooks/useDS';

type AmountSize = 'sm' | 'md' | 'lg' | 'xl';
type AmountType = 'income' | 'expense' | 'neutral';

interface AmountTextProps {
  amount: number; // in paise (smallest unit); divide by 100 for display
  type: AmountType;
  size: AmountSize;
  showSign?: boolean;
  style?: TextStyle;
}

const SIZE_STYLE: Record<AmountSize, TextStyle> = {
  sm: Typography.labelMd,          // 14 / 500
  md: Typography.bodyLg,           // 18 / 400
  lg: Typography.headlineLgMobile, // 24 / 700
  xl: Typography.displayAmount,    // 48 / 700
};

export default function AmountText({
  amount,
  type,
  size,
  showSign = false,
  style,
}: AmountTextProps) {
  const { currencySymbol } = useSettingsStore();
  const ds = useDS();

  const typeColor: Record<AmountType, string> = {
    income: ds.primaryLight,
    expense: ds.secondaryLight,
    neutral: ds.text.primary,
  };

  const formatted = (Math.abs(amount) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const sign = showSign
    ? type === 'income'
      ? '+'
      : type === 'expense'
      ? '−'
      : ''
    : '';

  return (
    <Text style={[SIZE_STYLE[size], { color: typeColor[type] }, style]}>
      {sign}
      {currencySymbol}
      {formatted}
    </Text>
  );
}
