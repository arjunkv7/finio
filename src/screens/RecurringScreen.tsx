import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';
import { hexToRgba } from '../utils/color';
import { useRecurringStore } from '../store/recurringStore';
import { useCategoriesStore } from '../store/categoriesStore';
import { useAccountsStore } from '../store/accountsStore';
import { useSettingsStore } from '../store/settingsStore';
import { RecurringTransaction, RootStackParamList } from '../types';
import PageHeader from '../components/PageHeader';

type Nav = StackNavigationProp<RootStackParamList>;

const FREQ_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const FREQ_ICON: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  daily: 'calendar-today',
  weekly: 'calendar-week',
  monthly: 'calendar-month',
  yearly: 'calendar-star',
};

function formatNextDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: ds.surface.screen },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
    subtitle: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: ds.text.muted,
      lineHeight: 20,
      marginBottom: 20,
    },
    emptyWrap: {
      alignItems: 'center',
      paddingTop: 60,
      gap: 12,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: hexToRgba(ds.primary, 0.1),
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 16,
      color: ds.text.primary,
    },
    emptySub: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: ds.text.muted,
      textAlign: 'center',
      lineHeight: 18,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: ds.radius.full,
      backgroundColor: ds.primary,
    },
    addBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: '#fff',
    },
    sectionLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
      color: ds.text.muted,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 10,
      marginTop: 4,
    },
    card: {
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.xl,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      marginBottom: 12,
      overflow: 'hidden',
      ...ds.shadow.card,
    },
    cardPaused: { opacity: 0.55 },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      gap: 12,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardMain: { flex: 1 },
    cardTitle: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: ds.text.primary,
      lineHeight: 20,
    },
    cardSub: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: ds.text.muted,
      marginTop: 2,
    },
    amountRow: {
      alignItems: 'flex-end',
    },
    amountText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      lineHeight: 20,
    },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      marginTop: 4,
    },
    typeChipText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: ds.border.subtle,
      marginHorizontal: 14,
    },
    cardBottom: {
      flexDirection: 'row',
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 8,
    },
    nextRunBadge: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    nextRunText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: ds.text.muted,
    },
    nextRunDate: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: ds.text.secondary,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: ds.radius.md,
      borderWidth: 1,
    },
    actionBtnText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
    },
  });
}

export default function RecurringScreen() {
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);
  const navigation = useNavigation<Nav>();
  const { currencySymbol } = useSettingsStore();
  const { items, isLoading, loadFromDB, updateRecurring, deleteRecurring } = useRecurringStore();
  const { getCategoryById, loadFromDB: loadCats } = useCategoriesStore();
  const { accounts, loadFromDB: loadAccounts } = useAccountsStore();

  useFocusEffect(useCallback(() => {
    loadFromDB();
    loadCats();
    loadAccounts();
  }, [loadFromDB, loadCats, loadAccounts]));

  const active = items.filter(i => i.is_active === 1);
  const paused = items.filter(i => i.is_active === 0);

  const handleTogglePause = (item: RecurringTransaction) => {
    updateRecurring(item.id, { is_active: item.is_active === 1 ? 0 : 1 });
  };

  const handleDelete = (item: RecurringTransaction) => {
    Alert.alert(
      'Delete Recurring',
      'This will stop future auto-entries. Past transactions are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteRecurring(item.id) },
      ],
    );
  };

  const formatAmount = (paise: number) =>
    `${currencySymbol}${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const renderCard = (item: RecurringTransaction) => {
    const cat = item.category_id ? getCategoryById(item.category_id) : null;
    const account = accounts.find(a => a.id === item.account_id);
    const isIncome = item.type === 'income';
    const amtColor = isIncome ? ds.primary : ds.secondary;
    const catColor = cat?.color ?? (isIncome ? ds.primary : ds.secondary);
    const isPaused = item.is_active === 0;

    return (
      <View key={item.id} style={[styles.card, isPaused && styles.cardPaused]}>
        <View style={styles.cardTop}>
          <View style={[styles.iconWrap, { backgroundColor: hexToRgba(catColor, 0.15) }]}>
            <MaterialCommunityIcons
              name={(cat?.icon ?? (isIncome ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline')) as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
              size={22}
              color={catColor}
            />
          </View>
          <View style={styles.cardMain}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.description ?? cat?.name ?? (isIncome ? 'Income' : 'Expense')}
            </Text>
            <Text style={styles.cardSub}>
              {FREQ_LABEL[item.frequency]} · {account?.name ?? '—'} · {item.time_of_day}
            </Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={[styles.amountText, { color: amtColor }]}>
              {isIncome ? '+' : '-'}{formatAmount(item.amount)}
            </Text>
            <View style={[styles.typeChip, { backgroundColor: hexToRgba(amtColor, 0.1) }]}>
              <MaterialCommunityIcons name={FREQ_ICON[item.frequency]} size={10} color={amtColor} />
              <Text style={[styles.typeChipText, { color: amtColor }]}>{FREQ_LABEL[item.frequency]}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardBottom}>
          <View style={styles.nextRunBadge}>
            <MaterialCommunityIcons name="clock-outline" size={13} color={ds.text.muted} />
            <Text style={styles.nextRunText}>Next: </Text>
            <Text style={styles.nextRunDate}>{isPaused ? 'Paused' : formatNextDate(item.next_run_date)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: isPaused ? ds.primary : ds.border.subtle }]}
            onPress={() => handleTogglePause(item)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={isPaused ? 'play-outline' : 'pause'}
              size={13}
              color={isPaused ? ds.primary : ds.text.muted}
            />
            <Text style={[styles.actionBtnText, { color: isPaused ? ds.primary : ds.text.muted }]}>
              {isPaused ? 'Resume' : 'Pause'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: ds.border.subtle }]}
            onPress={() => handleDelete(item)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={13} color={ds.secondary} />
            <Text style={[styles.actionBtnText, { color: ds.secondary }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <PageHeader
        onBack={() => navigation.goBack()}
        title="Recurring"
        right={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('AddTransaction')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="plus" size={16} color="#fff" />
            <Text style={styles.addBtnText}>New</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Transactions that auto-create on a schedule.
        </Text>

        {items.length === 0 && !isLoading ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="repeat" size={32} color={ds.primary} />
            </View>
            <Text style={styles.emptyTitle}>No recurring transactions</Text>
            <Text style={styles.emptySub}>
              Set up a recurring income or expense{'\n'}and it'll be added automatically.
            </Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => navigation.navigate('AddTransaction')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#fff" />
              <Text style={styles.addBtnText}>Set Up Recurring</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {active.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Active ({active.length})</Text>
                {active.map(renderCard)}
              </>
            )}
            {paused.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Paused ({paused.length})</Text>
                {paused.map(renderCard)}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
