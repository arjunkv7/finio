import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CartesianChart, BarGroup, PolarChart, Pie } from 'victory-native';
import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';
import { useSettingsStore } from '../store/settingsStore';
import { useAccountsStore } from '../store/accountsStore';
import { useInvestmentsStore } from '../store/investmentsStore';
import { useSavingsStore } from '../store/savingsStore';
import {
  getMonthlySummary,
  getCategorySpend,
  getAllCategories,
  getMonthlyTrendUpTo,
  getAnnualSummary,
} from '../db/queries';
import BudgetScreen from './BudgetScreen';

type SubTab = 'overview' | 'budgets';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrendPoint {
  x: number;
  income: number;
  expenses: number;
  label: string;
}

interface CatRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  pct: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const { width: SCREEN_W } = Dimensions.get('window');
const CHART_H = 180;
const PIE_SIZE = 156;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtAmt(n: number, sym: string): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 100_000) return `${sign}${sym}${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000)   return `${sign}${sym}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${sym}${abs.toLocaleString()}`;
}

function prevMonth(y: number, m: number): [number, number] {
  return m === 1 ? [y - 1, 12] : [y, m - 1];
}
function nextMonth(y: number, m: number): [number, number] {
  return m === 12 ? [y + 1, 1] : [y, m + 1];
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    root:  { flex: 1, backgroundColor: ds.surface.screen },
    scroll: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Header
    header: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: ds.border.subtle,
    },
    headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: ds.text.primary },
    monthNav:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
    navBtn: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: ds.surface.elevated,
      alignItems: 'center', justifyContent: 'center',
    },
    navBtnDisabled: { opacity: 0.35 },
    monthLabel: {
      fontFamily: 'Inter_600SemiBold', fontSize: 14, color: ds.text.primary,
      minWidth: 80, textAlign: 'center',
    },

    // Content
    content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },

    // Stats
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statTile: {
      flex: 1,
      minWidth: (SCREEN_W - 42) / 2 - 5,
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.lg,
      padding: 14,
      borderWidth: 1,
      borderColor: ds.border.subtle,
    },
    statLabel: {
      fontFamily: 'Inter_500Medium', fontSize: 11, color: ds.text.muted,
      textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6,
    },
    statValue: { fontFamily: 'Inter_700Bold', fontSize: 18 },

    // Section card
    card: {
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.xl,
      padding: 18,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      gap: 14,
    },
    sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: ds.text.primary },

    // Legend
    chartLegendRow: { flexDirection: 'row', gap: 16 },
    legendItem:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot:      { width: 9, height: 9, borderRadius: 5 },
    legendTxt:      { fontFamily: 'Inter_400Regular', fontSize: 12, color: ds.text.secondary },

    // X-axis
    xLabels: { flexDirection: 'row', justifyContent: 'space-around', marginTop: -2 },
    xLabel:  { fontFamily: 'Inter_400Regular', fontSize: 11, color: ds.text.muted, flex: 1, textAlign: 'center' },

    // Empty
    emptyChart: { height: CHART_H, alignItems: 'center', justifyContent: 'center' },
    emptyTxt:   { fontFamily: 'Inter_400Regular', fontSize: 13, color: ds.text.muted, textAlign: 'center' },

    // Donut + pie legend
    donutRow:     { flexDirection: 'row', alignItems: 'center', gap: 16 },
    pieLegend:    { flex: 1, gap: 8 },
    pieLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    pieLegendName: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, color: ds.text.secondary },
    pieLegendPct:  { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: ds.text.primary },

    // Category list
    catList: { gap: 12 },
    catRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    catIconWrap: {
      width: 30, height: 30, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center', marginTop: 2,
    },
    catInfo:   { flex: 1, gap: 4 },
    catTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    catName:   { fontFamily: 'Inter_500Medium', fontSize: 13, color: ds.text.primary },
    catAmt:    { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: ds.text.primary },
    catBarBg:  { height: 5, borderRadius: 3, backgroundColor: ds.surface.elevated, overflow: 'hidden' },
    catBarFill: { height: '100%', borderRadius: 3 },
    catPctTxt: { fontFamily: 'Inter_400Regular', fontSize: 11, color: ds.text.muted },

    // Goals
    goalsScroll: { paddingRight: 8, gap: 12, flexDirection: 'row' },
    goalMini: {
      width: 130, backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.lg, padding: 12, gap: 7,
    },
    goalIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    goalName:  { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: ds.text.primary },
    goalBarBg: { height: 4, borderRadius: 2, backgroundColor: ds.surface.card, overflow: 'hidden' },
    goalBarFill: { height: '100%', borderRadius: 2 },
    goalPct:   { fontFamily: 'Inter_700Bold', fontSize: 16 },
    goalAmts:  { fontFamily: 'Inter_400Regular', fontSize: 11, color: ds.text.muted },

    // Net worth
    nwRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
    nwIcon:      { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    nwLabel:     { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: ds.text.secondary },
    nwVal:       { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
    nwDivider:   { height: 1, backgroundColor: ds.border.subtle, marginVertical: 2 },
    nwTotalLabel: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 15, color: ds.text.primary },
    nwTotalVal:   { fontFamily: 'Inter_700Bold', fontSize: 18 },

    // Annual button
    annualBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: ds.surface.card, borderRadius: ds.radius.lg,
      paddingVertical: 14,
      borderWidth: 1, borderColor: `${ds.primary}44`,
    },
    annualBtnTxt: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: ds.primary },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: ds.surface.card,
      borderTopLeftRadius: ds.radius.xl,
      borderTopRightRadius: ds.radius.xl,
      padding: 20,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
    },
    modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: ds.text.primary },

    // Table
    tableHead: {
      flexDirection: 'row', paddingVertical: 8,
      borderBottomWidth: 1, borderBottomColor: ds.border.subtle, marginBottom: 4,
    },
    th: {
      fontFamily: 'Inter_600SemiBold', fontSize: 11, color: ds.text.muted,
      textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right',
    },
    tableRow: {
      flexDirection: 'row', paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: ds.border.subtle, alignItems: 'center',
    },
    tableRowActive: {
      backgroundColor: `${ds.primary}11`,
      borderRadius: 8, paddingHorizontal: 4, marginHorizontal: -4,
    },
    tableTotal: {
      borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: ds.border.medium,
      marginTop: 4, paddingTop: 12,
    },
    colMonth: { flex: 1.2, textAlign: 'left' },
    colNum:   { flex: 1.4, textAlign: 'right' },
    td: { fontFamily: 'Inter_400Regular', fontSize: 13, color: ds.text.secondary },
    tdBold: { fontFamily: 'Inter_700Bold', fontSize: 14, color: ds.text.primary, textAlign: 'right' },
    tdActive: { color: ds.primary, fontFamily: 'Inter_600SemiBold' },

    // Sub-tab bar
    subTabBar: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: ds.border.subtle,
    },
    subTabPill: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: ds.radius.md,
      alignItems: 'center',
      backgroundColor: ds.surface.elevated,
    },
    subTabPillActive: {
      backgroundColor: ds.primary,
    },
    subTabTxt: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: ds.text.muted,
    },
    subTabTxtActive: {
      color: '#fff',
    },
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({ title, children, styles }: { title: string; children: React.ReactNode; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function StatTile({ label, value, color, styles }: { label: string; value: string; color: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);

  const insets = useSafeAreaInsets();
  const sym = useSettingsStore(s => s.currencySymbol);
  const { totalBalance, loadFromDB: loadAccounts } = useAccountsStore();
  const { totalInvested, loadFromDB: loadInvestments } = useInvestmentsStore();
  const { goals, loadFromDB: loadSavings } = useSavingsStore();

  const [subTab, setSubTab] = useState<SubTab>('overview');

  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [loading, setLoading]       = useState(true);
  const [summary, setSummary]       = useState({ income: 0, expenses: 0, net: 0 });
  const [trendData, setTrendData]   = useState<TrendPoint[]>([]);
  const [catRows, setCatRows]       = useState<CatRow[]>([]);

  const [showAnnual, setShowAnnual]       = useState(false);
  const [annualRows, setAnnualRows]       = useState<{ month: number; income: number; expenses: number }[]>([]);
  const [annualLoading, setAnnualLoading] = useState(false);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  // ── Load monthly data ──────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, spend, cats, trend] = await Promise.all([
        getMonthlySummary(year, month),
        getCategorySpend(year, month),
        getAllCategories(),
        getMonthlyTrendUpTo(year, month, 6),
      ]);

      setSummary(sum);

      // Fill all 6 months, zero-padding months with no activity
      const trendMap = new Map(trend.map(t => [`${t.year}-${t.month}`, t]));
      const points: TrendPoint[] = [];
      for (let i = 5; i >= 0; i--) {
        let cy = year, cm = month;
        for (let j = 0; j < i; j++) [cy, cm] = prevMonth(cy, cm);
        const entry = trendMap.get(`${cy}-${cm}`);
        points.push({
          x: 6 - i,
          income: entry?.income ?? 0,
          expenses: entry?.expenses ?? 0,
          label: MONTH_ABBR[cm - 1],
        });
      }
      setTrendData(points);

      // Category rows
      const totalExp = spend.reduce((s, c) => s + c.total, 0);
      const catMap   = new Map(cats.map(c => [c.id, c]));
      const rows: CatRow[] = spend.slice(0, 6)
        .map(cs => {
          const cat = catMap.get(cs.category_id ?? '');
          return {
            id:     cs.category_id ?? '',
            name:   cat?.name  ?? 'Unknown',
            icon:   cat?.icon  ?? 'shape',
            color:  cat?.color ?? ds.text.muted,
            amount: cs.total,
            pct:    totalExp > 0 ? (cs.total / totalExp) * 100 : 0,
          };
        })
        .filter(r => r.amount > 0);
      setCatRows(rows);
    } catch (err) {
      console.error('[ReportsScreen]', err);
    } finally {
      setLoading(false);
    }
  }, [year, month, ds]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadAccounts();
      loadInvestments();
      loadSavings();
    }, [loadData])
  );

  // ── Annual report ──────────────────────────────────────────────────────────

  const openAnnual = async () => {
    setShowAnnual(true);
    setAnnualLoading(true);
    try {
      setAnnualRows(await getAnnualSummary(year));
    } catch (err) {
      console.error('[ReportsScreen] annual', err);
    } finally {
      setAnnualLoading(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const savingsRate = summary.income > 0 ? Math.max(0, (summary.net / summary.income) * 100) : 0;
  const netWorth    = totalBalance + totalInvested;
  const activeGoals = goals.filter(g => !g.is_completed && !g.is_deleted);
  const hasAnyTrend = trendData.some(d => d.income > 0 || d.expenses > 0);

  const annualTotals = useMemo(() => ({
    income:   annualRows.reduce((s, r) => s + r.income, 0),
    expenses: annualRows.reduce((s, r) => s + r.expenses, 0),
  }), [annualRows]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports</Text>
        {subTab === 'overview' && (
          <View style={styles.monthNav}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => { const [y, m] = prevMonth(year, month); setYear(y); setMonth(m); }}
            >
              <MaterialCommunityIcons name="chevron-left" size={22} color={ds.text.primary} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTH_ABBR[month - 1]} {year}</Text>
            <TouchableOpacity
              style={[styles.navBtn, isCurrentMonth && styles.navBtnDisabled]}
              onPress={() => {
                if (!isCurrentMonth) { const [y, m] = nextMonth(year, month); setYear(y); setMonth(m); }
              }}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={isCurrentMonth ? ds.text.muted : ds.text.primary}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Sub-tab pills */}
      <View style={styles.subTabBar}>
        {(['overview', 'budgets'] as SubTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.subTabPill, subTab === tab && styles.subTabPillActive]}
            onPress={() => setSubTab(tab)}
            activeOpacity={0.75}
          >
            <Text style={[styles.subTabTxt, subTab === tab && styles.subTabTxtActive]}>
              {tab === 'overview' ? 'Overview' : 'Budgets'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {subTab === 'budgets' ? (
        <BudgetScreen />
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ds.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats */}
          <View style={styles.statsGrid}>
            <StatTile label="Income"       value={fmtAmt(summary.income, sym)}   color={ds.primary} styles={styles} />
            <StatTile label="Expenses"     value={fmtAmt(summary.expenses, sym)} color={ds.secondary} styles={styles} />
            <StatTile label="Net Savings"  value={fmtAmt(summary.net, sym)}      color={summary.net >= 0 ? ds.primary : ds.secondary} styles={styles} />
            <StatTile label="Savings Rate" value={`${Math.round(savingsRate)}%`} color={ds.tertiary} styles={styles} />
          </View>

          {/* Income vs Expenses bar chart */}
          <SectionCard title="Income vs Expenses" styles={styles}>
            <View style={styles.chartLegendRow}>
              {[['Income', ds.primary], ['Expenses', ds.secondary]].map(([l, c]) => (
                <View key={l} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: c }]} />
                  <Text style={styles.legendTxt}>{l}</Text>
                </View>
              ))}
            </View>

            {hasAnyTrend ? (
              <View style={{ height: CHART_H }}>
                <CartesianChart
                  data={trendData as any}
                  xKey="x"
                  yKeys={['income', 'expenses'] as any}
                  domainPadding={{ left: 10, right: 10, top: 10 }}
                >
                  {({ points, chartBounds }: any) => (
                    <BarGroup
                      chartBounds={chartBounds}
                      betweenGroupPadding={0.3}
                      withinGroupPadding={0.05}
                    >
                      <BarGroup.Bar points={points.income} color={ds.primary} />
                      <BarGroup.Bar points={points.expenses} color={ds.secondary} />
                    </BarGroup>
                  )}
                </CartesianChart>
              </View>
            ) : (
              <View style={styles.emptyChart}>
                <Text style={styles.emptyTxt}>No data for this period</Text>
              </View>
            )}

            {/* Custom month labels */}
            <View style={styles.xLabels}>
              {trendData.map(d => (
                <Text key={d.x} style={styles.xLabel}>{d.label}</Text>
              ))}
            </View>
          </SectionCard>

          {/* Spending by category */}
          <SectionCard title="Spending by Category" styles={styles}>
            {catRows.length > 0 ? (
              <>
                <View style={styles.donutRow}>
                  <View style={{ width: PIE_SIZE, height: PIE_SIZE }}>
                    <PolarChart
                      data={catRows.slice(0, 5).map(r => ({ value: r.amount, color: r.color, label: r.name }))}
                      labelKey="label"
                      valueKey="value"
                      colorKey="color"
                    >
                      <Pie.Chart innerRadius="40%" />
                    </PolarChart>
                  </View>
                  <View style={styles.pieLegend}>
                    {catRows.slice(0, 5).map(r => (
                      <View key={r.id} style={styles.pieLegendItem}>
                        <View style={[styles.legendDot, { backgroundColor: r.color }]} />
                        <Text style={styles.pieLegendName} numberOfLines={1}>{r.name}</Text>
                        <Text style={styles.pieLegendPct}>{Math.round(r.pct)}%</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.catList}>
                  {catRows.map(r => (
                    <View key={r.id} style={styles.catRow}>
                      <View style={[styles.catIconWrap, { backgroundColor: `${r.color}22` }]}>
                        <MaterialCommunityIcons name={r.icon as any} size={15} color={r.color} />
                      </View>
                      <View style={styles.catInfo}>
                        <View style={styles.catTopRow}>
                          <Text style={styles.catName}>{r.name}</Text>
                          <Text style={styles.catAmt}>{fmtAmt(r.amount, sym)}</Text>
                        </View>
                        <View style={styles.catBarBg}>
                          <View style={[
                            styles.catBarFill,
                            { width: `${Math.round(r.pct)}%` as any, backgroundColor: r.color },
                          ]} />
                        </View>
                        <Text style={styles.catPctTxt}>{Math.round(r.pct)}% of total expenses</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.emptyTxt}>No expense data this month</Text>
            )}
          </SectionCard>

          {/* Savings goals summary */}
          {activeGoals.length > 0 && (
            <SectionCard title="Savings Goals" styles={styles}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.goalsScroll}
              >
                {activeGoals.map(g => (
                  <View key={g.id} style={styles.goalMini}>
                    <View style={[styles.goalIconWrap, { backgroundColor: `${g.color ?? ds.tertiary}22` }]}>
                      <MaterialCommunityIcons
                        name={(g.icon ?? 'piggy-bank') as any}
                        size={22}
                        color={g.color ?? ds.tertiary}
                      />
                    </View>
                    <Text style={styles.goalName} numberOfLines={1}>{g.name}</Text>
                    <View style={styles.goalBarBg}>
                      <View style={[
                        styles.goalBarFill,
                        { width: `${Math.min(100, Math.round(g.percent))}%` as any, backgroundColor: g.color ?? ds.tertiary },
                      ]} />
                    </View>
                    <Text style={[styles.goalPct, { color: g.color ?? ds.tertiary }]}>
                      {Math.round(g.percent)}%
                    </Text>
                    <Text style={styles.goalAmts} numberOfLines={1}>
                      {fmtAmt(g.contributed, sym)} / {fmtAmt(g.target_amount, sym)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </SectionCard>
          )}

          {/* Net worth */}
          <SectionCard title="Net Worth" styles={styles}>
            <View style={styles.nwRow}>
              <View style={[styles.nwIcon, { backgroundColor: `${ds.primary}22` }]}>
                <MaterialCommunityIcons name="wallet" size={16} color={ds.primary} />
              </View>
              <Text style={styles.nwLabel}>Account Balances</Text>
              <Text style={[styles.nwVal, { color: ds.primary }]}>{fmtAmt(totalBalance, sym)}</Text>
            </View>
            <View style={styles.nwRow}>
              <View style={[styles.nwIcon, { backgroundColor: `${ds.purple}22` }]}>
                <MaterialCommunityIcons name="trending-up" size={16} color={ds.purple} />
              </View>
              <Text style={styles.nwLabel}>Investments</Text>
              <Text style={[styles.nwVal, { color: ds.purple }]}>{fmtAmt(totalInvested, sym)}</Text>
            </View>
            <View style={styles.nwDivider} />
            <View style={styles.nwRow}>
              <Text style={styles.nwTotalLabel}>Total Net Worth</Text>
              <Text style={[styles.nwTotalVal, { color: netWorth >= 0 ? ds.primaryLight : ds.secondary }]}>
                {fmtAmt(netWorth, sym)}
              </Text>
            </View>
          </SectionCard>

          {/* Annual report button */}
          <TouchableOpacity style={styles.annualBtn} onPress={openAnnual} activeOpacity={0.8}>
            <MaterialCommunityIcons name="calendar-month-outline" size={18} color={ds.primary} />
            <Text style={styles.annualBtnTxt}>View Annual Report {year}</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={ds.primary} />
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Annual report modal */}
      <Modal
        visible={showAnnual}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAnnual(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Annual Report {year}</Text>
              <TouchableOpacity onPress={() => setShowAnnual(false)} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={22} color={ds.text.secondary} />
              </TouchableOpacity>
            </View>

            {annualLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={ds.primary} />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, styles.colMonth]}>Month</Text>
                  <Text style={[styles.th, styles.colNum]}>Income</Text>
                  <Text style={[styles.th, styles.colNum]}>Expenses</Text>
                  <Text style={[styles.th, styles.colNum]}>Net</Text>
                </View>

                {MONTH_ABBR.map((label, i) => {
                  const m = i + 1;
                  const row = annualRows.find(r => r.month === m) ?? { month: m, income: 0, expenses: 0 };
                  const net = row.income - row.expenses;
                  const isActive = m === month;
                  return (
                    <View key={m} style={[styles.tableRow, isActive && styles.tableRowActive]}>
                      <Text style={[styles.td, styles.colMonth, isActive && styles.tdActive]}>
                        {label}
                      </Text>
                      <Text style={[styles.td, styles.colNum, { color: row.income > 0 ? ds.primary : ds.text.muted }]}>
                        {row.income > 0 ? fmtAmt(row.income, sym) : '—'}
                      </Text>
                      <Text style={[styles.td, styles.colNum, { color: row.expenses > 0 ? ds.secondary : ds.text.muted }]}>
                        {row.expenses > 0 ? fmtAmt(row.expenses, sym) : '—'}
                      </Text>
                      <Text style={[styles.td, styles.colNum, { color: net > 0 ? ds.primary : net < 0 ? ds.secondary : ds.text.muted }]}>
                        {net !== 0 ? fmtAmt(net, sym) : '—'}
                      </Text>
                    </View>
                  );
                })}

                <View style={[styles.tableRow, styles.tableTotal]}>
                  <Text style={[styles.tdBold, styles.colMonth]}>Total</Text>
                  <Text style={[styles.tdBold, styles.colNum, { color: ds.primary }]}>
                    {fmtAmt(annualTotals.income, sym)}
                  </Text>
                  <Text style={[styles.tdBold, styles.colNum, { color: ds.secondary }]}>
                    {fmtAmt(annualTotals.expenses, sym)}
                  </Text>
                  <Text style={[styles.tdBold, styles.colNum, {
                    color: (annualTotals.income - annualTotals.expenses) >= 0 ? ds.primary : ds.secondary,
                  }]}>
                    {fmtAmt(annualTotals.income - annualTotals.expenses, sym)}
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
