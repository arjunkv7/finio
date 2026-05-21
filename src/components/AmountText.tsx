import React from 'react';
import { Text, TextStyle } from 'react-native';
import { DS, Typography } from '../constants';
import { useSettingsStore } from '../store/settingsStore';

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

const TYPE_COLOR: Record<AmountType, string> = {
  income: DS.primaryLight,    // #4EDEA3
  expense: DS.secondaryLight, // #FFB2B7
  neutral: DS.text.primary,   // #E2E2E8
};

export default function AmountText({
  amount,
  type,
  size,
  showSign = false,
  style,
}: AmountTextProps) {
  const { currencySymbol } = useSettingsStore();

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
    <Text style={[SIZE_STYLE[size], { color: TYPE_COLOR[type] }, style]}>
      {sign}
      {currencySymbol}
      {formatted}
    </Text>
  );
}
