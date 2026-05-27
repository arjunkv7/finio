import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import BrandHeader from '../components/BrandHeader';
import MonthPickerSheet from '../components/MonthPickerSheet';
import Svg, { Circle, Path } from 'react-native-svg';

import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';
import { hexToRgba } from '../utils/color';
import { formatRelativeDate } from '../utils/formatters';
import { useAccountsStore } from '../store/accountsStore';
import { useTransactionsStore } from '../store/transactionsStore';
import { useCategoriesStore } from '../store/categoriesStore';
import { useSettingsStore } from '../store/settingsStore';
import AppCard from '../components/AppCard';
import AmountText from '../components/AmountText';
import { getUnreadNotificationsCount } from '../db/queries/notificationQueries';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Savings donut geometry
const D_SIZE   = 136;
const D_STROKE = 13;
const D_R      = (D_SIZE - D_STROKE) / 2;
const D_CX     = D_SIZE / 2;
const D_CY     = D_SIZE / 2;
const D_CIRC   = 2 * Math.PI * D_R;

// Category pie geometry
const PIE_SIZE  = 130;
const PIE_OUTER = 55;
const PIE_INNER = 33;
const PIE_CX    = PIE_SIZE / 2;
const PIE_CY    = PIE_SIZE / 2;

const CAT_PALETTE = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFEAA7', '#DDA0DD', '#96CEB4'];

// ── SVG helpers ──────────────────────────────────────────────────────────────

function polarToCart(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArcPath(
  cx: number, cy: number, outerR: number, innerR: number,
  startDeg: number, endDeg: number,
): string {
  const end = Math.min(endDeg, startDeg + 359.99);
  const o1 = polarToCart(cx, cy, outerR, startDeg);
  const o2 = polarToCart(cx, cy, outerR, end);
  const i1 = polarToCart(cx, cy, innerR, end);
  const i2 = polarToCart(cx, cy, innerR, startDeg);
  const large = end - startDeg > 180 ? 1 : 0;
  return [
    `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
    `L ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SavingsRing({ rate, ds, styles, privacy }: { rate: number; ds: DSType; styles: ReturnType<typeof makeStyles>; privacy?: boolean }) {
  const clamped = Math.max(0, Math.min(100, rate));
  const visible = D_CIRC * (clamped / 100);
  const gap     = D_CIRC - visible;
  const color   = clamped >= 20 ? ds.primary : clamped > 0 ? ds.tertiary : ds.surface.elevated;

  return (
    <View style={styles.ringWrap}>
      <Svg width={D_SIZE} height={D_SIZE}>
        <Circle cx={D_CX} cy={D_CY} r={D_R} stroke={ds.surface.elevated} strokeWidth={D_STROKE} fill="none" />
        {clamped > 0 && (
          <Circle
            cx={D_CX} cy={D_CY} r={D_R}
            stroke={color} strokeWidth={D_STROKE} fill="none"
            strokeLinecap="round"
            strokeDasharray={[visible, gap]}
            transform={`rotate(-90 ${D_CX} ${D_CY})`}
          />
        )}
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringPct, { color }]}>{privacy ? '—' : `${Math.round(clamped)}%`}</Text>
        <Text style={styles.ringLabel}>saved</Text>
      </View>
    </View>
  );
}

type CatSlice = { label: string; amount: number; color: string };

function CategoryDonut({
  transactions,
  getCategoryById,
  ds,
  styles,
}: {
  transactions: any[];
  getCategoryById: (id: string) => any;
  ds: DSType;
  styles: ReturnType<typeof makeStyles>;
}) {
  const expenses = transactions.filter((tx: any) => tx.type === 'expense');
  const total = expenses.reduce((s: number, tx: any) => s + tx.amount, 0);
  if (total === 0) return null;

  const map: Record<string, CatSlice> = {};
  expenses.forEach((tx: any) => {
    const key = String(tx.category_id ?? '__none__');
    if (!map[key]) {
      const cat = tx.category_id ? getCategoryById(tx.category_id) : null;
      map[key] = { amount: 0, label: cat?.name ?? 'Uncategorized', color: cat?.color ?? '' };
    }
    map[key].amount += tx.amount;
  });

  const sorted = Object.values(map).sort((a, b) => b.amount - a.amount);
  const slices: CatSlice[] = sorted.slice(0, 5).map((s, i) => ({
    ...s,
    color: s.color || CAT_PALETTE[i % CAT_PALETTE.length],
  }));
  if (sorted.length > 5) {
    const otherAmt = sorted.slice(5).reduce((s, c) => s + c.amount, 0);
    slices.push({ label: 'Other', amount: otherAmt, color: ds.text.muted });
  }

  let angle = -90;
  const paths = slices.map(s => {
    const sweep = (s.amount / total) * 360;
    const path = donutArcPath(PIE_CX, PIE_CY, PIE_OUTER, PIE_INNER, angle, angle + sweep);
    angle += sweep;
    return { ...s, path };
  });

  return (
    <AppCard padding={20}>
      <Text style={styles.sectionTitle}>Expense Breakdown</Text>
      <View style={styles.catBody}>
        <View style={styles.catChartWrap}>
          <Svg width={PIE_SIZE} height={PIE_SIZE}>
            {paths.map((p, i) => <Path key={i} d={p.path} fill={p.color} />)}
          </Svg>
        </View>
        <View style={styles.catLegend}>
          {slices.map((s, i) => (
            <View key={i} style={styles.catLegendRow}>
              <View style={[styles.catDot, { backgroundColor: s.color }]} />
              <Text style={styles.catLegendLabel} numberOfLines={1}>{s.label}</Text>
              <Text style={[styles.catLegendPct, { color: s.color }]}>
                {((s.amount / total) * 100).toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      </View>
    </AppCard>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const ds             = useDS();
  const styles         = useMemo(() => makeStyles(ds), [ds]);
  const navigation     = useNavigation<any>();
  const insets         = useSafeAreaInsets();
  const { currencySymbol } = useSettingsStore();
  const [privacyHidden, setPrivacyHidden]   = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [refreshing, setRefreshing]         = useState(false);

  const { totalBalance, loadFromDB: loadAccounts }         = useAccountsStore();
  const { getCategoryById, loadFromDB: loadCategories }    = useCategoriesStore();
  const {
    transactions, monthlySummary, activeMonth,
    loadFromDB: loadTransactions, setActiveMonth,
  } = useTransactionsStore();

  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    await Promise.all([loadAccounts(), loadCategories(), loadTransactions()]);
  }, [loadAccounts, loadCategories, loadTransactions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(useCallback(() => {
    load();
    getUnreadNotificationsCount().then(setUnreadCount);
  }, [load]));

  React.useEffect(() => {
    return navigation.addListener('tabPress' as any, () => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, [navigation]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const recentTx    = transactions.slice(0, 5);
  const savingsRate = monthlySummary.income > 0
    ? Math.max(0, (monthlySummary.net / monthlySummary.income) * 100)
    : 0;

  const formatBal = (paise: number) =>
    (Math.abs(paise) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <BrandHeader
        right={
          <>
            <TouchableOpacity style={[styles.bellBtn, { backgroundColor: ds.surface.card, borderColor: ds.border.subtle }]} onPress={() => setPrivacyHidden(h => !h)} activeOpacity={0.7}>
              <MaterialCommunityIcons name={privacyHidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={ds.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bellBtn, { backgroundColor: ds.surface.card, borderColor: ds.border.subtle }]}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="bell-outline" size={20} color={ds.text.secondary} />
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: ds.primary }]}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </>
        }
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ds.primary}
            colors={[ds.primary]}
          />
        }
      >

        {/* ── Month Navigator ── */}
        <TouchableOpacity style={styles.monthBtn} onPress={() => setMonthPickerOpen(true)} activeOpacity={0.75}>
          <MaterialCommunityIcons name="calendar-month-outline" size={16} color={ds.primaryLight} />
          <Text style={styles.monthBtnText}>{MONTHS[activeMonth.month - 1]} {activeMonth.year}</Text>
          <MaterialCommunityIcons name="chevron-down" size={16} color={ds.primaryLight} />
        </TouchableOpacity>

        {/* ── Net Balance Hero ── */}
        <AppCard padding={22} style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Total Balance</Text>
          <Text style={[styles.heroAmount, totalBalance < 0 && { color: ds.secondaryLight }]}>
            {privacyHidden ? '••••' : `${totalBalance < 0 ? '−' : ''}${currencySymbol}${formatBal(totalBalance)}`}
          </Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <View style={[styles.heroStatIcon, { backgroundColor: hexToRgba(ds.primary, 0.15) }]}>
                <MaterialCommunityIcons name="arrow-down-circle" size={16} color={ds.primaryLight} />
              </View>
              <View>
                <Text style={styles.heroStatLabel}>Income</Text>
                <Text style={[styles.heroStatValue, { color: ds.primaryLight }]}>
                  {privacyHidden ? '••••' : `${currencySymbol}${formatBal(monthlySummary.income)}`}
                </Text>
              </View>
            </View>

            <View style={styles.heroStatDivider} />

            <View style={styles.heroStat}>
              <View style={[styles.heroStatIcon, { backgroundColor: hexToRgba(ds.secondary, 0.15) }]}>
                <MaterialCommunityIcons name="arrow-up-circle" size={16} color={ds.secondaryLight} />
              </View>
              <View>
                <Text style={styles.heroStatLabel}>Expenses</Text>
                <Text style={[styles.heroStatValue, { color: ds.secondaryLight }]}>
                  {privacyHidden ? '••••' : `${currencySymbol}${formatBal(monthlySummary.expenses)}`}
                </Text>
              </View>
            </View>
          </View>
        </AppCard>

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
        </View>

        {/* ── Savings Overview ── */}
        <AppCard padding={20} style={styles.savingsCard}>
          <Text style={styles.sectionTitle}>Savings Overview</Text>
          <View style={styles.savingsBody}>
            <SavingsRing rate={savingsRate} ds={ds} styles={styles} privacy={privacyHidden} />
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
                  <View style={styles.legendRowContent}>
                    <Text style={styles.legendLabel}>{label}</Text>
                    <Text style={[styles.legendValue, { color }]} numberOfLines={1}>
                      {privacyHidden ? '••••' : `${value < 0 ? '−' : ''}${currencySymbol}${formatBal(Math.abs(value))}`}
                    </Text>
                  </View>
                </View>
              ))}
              <View style={styles.rateBadge}>
                <Text style={styles.rateBadgeText}>
                  {privacyHidden ? '— savings rate' : `${Math.round(savingsRate)}% savings rate`}
                </Text>
              </View>
            </View>
          </View>
        </AppCard>

        {/* ── Expense Category Breakdown ── */}
        <CategoryDonut
          transactions={transactions}
          getCategoryById={getCategoryById}
          ds={ds}
          styles={styles}
        />

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
              <Text style={styles.emptyHint}>Tap Add Expense or Add Income above to get started</Text>
            </View>
          </AppCard>
        ) : (
          <AppCard padding={0} style={styles.txCard}>
            {recentTx.map((tx, i) => {
              const cat      = tx.category_id ? getCategoryById(tx.category_id) : null;
              const iconName = (cat?.icon ?? 'cash') as React.ComponentProps<typeof MaterialCommunityIcons>['name'];
              const iconColor = cat?.color ?? ds.text.muted;
              const isLast   = i === recentTx.length - 1;

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
                    {privacyHidden ? (
                      <Text style={[styles.txName, { color: ds.text.muted }]}>••••</Text>
                    ) : (
                      <AmountText
                        amount={tx.amount}
                        type={tx.type === 'transfer' ? 'neutral' : tx.type}
                        size="md"
                        showSign
                      />
                    )}
                  </View>
                  {!isLast && <View style={styles.txDivider} />}
                </View>
              );
            })}
          </AppCard>
        )}

      </ScrollView>

      <MonthPickerSheet
        visible={monthPickerOpen}
        onClose={() => setMonthPickerOpen(false)}
        year={activeMonth.year}
        month={activeMonth.month}
        onChange={(y, m) => setActiveMonth(y, m)}
        ds={ds}
      />
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

    bellBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: ds.surface.card,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },

    badge: {
      position: 'absolute',
      top: 0,
      right: 0,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 9,
      color: '#fff',
      lineHeight: 13,
    },

    monthBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      alignSelf: 'flex-start',
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: ds.radius.full,
      backgroundColor: hexToRgba(ds.primary, 0.12),
      borderWidth: 1, borderColor: hexToRgba(ds.primary, 0.3),
    },
    monthBtnText: {
      fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18,
      color: ds.primaryLight,
    },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 14, gap: 14 },

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
    savingsLegend: {
      flex: 1,
      gap: 10,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    legendDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginTop: 4,
    },
    legendRowContent: {
      flex: 1,
      gap: 1,
    },
    legendLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      lineHeight: 14,
      color: ds.text.muted,
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

    // Category breakdown
    catBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginTop: 12,
    },
    catChartWrap: {
      width: PIE_SIZE,
      height: PIE_SIZE,
    },
    catLegend: {
      flex: 1,
      gap: 9,
    },
    catLegendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    catDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    catLegendLabel: {
      flex: 1,
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 16,
      color: ds.text.secondary,
    },
    catLegendPct: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      lineHeight: 16,
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
    actionTransfer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 11,
      borderRadius: ds.radius.lg,
      borderWidth: 1.5,
    },
    actionTransferLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      lineHeight: 18,
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

  });
}
