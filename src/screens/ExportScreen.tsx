import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { generatePDF } from 'react-native-html-to-pdf';

import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';
import { hexToRgba } from '../utils/color';
import {
  getTransactions,
  getAllCategories,
  getActiveAccounts,
  getAccountBalance,
  getAllInvestments,
  getAllSavingsGoals,
  getTotalContributed,
  getAllTrips,
  getTripTotal,
} from '../db/queries';
import AppCard from '../components/AppCard';
import BottomSheet from '../components/BottomSheet';

// ── Types ─────────────────────────────────────────────────────────────────────

type DateRangeOption = 'this_month' | 'this_year' | 'all_time' | 'custom';
type ExportFormat = 'excel' | 'csv' | 'pdf';
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const DATE_RANGE_LABELS: Record<DateRangeOption, string> = {
  this_month: 'This Month',
  this_year:  'This Year',
  all_time:   'All Time',
  custom:     'Custom',
};

const EXPORT_CARDS: {
  type: ExportFormat;
  icon: IconName;
  color: string;
  label: string;
  description: string;
}[] = [
  {
    type: 'excel',
    icon: 'microsoft-excel',
    color: '#10B981',
    label: 'Export as Excel',
    description: '8-sheet workbook: summary dashboard, transactions, monthly breakdown, categories, accounts, investments, savings goals & trips',
  },
  {
    type: 'pdf',
    icon: 'file-pdf-box',
    color: '#F43F5E',
    label: 'Export as PDF',
    description: 'Formatted report with summary stats, spending breakdown, accounts, savings goals & investments',
  },
  {
    type: 'csv',
    icon: 'file-delimited-outline',
    color: '#3B82F6',
    label: 'Export as CSV',
    description: 'Lightweight raw transaction data for any spreadsheet app',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

function getDateFilter(option: DateRangeOption, customYear: number, customMonth: number) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  if (option === 'this_month') {
    return { start_date: `${y}-${pad(m)}-01`, end_date: `${y}-${pad(m)}-31` };
  }
  if (option === 'this_year') {
    return { start_date: `${y}-01-01`, end_date: `${y}-12-31` };
  }
  if (option === 'custom') {
    return { start_date: `${customYear}-${pad(customMonth)}-01`, end_date: `${customYear}-${pad(customMonth)}-31` };
  }
  return {}; // all time — no date filter
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: ds.surface.screen },

    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: ds.border.subtle,
      gap: 12,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: ds.surface.elevated,
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
      flex: 1, fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 28,
      letterSpacing: -0.4, color: ds.text.primary, textAlign: 'center',
    },

    scroll:        { flex: 1 },
    scrollContent: { padding: 16, gap: 8 },

    subtitle: {
      fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22,
      color: ds.text.muted, marginBottom: 8,
    },

    sectionLabel: {
      fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 15,
      letterSpacing: 0.8, textTransform: 'uppercase',
      color: ds.text.muted, marginTop: 8, marginBottom: 6, marginLeft: 2,
    },

    // Date range chips
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: ds.radius.full,
      borderWidth: 1.5, borderColor: ds.border.subtle,
      backgroundColor: ds.surface.elevated,
    },
    chipActive:     { borderColor: ds.primary, backgroundColor: hexToRgba(ds.primary, 0.12) },
    chipText:       { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, color: ds.text.secondary },
    chipTextActive: { color: ds.primaryLight },

    // Export cards
    exportCard: { marginBottom: 8 },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
    cardIconWrap: {
      width: 52, height: 52, borderRadius: ds.radius.lg,
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    cardMeta: { flex: 1, gap: 4 },
    cardTitle: {
      fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22,
      color: ds.text.primary,
    },
    cardDesc: {
      fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19,
      color: ds.text.muted,
    },
    exportBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, height: 44, borderRadius: ds.radius.md,
      borderWidth: 1.5,
    },
    exportBtnDisabled: { opacity: 0.4 },
    exportBtnText: {
      fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20,
    },

    // Info note
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 },
    infoText: {
      flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18,
      color: ds.text.muted,
    },

    // Loading overlay
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
    overlayBox: {
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.xl,
      padding: 32, alignItems: 'center', gap: 14,
      borderWidth: 1, borderColor: ds.border.subtle,
      minWidth: 200,
      ...ds.shadow.modal,
    },
    overlayText: {
      fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22,
      color: ds.text.primary,
    },
    overlayHint: {
      fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18,
      color: ds.text.muted,
    },

    // Toast
    toast: {
      position: 'absolute', alignSelf: 'center',
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: '#1A3C30',
      borderWidth: 1, borderColor: hexToRgba(ds.primary, 0.4),
      paddingHorizontal: 18, paddingVertical: 12,
      borderRadius: ds.radius.full,
    },
    toastText: {
      fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20,
      color: ds.primaryLight,
    },

    // Custom period picker
    pickerBody: { padding: 20, paddingTop: 8, gap: 6 },
    stepperRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', paddingVertical: 8,
    },
    stepperLabel: {
      fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 15,
      letterSpacing: 0.8, textTransform: 'uppercase', color: ds.text.muted,
    },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 0 },
    stepBtn: {
      width: 38, height: 38, borderRadius: ds.radius.md,
      backgroundColor: ds.surface.elevated,
      alignItems: 'center', justifyContent: 'center',
    },
    stepValue: {
      fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 24,
      color: ds.text.primary, width: 68, textAlign: 'center',
    },
    monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    monthChip: {
      width: '22%', paddingVertical: 8, borderRadius: ds.radius.md,
      backgroundColor: ds.surface.elevated,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: 'transparent',
    },
    monthChipActive:     { borderColor: ds.primary, backgroundColor: hexToRgba(ds.primary, 0.12) },
    monthChipText:       { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, color: ds.text.secondary },
    monthChipTextActive: { color: ds.primaryLight, fontFamily: 'Inter_600SemiBold' },
    applyBtn: {
      height: 52, borderRadius: ds.radius.lg,
      backgroundColor: ds.primary, alignItems: 'center', justifyContent: 'center',
    },
    applyBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15, lineHeight: 20, color: '#fff' },
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExportScreen() {
  const ds = useDS();
  const s = useMemo(() => makeStyles(ds), [ds]);

  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [dateRange,        setDateRange]        = useState<DateRangeOption>('this_year');
  const [customYear,       setCustomYear]       = useState(new Date().getFullYear());
  const [customMonth,      setCustomMonth]      = useState(new Date().getMonth() + 1);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [isGenerating,     setIsGenerating]     = useState(false);
  const [generatingType,   setGeneratingType]   = useState<ExportFormat | null>(null);
  const [toast,            setToast]            = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fmt = (paise: number) => (paise / 100).toFixed(2);

  // ── Excel ───────────────────────────────────────────────────────────────────

  const handleExcel = async () => {
    setIsGenerating(true);
    setGeneratingType('excel');
    try {
      const filter = getDateFilter(dateRange, customYear, customMonth);
      const [transactions, categories, accounts, investments, trips, savingsGoals] = await Promise.all([
        getTransactions(filter),
        getAllCategories(),
        getActiveAccounts(),
        getAllInvestments(),
        getAllTrips(),
        getAllSavingsGoals(),
      ]);

      const catMap: Record<string, string> = {};
      for (const c of categories) catMap[c.id] = c.name;

      const accMap: Record<string, string> = {};
      for (const a of accounts) accMap[a.id] = a.name;

      const tripMap: Record<string, string> = {};
      for (const t of trips) tripMap[t.id] = t.name;

      const [accountsWithBalance, tripsWithTotal, goalsWithProgress] = await Promise.all([
        Promise.all(accounts.map(async a => ({ ...a, balance: await getAccountBalance(a.id) }))),
        Promise.all(trips.map(async t => ({ ...t, total: await getTripTotal(t.id) }))),
        Promise.all(savingsGoals.map(async g => {
          const contributed = await getTotalContributed(g.id);
          const percent = g.target_amount > 0 ? Math.min(100, Math.round((contributed / g.target_amount) * 100)) : 0;
          return { ...g, contributed, percent };
        })),
      ]);

      // Pre-compute aggregates (reused across Summary + By Category sheets)
      let summaryIncome = 0, summaryExpenses = 0;
      const byCat: Record<string, number> = {};
      for (const tx of transactions) {
        if (tx.type === 'income') summaryIncome += tx.amount;
        else if (tx.type === 'expense') {
          summaryExpenses += tx.amount;
          if (tx.category_id) {
            const name = catMap[tx.category_id] ?? 'Unknown';
            byCat[name] = (byCat[name] ?? 0) + tx.amount;
          }
        }
      }
      const summaryNet          = summaryIncome - summaryExpenses;
      const savingsRate         = summaryIncome > 0 ? Math.round((summaryNet / summaryIncome) * 100) : 0;
      const totalAccountBalance = accountsWithBalance.reduce((s, a) => s + a.balance, 0);
      const totalInvestedAmt    = investments.reduce((s, i) => s + i.total_amount, 0);
      const investByType: Record<string, number> = {};
      for (const i of investments) {
        const typeName = i.asset_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        investByType[typeName] = (investByType[typeName] ?? 0) + i.total_amount;
      }
      const totalTargetSavings  = savingsGoals.reduce((s, g) => s + g.target_amount, 0);
      const totalContributedAll = goalsWithProgress.reduce((s, g) => s + g.contributed, 0);
      const completedGoals      = goalsWithProgress.filter(g => g.is_completed).length;
      const totalTripExpenses   = tripsWithTotal.reduce((s, t) => s + t.total, 0);
      const settledTrips        = tripsWithTotal.filter(t => t.is_settled).length;
      const overallGoalProgress = totalTargetSavings > 0
        ? Math.min(100, Math.round((totalContributedAll / totalTargetSavings) * 100)) : 0;

      const rangeLabel = dateRange === 'custom'
        ? `${MONTHS_SHORT[customMonth - 1]} ${customYear}`
        : DATE_RANGE_LABELS[dateRange];

      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary dashboard (all key metrics in one place)
      const topCats = Object.entries(byCat).sort(([, a], [, b]) => b - a).slice(0, 10);
      const summaryAoa: (string | number)[][] = [
        ['FINIO — FINANCIAL SUMMARY'],
        [`Period: ${rangeLabel}`, '', `Generated: ${new Date().toLocaleDateString()}`],
        [],
        ['INCOME & EXPENSES', 'Value'],
        ['Total Income',    fmt(summaryIncome)],
        ['Total Expenses',  fmt(summaryExpenses)],
        ['Net Savings',     fmt(summaryNet)],
        ['Savings Rate',    `${savingsRate}%`],
        ['Transactions',   transactions.filter(t => t.type !== 'transfer').length],
        [],
        ['ACCOUNTS', 'Type', 'Opening Balance', 'Current Balance'],
        ...accountsWithBalance.map(a => [
          a.name,
          a.type.charAt(0).toUpperCase() + a.type.slice(1),
          fmt(a.opening_balance),
          fmt(a.balance),
        ]),
        ['TOTAL', '', '', fmt(totalAccountBalance)],
        [],
        ['INVESTMENTS', 'Value'],
        ['Total Portfolio Value', fmt(totalInvestedAmt)],
        ['Number of Investments', investments.length],
        [],
        ['By Asset Type', 'Total Value'],
        ...Object.entries(investByType).sort(([, a], [, b]) => b - a).map(([type, total]) => [type, fmt(total)]),
        [],
        ['SAVINGS GOALS', 'Value'],
        ['Total Goals',         savingsGoals.length],
        ['Completed',           completedGoals],
        ['In Progress',         savingsGoals.length - completedGoals],
        ['Total Target Amount', fmt(totalTargetSavings)],
        ['Total Contributed',   fmt(totalContributedAll)],
        ['Overall Progress',    `${overallGoalProgress}%`],
        [],
        ['TRIPS', 'Value'],
        ['Total Trips',         trips.length],
        ['Settled',             settledTrips],
        ['Active',              trips.length - settledTrips],
        ['Total Trip Expenses', fmt(totalTripExpenses)],
        [],
        ['TOP SPENDING CATEGORIES (Period)', 'Amount'],
        ...topCats.map(([cat, total]) => [cat, fmt(total)]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryAoa), 'Summary');

      // Sheet 2: Transactions
      const txRows = transactions.map(tx => ({
        Date:          tx.transaction_date,
        Time:          tx.transaction_time ?? '',
        Type:          tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
        Category:      tx.category_id ? (catMap[tx.category_id] ?? '') : '',
        Account:       accMap[tx.account_id] ?? '',
        'To Account':  tx.to_account_id ? (accMap[tx.to_account_id] ?? '') : '',
        Amount:        fmt(tx.amount),
        Description:   tx.description ?? '',
        Notes:         tx.notes ?? '',
        Tag:           tx.tag ?? '',
        Trip:          tx.trip_id ? (tripMap[tx.trip_id] ?? '') : '',
        Recurring:     tx.is_recurring ? 'Yes' : 'No',
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(txRows.length ? txRows : [{
          Date: '', Time: '', Type: '', Category: '', Account: '', 'To Account': '',
          Amount: '', Description: 'No transactions in range', Notes: '', Tag: '', Trip: '', Recurring: '',
        }]),
        'Transactions'
      );

      // Sheet 3: Monthly Summary — group transactions by YYYY-MM
      const byMonth: Record<string, { income: number; expenses: number }> = {};
      for (const tx of transactions) {
        if (tx.type === 'transfer') continue;
        const key = tx.transaction_date.slice(0, 7);
        if (!byMonth[key]) byMonth[key] = { income: 0, expenses: 0 };
        if (tx.type === 'income') byMonth[key].income += tx.amount;
        else byMonth[key].expenses += tx.amount;
      }
      const summaryRows = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, s]) => ({
          Month:         month,
          Income:        fmt(s.income),
          Expenses:      fmt(s.expenses),
          'Net Savings': fmt(s.income - s.expenses),
        }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(summaryRows.length ? summaryRows : [{ Month: 'No data', Income: '0.00', Expenses: '0.00', 'Net Savings': '0.00' }]),
        'Monthly Summary'
      );

      // Sheet 4: By Category (expenses only)
      const catRows = Object.entries(byCat)
        .sort(([, a], [, b]) => b - a)
        .map(([cat, total]) => ({ Category: cat, 'Total Spent': fmt(total) }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(catRows.length ? catRows : [{ Category: 'No data', 'Total Spent': '0.00' }]),
        'By Category'
      );

      // Sheet 5: Accounts
      const accRows = accountsWithBalance.map(a => ({
        Name:              a.name,
        Type:              a.type.charAt(0).toUpperCase() + a.type.slice(1),
        'Opening Balance': fmt(a.opening_balance),
        'Current Balance': fmt(a.balance),
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(accRows.length ? accRows : [{ Name: 'No accounts', Type: '', 'Opening Balance': '0.00', 'Current Balance': '0.00' }]),
        'Accounts'
      );

      // Sheet 6: Investments (total_amount includes all top-up contributions)
      const invRows = investments.map(i => ({
        'Asset Name':            i.asset_name,
        Type:                    i.asset_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        'Initial Amount':        fmt(i.amount_invested),
        'Total (incl. top-ups)': fmt(i.total_amount),
        Date:                    i.investment_date,
        Account:                 i.account_id ? (accMap[i.account_id] ?? '') : '',
        Notes:                   i.notes ?? '',
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(invRows.length ? invRows : [{
          'Asset Name': 'No investments', Type: '', 'Initial Amount': '0.00',
          'Total (incl. top-ups)': '0.00', Date: '', Account: '', Notes: '',
        }]),
        'Investments'
      );

      // Sheet 7: Savings Goals
      const goalsRows = goalsWithProgress.map(g => ({
        Name:            g.name,
        'Target Amount': fmt(g.target_amount),
        Contributed:     fmt(g.contributed),
        '% Complete':    g.percent,
        'Target Date':   g.target_date ?? '',
        Status:          g.is_completed ? 'Completed' : 'In Progress',
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(goalsRows.length ? goalsRows : [{
          Name: 'No savings goals', 'Target Amount': '0.00', Contributed: '0.00',
          '% Complete': 0, 'Target Date': '', Status: '',
        }]),
        'Savings Goals'
      );

      // Sheet 8: Trips
      const tripSheetRows = tripsWithTotal.map(t => ({
        Name:          t.name,
        Description:   t.description ?? '',
        'Start Date':  t.start_date ?? '',
        'End Date':    t.end_date ?? '',
        'Total Spent': fmt(t.total),
        Status:        t.is_settled ? 'Settled' : 'Active',
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(tripSheetRows.length ? tripSheetRows : [{
          Name: 'No trips', Description: '', 'Start Date': '', 'End Date': '', 'Total Spent': '0.00', Status: '',
        }]),
        'Trips'
      );

      const base64   = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      const fileName = `finio_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, base64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(filePath, {
        mimeType:    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Finio Data',
        UTI:         'com.microsoft.excel.xlsx',
      });
      showToast('Excel file exported');
    } catch (err) {
      Alert.alert('Export failed', String(err));
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  // ── CSV ─────────────────────────────────────────────────────────────────────

  const handleCSV = async () => {
    setIsGenerating(true);
    setGeneratingType('csv');
    try {
      const filter = getDateFilter(dateRange, customYear, customMonth);
      const [transactions, categories, accounts, trips] = await Promise.all([
        getTransactions(filter),
        getAllCategories(),
        getActiveAccounts(),
        getAllTrips(),
      ]);

      const catMap: Record<string, string> = {};
      for (const c of categories) catMap[c.id] = c.name;
      const accMap: Record<string, string> = {};
      for (const a of accounts) accMap[a.id] = a.name;
      const tripMap: Record<string, string> = {};
      for (const t of trips) tripMap[t.id] = t.name;

      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
      const header = 'Date,Time,Type,Category,Account,To Account,Amount,Description,Notes,Tag,Trip';
      const rows = transactions.map(tx => [
        tx.transaction_date,
        tx.transaction_time ?? '',
        tx.type,
        esc(tx.category_id ? (catMap[tx.category_id] ?? '') : ''),
        esc(accMap[tx.account_id] ?? ''),
        esc(tx.to_account_id ? (accMap[tx.to_account_id] ?? '') : ''),
        fmt(tx.amount),
        esc(tx.description ?? ''),
        esc(tx.notes ?? ''),
        esc(tx.tag ?? ''),
        esc(tx.trip_id ? (tripMap[tx.trip_id] ?? '') : ''),
      ].join(','));

      const csv      = [header, ...rows].join('\n');
      const fileName = `finio_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(filePath, { mimeType: 'text/csv', dialogTitle: 'Export CSV' });
      showToast('CSV exported successfully');
    } catch (err) {
      Alert.alert('Export failed', String(err));
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  // ── PDF ─────────────────────────────────────────────────────────────────────

  const handlePDF = async () => {
    setIsGenerating(true);
    setGeneratingType('pdf');
    try {
      const filter = getDateFilter(dateRange, customYear, customMonth);
      const [transactions, categories, accounts, investments, savingsGoals] = await Promise.all([
        getTransactions(filter),
        getAllCategories(),
        getActiveAccounts(),
        getAllInvestments(),
        getAllSavingsGoals(),
      ]);

      const catMap: Record<string, string> = {};
      for (const c of categories) catMap[c.id] = c.name;
      const accMap: Record<string, string> = {};
      for (const a of accounts) accMap[a.id] = a.name;

      let totalIncome = 0, totalExpenses = 0;
      const byCat: Record<string, number> = {};
      for (const tx of transactions) {
        if (tx.type === 'income') totalIncome += tx.amount;
        else if (tx.type === 'expense') {
          totalExpenses += tx.amount;
          const name = tx.category_id ? (catMap[tx.category_id] ?? 'Other') : 'Other';
          byCat[name] = (byCat[name] ?? 0) + tx.amount;
        }
      }

      const [accountsWithBalance, goalsWithProgress] = await Promise.all([
        Promise.all(accounts.map(async a => ({ ...a, balance: await getAccountBalance(a.id) }))),
        Promise.all(savingsGoals.map(async g => {
          const contributed = await getTotalContributed(g.id);
          const percent = g.target_amount > 0 ? Math.min(100, Math.round((contributed / g.target_amount) * 100)) : 0;
          return { ...g, contributed, percent };
        })),
      ]);

      const label = dateRange === 'custom'
        ? `${MONTHS_SHORT[customMonth - 1]} ${customYear}`
        : DATE_RANGE_LABELS[dateRange];

      const catRowsHtml = Object.entries(byCat)
        .sort(([, a], [, b]) => b - a).slice(0, 10)
        .map(([name, amt]) => `<tr><td>${name}</td><td class="right">${fmt(amt)}</td></tr>`)
        .join('');

      const txRowsHtml = transactions.slice(0, 50)
        .map(tx => `<tr>
          <td>${tx.transaction_date}</td>
          <td>${tx.type}</td>
          <td>${tx.category_id ? (catMap[tx.category_id] ?? '') : ''}</td>
          <td class="right">${fmt(tx.amount)}</td>
          <td>${tx.description ?? ''}${tx.tag ? ` [${tx.tag}]` : ''}</td>
        </tr>`).join('');

      const accRowsHtml = accountsWithBalance
        .map(a => `<tr>
          <td>${a.name}</td>
          <td>${a.type.charAt(0).toUpperCase() + a.type.slice(1)}</td>
          <td class="right">${fmt(a.balance)}</td>
        </tr>`).join('');

      const goalsRowsHtml = goalsWithProgress
        .map(g => `<tr>
          <td>${g.name}</td>
          <td class="right">${fmt(g.target_amount)}</td>
          <td class="right">${fmt(g.contributed)}</td>
          <td class="right">${g.percent}%</td>
          <td>${g.is_completed ? 'Completed' : 'In Progress'}</td>
        </tr>`).join('');

      const invRowsHtml = investments
        .map(i => `<tr>
          <td>${i.asset_name}</td>
          <td>${i.asset_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</td>
          <td class="right">${fmt(i.total_amount)}</td>
          <td>${i.account_id ? (accMap[i.account_id] ?? '') : ''}</td>
        </tr>`).join('');

      const net = totalIncome - totalExpenses;
      const html = `<html><head><meta charset="utf-8"><style>
        body{font-family:sans-serif;padding:24px;color:#111}
        h1{font-size:22px;margin-bottom:4px}
        h2{font-size:14px;margin-top:24px;margin-bottom:8px;color:#555;text-transform:uppercase;letter-spacing:.5px}
        .summary{display:flex;gap:12px;margin-bottom:8px}
        .stat{background:#f5f5f5;border-radius:8px;padding:10px 16px;flex:1}
        .stat-label{font-size:10px;text-transform:uppercase;color:#888}
        .stat-value{font-size:18px;font-weight:bold;margin-top:2px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{text-align:left;padding:7px 5px;border-bottom:2px solid #ddd;font-size:10px;text-transform:uppercase;color:#888}
        td{padding:6px 5px;border-bottom:1px solid #eee}
        .right{text-align:right}
        .green{color:#10b981}.red{color:#f43f5e}
        .footer{margin-top:32px;font-size:10px;color:#aaa;text-align:center}
      </style></head><body>
        <h1>Finio Financial Report</h1>
        <p style="color:#888;font-size:12px">Period: ${label} &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString()}</p>
        <div class="summary">
          <div class="stat"><div class="stat-label">Income</div><div class="stat-value green">${fmt(totalIncome)}</div></div>
          <div class="stat"><div class="stat-label">Expenses</div><div class="stat-value red">${fmt(totalExpenses)}</div></div>
          <div class="stat"><div class="stat-label">Net Savings</div><div class="stat-value ${net >= 0 ? 'green' : 'red'}">${fmt(net)}</div></div>
        </div>
        <h2>Spending by Category</h2>
        <table><tr><th>Category</th><th class="right">Amount</th></tr>
          ${catRowsHtml || '<tr><td colspan="2">No expense data</td></tr>'}
        </table>
        <h2>Recent Transactions</h2>
        <table><tr><th>Date</th><th>Type</th><th>Category</th><th class="right">Amount</th><th>Description</th></tr>
          ${txRowsHtml || '<tr><td colspan="5">No transactions</td></tr>'}
        </table>
        <h2>Accounts</h2>
        <table><tr><th>Name</th><th>Type</th><th class="right">Balance</th></tr>
          ${accRowsHtml || '<tr><td colspan="3">No accounts</td></tr>'}
        </table>
        <h2>Savings Goals</h2>
        <table><tr><th>Name</th><th class="right">Target</th><th class="right">Contributed</th><th class="right">Progress</th><th>Status</th></tr>
          ${goalsRowsHtml || '<tr><td colspan="5">No savings goals</td></tr>'}
        </table>
        <h2>Investments</h2>
        <table><tr><th>Asset</th><th>Type</th><th class="right">Total Value</th><th>Account</th></tr>
          ${invRowsHtml || '<tr><td colspan="4">No investments</td></tr>'}
        </table>
        <div class="footer">Generated by Finio</div>
      </body></html>`;

      const result = await generatePDF({
        html,
        fileName: `finio_report_${new Date().toISOString().slice(0, 10)}`,
        directory: 'Documents',
      });

      if (result.filePath) {
        await Sharing.shareAsync(`file://${result.filePath}`, { mimeType: 'application/pdf', dialogTitle: 'Export PDF' });
        showToast('PDF exported successfully');
      }
    } catch (err) {
      Alert.alert('Export failed', String(err));
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  const rangeLabel = dateRange === 'custom'
    ? `${MONTHS_SHORT[customMonth - 1]} ${customYear}`
    : DATE_RANGE_LABELS[dateRange];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={ds.text.primary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Export Data</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.subtitle}>
          Download your financial data as Excel, PDF, or CSV for analysis, backup, or sharing.
        </Text>

        {/* Date Range */}
        <Text style={s.sectionLabel}>Date Range</Text>
        <View style={s.chipRow}>
          {(['this_month', 'this_year', 'all_time', 'custom'] as DateRangeOption[]).map(opt => {
            const active = dateRange === opt;
            const label  = opt === 'custom' && active ? rangeLabel : DATE_RANGE_LABELS[opt];
            return (
              <TouchableOpacity
                key={opt}
                style={[s.chip, active && s.chipActive]}
                onPress={() => {
                  setDateRange(opt);
                  if (opt === 'custom') setShowCustomPicker(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Export cards */}
        <Text style={s.sectionLabel}>Export Format</Text>

        {EXPORT_CARDS.map(card => {
          const loading = isGenerating && generatingType === card.type;
          return (
            <AppCard key={card.type} padding={20} style={s.exportCard}>
              <View style={s.cardTop}>
                <View style={[s.cardIconWrap, { backgroundColor: hexToRgba(card.color, 0.15) }]}>
                  <MaterialCommunityIcons name={card.icon} size={26} color={card.color} />
                </View>
                <View style={s.cardMeta}>
                  <Text style={s.cardTitle}>{card.label}</Text>
                  <Text style={s.cardDesc} numberOfLines={2}>{card.description}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  s.exportBtn,
                  { borderColor: hexToRgba(card.color, 0.35), backgroundColor: hexToRgba(card.color, 0.10) },
                  isGenerating && !loading && s.exportBtnDisabled,
                ]}
                onPress={() => {
                  if (isGenerating) return;
                  if (card.type === 'excel') handleExcel();
                  else if (card.type === 'csv') handleCSV();
                  else handlePDF();
                }}
                disabled={isGenerating}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={card.color} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="download-outline" size={16} color={isGenerating ? ds.text.muted : card.color} />
                    <Text style={[s.exportBtnText, { color: isGenerating ? ds.text.muted : card.color }]}>
                      Export
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </AppCard>
          );
        })}

        {/* Info note */}
        <View style={s.infoRow}>
          <MaterialCommunityIcons name="information-outline" size={14} color={ds.text.muted} />
          <Text style={s.infoText}>Files are written to device cache and opened via the system share sheet.</Text>
        </View>
      </ScrollView>

      {/* Full-screen loading overlay */}
      <Modal transparent animationType="fade" visible={isGenerating}>
        <View style={s.overlay}>
          <View style={s.overlayBox}>
            <ActivityIndicator size="large" color={ds.primary} />
            <Text style={s.overlayText}>
              Generating {generatingType?.toUpperCase() ?? ''}…
            </Text>
            <Text style={s.overlayHint}>This may take a moment</Text>
          </View>
        </View>
      </Modal>

      {/* Toast */}
      {toast != null && (
        <View style={[s.toast, { bottom: insets.bottom + 28 }]}>
          <MaterialCommunityIcons name="check-circle" size={16} color="#fff" />
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}

      {/* Custom period picker */}
      <BottomSheet
        visible={showCustomPicker}
        onClose={() => setShowCustomPicker(false)}
        title="Select Period"
      >
        <View style={s.pickerBody}>
          {/* Year stepper */}
          <View style={s.stepperRow}>
            <Text style={s.stepperLabel}>Year</Text>
            <View style={s.stepper}>
              <TouchableOpacity
                style={s.stepBtn}
                onPress={() => setCustomYear(y => y - 1)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="minus" size={18} color={ds.text.primary} />
              </TouchableOpacity>
              <Text style={s.stepValue}>{customYear}</Text>
              <TouchableOpacity
                style={s.stepBtn}
                onPress={() => setCustomYear(y => Math.min(y + 1, new Date().getFullYear()))}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="plus" size={18} color={ds.text.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Month grid */}
          <Text style={[s.stepperLabel, { marginBottom: 10 }]}>Month</Text>
          <View style={s.monthGrid}>
            {MONTHS_SHORT.map((m, i) => {
              const active = customMonth === i + 1;
              return (
                <TouchableOpacity
                  key={m}
                  style={[s.monthChip, active && s.monthChipActive]}
                  onPress={() => setCustomMonth(i + 1)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.monthChipText, active && s.monthChipTextActive]}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={s.applyBtn}
            onPress={() => setShowCustomPicker(false)}
            activeOpacity={0.85}
          >
            <Text style={s.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
}
