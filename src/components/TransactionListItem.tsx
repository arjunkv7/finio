import React, { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DSType } from '../constants/colors';
import { hexToRgba } from '../utils/color';
import { useDS } from '../hooks/useDS';
import AmountText from './AmountText';

type TxType = 'income' | 'expense' | 'transfer';

interface TransactionListItemProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconColor: string;
  name: string;
  category: string;
  date: string;
  amount: number; // paise
  type: TxType;
  onEdit?: () => void;
  onDelete?: () => void;
}

const ROW_HEIGHT = 72;

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: ds.surface.screen,
      paddingHorizontal: 20,
      height: ROW_HEIGHT,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: ds.border.subtle,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flex: 1,
      gap: 4,
    },
    name: {
      fontFamily: 'Inter_500Medium',
      fontSize: 16,
      lineHeight: 20,
      color: ds.text.primary,
    },
    meta: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 16,
      color: ds.text.muted,
    },
    actions: {
      flexDirection: 'row',
    },
    actionBtn: {
      width: 68,
      height: ROW_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editBtn: {
      backgroundColor: ds.tertiary,
    },
    deleteBtn: {
      backgroundColor: ds.secondary,
    },
  });
}

export default function TransactionListItem({
  icon,
  iconColor,
  name,
  category,
  date,
  amount,
  type,
  onEdit,
  onDelete,
}: TransactionListItemProps) {
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);
  const swipeRef = useRef<Swipeable>(null);

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>
  ) => {
    const actionCount = (onEdit ? 1 : 0) + (onDelete ? 1 : 0);
    const totalWidth = actionCount * 68;

    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [totalWidth, 0],
    });

    return (
      <Animated.View
        style={[styles.actions, { transform: [{ translateX }] }]}
      >
        {onEdit != null && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.editBtn]}
            onPress={() => {
              swipeRef.current?.close();
              onEdit();
            }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="pencil-outline" size={20} color="#fff" />
          </TouchableOpacity>
        )}
        {onDelete != null && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => {
              swipeRef.current?.close();
              onDelete();
            }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  const amountType: 'income' | 'expense' | 'neutral' =
    type === 'transfer' ? 'neutral' : type;

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <View style={styles.row}>
        {/* Category icon */}
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: hexToRgba(iconColor, 0.15) },
          ]}
        >
          <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
        </View>

        {/* Name + meta */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {category}
            {'  ·  '}
            {date}
          </Text>
        </View>

        {/* Amount */}
        <AmountText amount={amount} type={amountType} size="md" showSign />
      </View>
    </Swipeable>
  );
}
