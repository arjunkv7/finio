import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';

import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';
import { hexToRgba } from '../utils/color';
import { formatRelativeDate } from '../utils/formatters';
import { useAccountsStore, AccountWithBalance } from '../store/accountsStore';
import { useTransactionsStore } from '../store/transactionsStore';
import { useCategoriesStore } from '../store/categoriesStore';
import { useSettingsStore } from '../store/settingsStore';
import AppCard from '../components/AppCard';
import AmountText from '../components/AmountText';

// ── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Donut ring geometry
const D_SIZE   = 136;
const D_STROKE = 13;
const D_R      = (D_SIZE - D_STROKE) / 2;
const D_CX     = D_SIZE / 2;
const D_CY     = D_SIZE / 2;
const D_CIRC   = 2 * Math.PI * D_R;

// ── Sub-components ───────────────────────────────────────────────────────────

function SavingsRing({ rate, ds, styles }: { rate: number; ds: DSType; styles: ReturnType<typeof makeStyles> }) {
  const clamped  = Math.max(0, Math.min(100, rate));
  const visible  = D_CIRC * (clamped / 100);
  const hidden   = D_CIRC - visible;
  const color    = clamped >= 20 ? ds.primary : clamped > 0 ? ds.tertiary : ds.surface.elevated;

  return (
    <View style={styles.ringWrap}>
      <Svg width={D_SIZE} height={D_SIZE}>
        {/* Track */}
        <Circle
          cx={D_CX} cy={D_CY} r={D_R}
          stroke={ds.surface.elevated}
          strokeWidth={D_STROKE}
          fill="none"
        />
        {/* Progress arc */}
        {clamped > 0 && (
          <Circle
            cx={D_CX} cy={D_CY} r={D_R}
            stroke={color}
            strokeWidth={D_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={[visible, hidden]}
            transform={`rotate(-90 ${D_CX} ${D_CY})`}
          />
        )}
      </Svg>
      {/* Center label */}
      <View style={styles.ringCenter}>
        <Text style={[styles.ringPct, { color }]}>{Math.round(clamped)}%</Text>
        <Text style={styles.ringLabel}>saved</Text>
      </View>
    </View>
  );
}

function AccountCard({
  account,
  currencySymbol,
  ds,
  styles,
}: {
  account: AccountWithBalance;
  currencySymbol: string;
  ds: DSType;
  styles: ReturnType<typeof makeStyles>;
}) {
  const ACCOUNT_META = {
    bank:   { icon: 'bank',              color: ds.primary,      label: 'Bank' },
    cash:   { icon: 'cash',              color: ds.primaryLight, label: 'Cash' },
    wallet: { icon: 'wallet',            color: ds.tertiary,     label: 'Wallet' },
    credit: { icon: 'credit-card',       color: ds.secondary,    label: 'Credit Card' },
    other:  { icon: 'shape-outline',     color: ds.purple,       label: 'Other' },
  } as Record<string, { icon: string; color: string; label: string }>;

  const meta    = ACCOUNT_META[account.type] ?? ACCOUNT_META.other;
  const accentColor = account.color ?? meta.color;
  const bal     = account.balance;
  const formatted = (Math.abs(bal) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <View style={[styles.acctCard, { borderColor: hexToRgba(accentColor, 0.35) }]}>
      {/* Top: icon + type */}
      <View style={styles.acctTop}>
        <View style={[styles.acctIcon, { backgroundColor: hexToRgba(accentColor, 0.15) }]}>
          <MaterialCommunityIcons
            name={meta.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
            size={18}
            color={accentColor}
          />
        </View>
        <Text style={[styles.acctType, { color: hexToRgba(accentColor, 0.9) }]}>
          {meta.label}
        </Text>
      </View>
      {/* Name */}
      <Text style={styles.acctName} numberOfLines={1}>{account.name}</Text>
      {/* Balance */}
      <Text style={[styles.acctBal, bal < 0 && { color: ds.secondaryLight }]}>
        {bal < 0 ? '−' : ''}{currencySymbol}
        {formatted}
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const ds             = useDS();
  const styles         = useMemo(() => makeStyles(ds), [ds]);
  const navigation     = useNavigation<any>();
  const insets         = useSafeAreaInsets();
  const { currencySymbol } = useSettingsStore();

  const { accounts, totalBalance, loadFromDB: loadAccounts }          = useAccountsStore();
  const { getCategoryById, loadFromDB: loadCategories }               = useCategoriesStore();
  const {
    transactions, monthlySummary, activeMonth, isLoading,
    loadFromDB: loadTransactions, setActiveMonth,
  } = useTransactionsStore();

  const load = useCallback(async () => {
    await Promise.all([loadAccounts(), loadCategories(), loadTransactions()]);
  }, [loadAccounts, loadCategories, loadTransactions]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Derived ─────────────────────────────────────────────────────────────────

  const activeAccounts = accounts.filter(a => a.is_archived === 0);
  const recentTx       = transactions.slice(0, 5);
  const savingsRate    = monthlySummary.income > 0
    ? Math.max(0, (monthlySummary.net / monthlySummary.income) * 100)
    : 0;

  const now             = new Date();
  const isCurrentMonth  = activeMonth.year === now.getFullYear()
                       && activeMonth.month === now.getMonth() + 1;

  const formatBal = (paise: number) =>
    (Math.abs(paise) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // ── Month navigation ─────────────────────────────────────────────────────────

  const goPrev = () => {
    let { year, month } = activeMonth;
    if (month === 1) { year -= 1; month = 12; } else { month -= 1; }
    setActiveMonth(year, month);
  };

  const goNext = () => {
    if (isCurrentMonth) return;
    let { year, month } = activeMonth;
    if (month === 12) { year += 1; month = 1; } else { month += 1; }
    setActiveMonth(year, month);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.appName}>Finio</Text>
        <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="bell-outline" size={22} color={ds.text.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={load}
            tintColor={ds.primary}
            colors={[ds.primary]}
          />
        }
      >

        {/* ── Month Navigator ── */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goPrev} style={styles.monthArrow} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialCommunityIcons name="chevron-left" size={22} color={ds.text.secondary} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {MONTHS[activeMonth.month - 1]} {activeMonth.year}
          </Text>
          <TouchableOpacity
            onPress={goNext}
            style={styles.monthArrow}
            activeOpacity={isCurrentMonth ? 1 : 0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={isCurrentMonth ? ds.surface.elevated : ds.text.secondary}
            />
          </TouchableOpacity>
        </View>

        {/* ── Net Balance Hero ── */}
        <AppCard padding={22} style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Total Balance</Text>
          <Text style={[styles.heroAmount, totalBalance < 0 && { color: ds.secondaryLight }]}>
            {totalBalance < 0 ? '−' : ''}{currencySymbol}{formatBal(totalBalance)}
          </Text>

          <View style={styles.heroStatsRow}>
            {/* Income */}
            <View style={styles.heroStat}>
              <View style={[styles.heroStatIcon, { backgroundColor: hexToRgba(ds.primary, 0.15) }]}>
                <MaterialCommunityIcons name="arrow-down-circle" size={16} color={ds.primaryLight} />
              </View>
              <View>
                <Text style={styles.heroStatLabel}>Income</Text>
                <Text style={[styles.heroStatValue, { color: ds.primaryLight }]}>
                  {currencySymbol}{formatBal(monthlySummary.income)}
                </Text>
              </View>
            </View>

            <View style={styles.heroStatDivider} />

            {/* Expenses */}
            <View style={styles.heroStat}>
              <View style={[styles.heroStatIcon, { backgroundColor: hexToRgba(ds.secondary, 0.15) }]}>
                <MaterialCommunityIcons name="arrow-up-circle" size={16} color={ds.secondaryLight} />
              </View>
              <View>
                <Text style={styles.heroStatLabel}>Expenses</Text>
                <Text style={[styles.heroStatValue, { color: ds.secondaryLight }]}>
                  {currencySymbol}{formatBal(monthlySummary.expenses)}
                </Text>
              </View>
            </View>
          </View>
        </AppCard>

        {/* ── Savings Overview (donut + legend) ── */}
        <AppCard padding={20} style={styles.savingsCard}>
          <Text style={styles.sectionTitle}>Savings Overview</Text>
          <View style={styles.savingsBody}>
            <SavingsRing rate={savingsRate} ds={ds} styles={styles} />
            <View style={styles.savingsLegend}>
              {[
                { label: 'Income',   value: monthlySummary.income,   color: ds.primaryLight },
                { label: 'Expenses', value: monthlySummary.expenses, color: ds.secondaryLight },
                {
                  label: 'Net',
                  value: monthlySummary.net,
                  color: monthlySummary.net >= 0 ? ds.tertiaryLight : ds.secondaryLight,
                },
              ].map(({ label, value, color }) => (
                <View key={label} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={styles.legendLabel}>{label}</Text>
                  <Text style={[styles.legendValue, { color }]}>
                    {value < 0 ? '−' : ''}{currencySymbol}{formatBal(Math.abs(value))}
                  </Text>
                </View>
              ))}
              {/* Savings rate badge */}
              <View style={styles.rateBadge}>
                <Text style={styles.rateBadgeText}>
                  {Math.round(savingsRate)}% savings rate
                </Text>
              </View>
            </View>
          </View>
        </AppCard>

        {/* ── Account Cards (horizontal) ── */}
        {activeAccounts.length > 0 && (
          <View>
            <View style={styles.rowHeader}>
              <Text style={styles.sectionTitle}>Accounts</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Accounts')} activeOpacity={0.7}>
                <Text style={styles.seeAll}>View all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.acctScroll}
            >
              {activeAccounts.map(acc => (
                <AccountCard key={acc.id} account={acc} currencySymbol={currencySymbol} ds={ds} styles={styles} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Quick Actions ── */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, {
              backgroundColor: hexToRgba(ds.secondary, 0.12),
              borderColor: hexToRgba(ds.secondary, 0.35),
            }]}
            onPress={() => navigation.navigate('AddTransaction', { defaultType: 'expense' })}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-up-circle-outline" size={22} color={ds.secondaryLight} />
            <Text style={[styles.actionLabel, { color: ds.secondaryLight }]}>Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, {
              backgroundColor: hexToRgba(ds.primary, 0.12),
              borderColor: hexToRgba(ds.primary, 0.35),
            }]}
            onPress={() => navigation.navigate('AddTransaction', { defaultType: 'income' })}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-down-circle-outline" size={22} color={ds.primaryLight} />
            <Text style={[styles.actionLabel, { color: ds.primaryLight }]}>Income</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, {
              backgroundColor: hexToRgba(ds.tertiary, 0.12),
              borderColor: hexToRgba(ds.tertiary, 0.35),
            }]}
            onPress={() => navigation.navigate('Accounts')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="swap-horizontal" size={22} color={ds.tertiaryLight} />
            <Text style={[styles.actionLabel, { color: ds.tertiaryLight }]}>Transfer</Text>
          </TouchableOpacity>
        </View>

        {/* ── Recent Transactions ── */}
        <View style={styles.rowHeader}>
          <Text style={styles.sectionTitle}>Recent</Text>
          <TouchableOpacity onPress={() => navigation.navigate('History')} activeOpacity={0.7}>
            <Text style={styles.seeAll}>View all</Text>
          </TouchableOpacity>
        </View>

        {recentTx.length === 0 ? (
          <AppCard padding={24}>
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="receipt-text-outline" size={32} color={ds.text.muted} />
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptyHint}>Tap Expense or Income above to get started</Text>
            </View>
          </AppCard>
        ) : (
          <AppCard padding={0} style={styles.txCard}>
            {recentTx.map((tx, i) => {
              const cat       = tx.category_id ? getCategoryById(tx.category_id) : null;
              const iconName  = (cat?.icon ?? 'cash') as React.ComponentProps<typeof MaterialCommunityIcons>['name'];
              const iconColor = cat?.color ?? ds.text.muted;
              const isLast    = i === recentTx.length - 1;

              return (
                <View key={tx.id}>
                  <View style={styles.txRow}>
                    <View style={[styles.txIconWrap, { backgroundColor: hexToRgba(iconColor, 0.15) }]}>
                      <MaterialCommunityIcons name={iconName} size={20} color={iconColor} />
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txName} numberOfLines={1}>
                        {tx.description ?? cat?.name ?? (tx.type === 'income' ? 'Income' : tx.type === 'transfer' ? 'Transfer' : 'Expense')}
                      </Text>
                      <Text style={styles.txMeta}>{formatRelativeDate(tx.transaction_date)}</Text>
                    </View>
                    <AmountText
                      amount={tx.amount}
                      type={tx.type === 'transfer' ? 'neutral' : tx.type}
                      size="md"
                      showSign
                    />
                  </View>
                  {!isLast && <View style={styles.txDivider} />}
                </View>
              );
            })}
          </AppCard>
        )}

      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 72 }]}
        onPress={() => navigation.navigate('AddTransaction')}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: ds.surface.screen,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: ds.border.subtle,
    },
    appName: {
      fontFamily: 'Inter_700Bold',
      fontSize: 26,
      lineHeight: 32,
      letterSpacing: -0.8,
      color: ds.text.primary,
    },
    bellBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: ds.surface.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },

    // Month navigator
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 4,
    },
    monthArrow: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: ds.surface.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      lineHeight: 20,
      color: ds.text.primary,
      minWidth: 110,
      textAlign: 'center',
    },

    // Hero card
    heroCard: {},
    heroEyebrow: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: ds.text.muted,
      marginBottom: 6,
    },
    heroAmount: {
      fontFamily: 'Inter_700Bold',
      fontSize: 38,
      lineHeight: 46,
      letterSpacing: -1.5,
      color: ds.text.primary,
      marginBottom: 18,
    },
    heroStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: ds.border.subtle,
    },
    heroStat: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    heroStatIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroStatLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      lineHeight: 14,
      color: ds.text.muted,
      marginBottom: 2,
    },
    heroStatValue: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      lineHeight: 20,
    },
    heroStatDivider: {
      width: 1,
      height: 36,
      backgroundColor: ds.border.subtle,
    },

    // Savings card
    savingsCard: {},
    savingsBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginTop: 12,
    },
    // Ring
    ringWrap: {
      width: D_SIZE,
      height: D_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringCenter: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringPct: {
      fontFamily: 'Inter_700Bold',
      fontSize: 22,
      lineHeight: 28,
      letterSpacing: -0.5,
    },
    ringLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      lineHeight: 14,
      color: ds.text.muted,
    },
    // Legend
    savingsLegend: {
      flex: 1,
      gap: 10,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    legendLabel: {
      flex: 1,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.secondary,
    },
    legendValue: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      lineHeight: 18,
    },
    rateBadge: {
      marginTop: 4,
      alignSelf: 'flex-start',
      backgroundColor: hexToRgba(ds.primary, 0.12),
      borderRadius: ds.radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    rateBadgeText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
      lineHeight: 14,
      color: ds.primaryLight,
    },

    // Section headers
    sectionTitle: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: ds.text.muted,
    },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: -4,
    },
    seeAll: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      lineHeight: 18,
      color: ds.primaryLight,
    },

    // Account cards
    acctScroll: {
      gap: 12,
      paddingVertical: 2,
    },
    acctCard: {
      width: 150,
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.xl,
      borderWidth: 1,
      padding: 16,
      gap: 8,
      ...ds.shadow.card,
    },
    acctTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    acctIcon: {
      width: 32,
      height: 32,
      borderRadius: ds.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    acctType: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 0.2,
    },
    acctName: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      lineHeight: 18,
      color: ds.text.primary,
    },
    acctBal: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      lineHeight: 22,
      color: ds.text.primary,
      letterSpacing: -0.3,
    },

    // Quick actions
    actions: {
      flexDirection: 'row',
      gap: 10,
    },
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 14,
      borderRadius: ds.radius.lg,
      borderWidth: 1.5,
    },
    actionLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      lineHeight: 16,
    },

    // Recent transactions
    txCard: { overflow: 'hidden' },
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    txIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    txInfo: { flex: 1, gap: 3 },
    txName: {
      fontFamily: 'Inter_500Medium',
      fontSize: 15,
      lineHeight: 20,
      color: ds.text.primary,
    },
    txMeta: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 16,
      color: ds.text.muted,
    },
    txDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: ds.border.subtle,
      marginLeft: 68,
    },

    // Empty state
    emptyBox: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
    },
    emptyTitle: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 16,
      lineHeight: 22,
      color: ds.text.secondary,
    },
    emptyHint: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
      textAlign: 'center',
    },

    // FAB
    fab: {
      position: 'absolute',
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: ds.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...ds.shadow.modal,
    },
  });
}
