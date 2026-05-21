import React, { useCallback } from 'react';
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

import { DS } from '../constants';
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

const ACCOUNT_META: Record<string, { icon: string; color: string; label: string }> = {
  bank:   { icon: 'bank',              color: DS.primary,      label: 'Bank' },
  cash:   { icon: 'cash',              color: DS.primaryLight, label: 'Cash' },
  wallet: { icon: 'wallet',            color: DS.tertiary,     label: 'Wallet' },
  credit: { icon: 'credit-card',       color: DS.secondary,    label: 'Credit Card' },
  other:  { icon: 'shape-outline',     color: DS.purple,       label: 'Other' },
};

// Donut ring geometry
const D_SIZE   = 136;
const D_STROKE = 13;
const D_R      = (D_SIZE - D_STROKE) / 2;
const D_CX     = D_SIZE / 2;
const D_CY     = D_SIZE / 2;
const D_CIRC   = 2 * Math.PI * D_R;

// ── Sub-components ───────────────────────────────────────────────────────────

function SavingsRing({ rate }: { rate: number }) {
  const clamped  = Math.max(0, Math.min(100, rate));
  const visible  = D_CIRC * (clamped / 100);
  const hidden   = D_CIRC - visible;
  const color    = clamped >= 20 ? DS.primary : clamped > 0 ? DS.tertiary : DS.surface.elevated;

  return (
    <View style={styles.ringWrap}>
      <Svg width={D_SIZE} height={D_SIZE}>
        {/* Track */}
        <Circle
          cx={D_CX} cy={D_CY} r={D_R}
          stroke={DS.surface.elevated}
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
}: {
  account: AccountWithBalance;
  currencySymbol: string;
}) {
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
      <Text style={[styles.acctBal, bal < 0 && { color: DS.secondaryLight }]}>
        {bal < 0 ? '−' : ''}{currencySymbol}
        {formatted}
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
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
          <MaterialCommunityIcons name="bell-outline" size={22} color={DS.text.secondary} />
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
            tintColor={DS.primary}
            colors={[DS.primary]}
          />
        }
      >

        {/* ── Month Navigator ── */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goPrev} style={styles.monthArrow} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialCommunityIcons name="chevron-left" size={22} color={DS.text.secondary} />
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
              color={isCurrentMonth ? DS.surface.elevated : DS.text.secondary}
            />
          </TouchableOpacity>
        </View>

        {/* ── Net Balance Hero ── */}
        <AppCard padding={22} style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Total Balance</Text>
          <Text style={[styles.heroAmount, totalBalance < 0 && { color: DS.secondaryLight }]}>
            {totalBalance < 0 ? '−' : ''}{currencySymbol}{formatBal(totalBalance)}
          </Text>

          <View style={styles.heroStatsRow}>
            {/* Income */}
            <View style={styles.heroStat}>
              <View style={[styles.heroStatIcon, { backgroundColor: hexToRgba(DS.primary, 0.15) }]}>
                <MaterialCommunityIcons name="arrow-down-circle" size={16} color={DS.primaryLight} />
              </View>
              <View>
                <Text style={styles.heroStatLabel}>Income</Text>
                <Text style={[styles.heroStatValue, { color: DS.primaryLight }]}>
                  {currencySymbol}{formatBal(monthlySummary.income)}
                </Text>
              </View>
            </View>

            <View style={styles.heroStatDivider} />

            {/* Expenses */}
            <View style={styles.heroStat}>
              <View style={[styles.heroStatIcon, { backgroundColor: hexToRgba(DS.secondary, 0.15) }]}>
                <MaterialCommunityIcons name="arrow-up-circle" size={16} color={DS.secondaryLight} />
              </View>
              <View>
                <Text style={styles.heroStatLabel}>Expenses</Text>
                <Text style={[styles.heroStatValue, { color: DS.secondaryLight }]}>
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
            <SavingsRing rate={savingsRate} />
            <View style={styles.savingsLegend}>
              {[
                { label: 'Income',   value: monthlySummary.income,   color: DS.primaryLight },
                { label: 'Expenses', value: monthlySummary.expenses, color: DS.secondaryLight },
                {
                  label: 'Net',
                  value: monthlySummary.net,
                  color: monthlySummary.net >= 0 ? DS.tertiaryLight : DS.secondaryLight,
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
                <AccountCard key={acc.id} account={acc} currencySymbol={currencySymbol} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Quick Actions ── */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, {
              backgroundColor: hexToRgba(DS.secondary, 0.12),
              borderColor: hexToRgba(DS.secondary, 0.35),
            }]}
            onPress={() => navigation.navigate('AddTransaction', { defaultType: 'expense' })}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-up-circle-outline" size={22} color={DS.secondaryLight} />
            <Text style={[styles.actionLabel, { color: DS.secondaryLight }]}>Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, {
              backgroundColor: hexToRgba(DS.primary, 0.12),
              borderColor: hexToRgba(DS.primary, 0.35),
            }]}
            onPress={() => navigation.navigate('AddTransaction', { defaultType: 'income' })}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-down-circle-outline" size={22} color={DS.primaryLight} />
            <Text style={[styles.actionLabel, { color: DS.primaryLight }]}>Income</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, {
              backgroundColor: hexToRgba(DS.tertiary, 0.12),
              borderColor: hexToRgba(DS.tertiary, 0.35),
            }]}
            onPress={() => navigation.navigate('Accounts')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="swap-horizontal" size={22} color={DS.tertiaryLight} />
            <Text style={[styles.actionLabel, { color: DS.tertiaryLight }]}>Transfer</Text>
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
              <MaterialCommunityIcons name="receipt-text-outline" size={32} color={DS.text.muted} />
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptyHint}>Tap Expense or Income above to get started</Text>
            </View>
          </AppCard>
        ) : (
          <AppCard padding={0} style={styles.txCard}>
            {recentTx.map((tx, i) => {
              const cat       = tx.category_id ? getCategoryById(tx.category_id) : null;
              const iconName  = (cat?.icon ?? 'cash') as React.ComponentProps<typeof MaterialCommunityIcons>['name'];
              const iconColor = cat?.color ?? DS.text.muted;
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DS.surface.screen,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DS.border.subtle,
  },
  appName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: DS.text.primary,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.surface.elevated,
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
    backgroundColor: DS.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: DS.text.primary,
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
    color: DS.text.muted,
    marginBottom: 6,
  },
  heroAmount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -1.5,
    color: DS.text.primary,
    marginBottom: 18,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: DS.border.subtle,
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
    color: DS.text.muted,
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
    backgroundColor: DS.border.subtle,
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
    color: DS.text.muted,
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
    color: DS.text.secondary,
  },
  legendValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    lineHeight: 18,
  },
  rateBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: hexToRgba(DS.primary, 0.12),
    borderRadius: DS.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rateBadgeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 14,
    color: DS.primaryLight,
  },

  // Section headers
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: DS.text.muted,
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
    color: DS.primaryLight,
  },

  // Account cards
  acctScroll: {
    gap: 12,
    paddingVertical: 2,
  },
  acctCard: {
    width: 150,
    backgroundColor: DS.surface.card,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    ...DS.shadow.card,
  },
  acctTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acctIcon: {
    width: 32,
    height: 32,
    borderRadius: DS.radius.md,
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
    color: DS.text.primary,
  },
  acctBal: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    lineHeight: 22,
    color: DS.text.primary,
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
    borderRadius: DS.radius.lg,
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
    color: DS.text.primary,
  },
  txMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: DS.text.muted,
  },
  txDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DS.border.subtle,
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
    color: DS.text.secondary,
  },
  emptyHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: DS.text.muted,
    textAlign: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: DS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...DS.shadow.modal,
  },
});
