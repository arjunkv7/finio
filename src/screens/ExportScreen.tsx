import React, { useState } from 'react';
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
// @ts-ignore
import RNHTMLtoPDF from 'react-native-html-to-pdf';

import { DS } from '../constants';
import { hexToRgba } from '../utils/color';
import { useSettingsStore } from '../store/settingsStore';
import {
  getTransactions,
  getAllCategories,
  getActiveAccounts,
  getAccountBalance,
  getAllInvestments,
  getAllSavingsGoals,
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
    description: '5-sheet workbook: transactions, monthly summary, categories, accounts & investments',
  },
  {
    type: 'pdf',
    icon: 'file-pdf-box',
    color: '#F43F5E',
    label: 'Export as PDF',
    description: 'Formatted report with monthly breakdown, category chart & savings goals',
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExportScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { currencySymbol } = useSettingsStore();

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
      const [transactions, categories, accounts, investments] = await Promise.all([
        getTransactions(filter),
        getAllCategories(),
        getActiveAccounts(),
        getAllInvestments(),
      ]);

      const catMap: Record<string, string> = {};
      for (const c of categories) catMap[c.id] = c.name;

      const accMap: Record<string, string> = {};
      for (const a of accounts) accMap[a.id] = a.name;

      const accountsWithBalance = await Promise.all(
        accounts.map(async a => ({ ...a, balance: await getAccountBalance(a.id) }))
      );

      const wb = XLSX.utils.book_new();

      // Sheet 1: Transactions
      const txRows = transactions.map(tx => ({
        Date:        tx.transaction_date,
        Type:        tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
        Category:    tx.category_id ? (catMap[tx.category_id] ?? '') : '',
        Account:     accMap[tx.account_id] ?? '',
        Amount:      fmt(tx.amount),
        Description: tx.description ?? '',
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(txRows.length ? txRows : [{ Date: '', Type: '', Category: '', Account: '', Amount: '', Description: 'No transactions in range' }]),
        'Transactions'
      );

      // Sheet 2: Monthly Summary — group transactions by YYYY-MM
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

      // Sheet 3: By Category (expenses only)
      const byCat: Record<string, number> = {};
      for (const tx of transactions) {
        if (tx.type !== 'expense' || !tx.category_id) continue;
        const name = catMap[tx.category_id] ?? 'Unknown';
        byCat[name] = (byCat[name] ?? 0) + tx.amount;
      }
      const catRows = Object.entries(byCat)
        .sort(([, a], [, b]) => b - a)
        .map(([cat, total]) => ({ Category: cat, 'Total Spent': fmt(total) }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(catRows.length ? catRows : [{ Category: 'No data', 'Total Spent': '0.00' }]),
        'By Category'
      );

      // Sheet 4: Accounts
      const accRows = accountsWithBalance.map(a => ({
        Name:              a.name,
        Type:              a.type.charAt(0).toUpperCase() + a.type.slice(1),
        'Current Balance': fmt(a.balance),
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(accRows.length ? accRows : [{ Name: 'No accounts', Type: '', 'Current Balance': '0.00' }]),
        'Accounts'
      );

      // Sheet 5: Investments
      const invRows = investments.map(i => ({
        'Asset Name': i.asset_name,
        Type:         i.asset_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        Amount:       fmt(i.amount_invested),
        Date:         i.investment_date,
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(invRows.length ? invRows : [{ 'Asset Name': 'No investments', Type: '', Amount: '0.00', Date: '' }]),
        'Investments'
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
      const [transactions, categories, accounts] = await Promise.all([
        getTransactions(filter),
        getAllCategories(),
        getActiveAccounts(),
      ]);

      const catMap: Record<string, string> = {};
      for (const c of categories) catMap[c.id] = c.name;
      const accMap: Record<string, string> = {};
      for (const a of accounts) accMap[a.id] = a.name;

      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
      const header = 'Date,Type,Category,Account,Amount,Description';
      const rows = transactions.map(tx => [
        tx.transaction_date,
        tx.type,
        esc(tx.category_id ? (catMap[tx.category_id] ?? '') : ''),
        esc(accMap[tx.account_id] ?? ''),
        fmt(tx.amount),
        esc(tx.description ?? ''),
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
      const [transactions, categories, savingsGoals] = await Promise.all([
        getTransactions(filter),
        getAllCategories(),
        getAllSavingsGoals(),
      ]);

      const catMap: Record<string, string> = {};
      for (const c of categories) catMap[c.id] = c.name;

      const byMonth: Record<string, { income: number; expenses: number }> = {};
      for (const tx of transactions) {
        if (tx.type === 'transfer') continue;
        const key = tx.transaction_date.slice(0, 7);
        if (!byMonth[key]) byMonth[key] = { income: 0, expenses: 0 };
        if (tx.type === 'income') byMonth[key].income += tx.amount;
        else byMonth[key].expenses += tx.amount;
      }

      const byCat: Record<string, number> = {};
      for (const tx of transactions) {
        if (tx.type !== 'expense' || !tx.category_id) continue;
        const name = catMap[tx.category_id] ?? 'Unknown';
        byCat[name] = (byCat[name] ?? 0) + tx.amount;
      }

      const totalIncome   = Object.values(byMonth).reduce((s, v) => s + v.income, 0);
      const totalExpenses = Object.values(byMonth).reduce((s, v) => s + v.expenses, 0);
      const catEntries    = Object.entries(byCat).sort(([, a], [, b]) => b - a).slice(0, 15);
      const maxCatSpend   = catEntries[0]?.[1] ?? 1;

      const html = buildPDFHtml({
        dateRangeLabel: dateRange === 'custom'
          ? `${MONTHS_SHORT[customMonth - 1]} ${customYear}`
          : DATE_RANGE_LABELS[dateRange],
        currencySymbol,
        byMonth,
        catEntries,
        maxCatSpend,
        totalIncome,
        totalExpenses,
        savingsGoals,
        fmt,
      });

      const result = await RNHTMLtoPDF.convert({
        html,
        fileName: `finio_report_${new Date().toISOString().slice(0, 10)}`,
        base64: false,
        padding: 0,
      });

      if (result.filePath) {
        await Sharing.shareAsync(result.filePath, {
          mimeType:    'application/pdf',
          dialogTitle: 'Export PDF Report',
          UTI:         'com.adobe.pdf',
        });
        showToast('PDF report exported');
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
          <MaterialCommunityIcons name="arrow-left" size={24} color={DS.text.primary} />
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
                    <MaterialCommunityIcons name="download-outline" size={16} color={isGenerating ? DS.text.muted : card.color} />
                    <Text style={[s.exportBtnText, { color: isGenerating ? DS.text.muted : card.color }]}>
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
          <MaterialCommunityIcons name="information-outline" size={14} color={DS.text.muted} />
          <Text style={s.infoText}>Files are written to device cache and opened via the system share sheet.</Text>
        </View>
      </ScrollView>

      {/* Full-screen loading overlay */}
      <Modal transparent animationType="fade" visible={isGenerating}>
        <View style={s.overlay}>
          <View style={s.overlayBox}>
            <ActivityIndicator size="large" color={DS.primary} />
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
                <MaterialCommunityIcons name="minus" size={18} color={DS.text.primary} />
              </TouchableOpacity>
              <Text style={s.stepValue}>{customYear}</Text>
              <TouchableOpacity
                style={s.stepBtn}
                onPress={() => setCustomYear(y => Math.min(y + 1, new Date().getFullYear()))}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="plus" size={18} color={DS.text.primary} />
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

// ── PDF HTML builder ──────────────────────────────────────────────────────────

interface PDFBuildParams {
  dateRangeLabel: string;
  currencySymbol: string;
  byMonth: Record<string, { income: number; expenses: number }>;
  catEntries: [string, number][];
  maxCatSpend: number;
  totalIncome: number;
  totalExpenses: number;
  savingsGoals: any[];
  fmt: (n: number) => string;
}

function buildPDFHtml(d: PDFBuildParams): string {
  const { dateRangeLabel, currencySymbol, byMonth, catEntries, maxCatSpend, totalIncome, totalExpenses, savingsGoals, fmt } = d;
  const net = totalIncome - totalExpenses;

  const monthlyRows = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, s]) => {
      const rowNet = s.income - s.expenses;
      return `<tr>
        <td>${month}</td>
        <td style="color:#10B981">${ currencySymbol }${ fmt(s.income) }</td>
        <td style="color:#F43F5E">${ currencySymbol }${ fmt(s.expenses) }</td>
        <td style="color:${ rowNet >= 0 ? '#10B981' : '#F43F5E' };font-weight:600">${ currencySymbol }${ fmt(Math.abs(rowNet)) } ${ rowNet >= 0 ? '↑' : '↓' }</td>
      </tr>`;
    }).join('');

  const catRows = catEntries.map(([cat, total]) => {
    const pct = Math.round((total / maxCatSpend) * 100);
    return `<tr>
      <td>${ cat }</td>
      <td style="color:#F43F5E">${ currencySymbol }${ fmt(total) }</td>
      <td style="padding-right:16px">
        <div style="background:#e2e8f0;border-radius:4px;height:8px;overflow:hidden;min-width:80px">
          <div style="background:#F43F5E;width:${ pct }%;height:8px;border-radius:4px"></div>
        </div>
      </td>
    </tr>`;
  }).join('');

  const goalRows = savingsGoals.map(g => `<tr>
    <td>${ g.name }</td>
    <td>${ currencySymbol }${ fmt(g.target_amount) }</td>
    <td>${ g.target_date ?? '—' }</td>
    <td style="color:${ g.is_completed ? '#10B981' : '#F59E0B' }">${ g.is_completed ? '✓ Completed' : 'In Progress' }</td>
  </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;background:#fff;color:#1a202c;padding:48px}
    .hdr{border-bottom:3px solid #10B981;padding-bottom:20px;margin-bottom:32px}
    .hdr h1{font-size:30px;color:#10B981;font-weight:700;letter-spacing:-0.5px}
    .hdr .meta{font-size:13px;color:#718096;margin-top:6px}
    .stats{display:flex;gap:16px;margin-bottom:32px}
    .stat{flex:1;background:#f7fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px}
    .stat .lbl{font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#718096;margin-bottom:6px}
    .stat .val{font-size:22px;font-weight:700}
    h2{font-size:17px;font-weight:700;margin:28px 0 12px;padding-bottom:8px;border-bottom:1px solid #e2e8f0}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#10B981;color:#fff;padding:9px 14px;text-align:left;font-weight:600}
    td{padding:8px 14px;border-bottom:1px solid #edf2f7;color:#2d3748}
    tr:nth-child(even) td{background:#f7fafc}
    .empty{color:#a0aec0;font-size:13px;padding:16px 0}
    .footer{margin-top:48px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:11px;color:#a0aec0;text-align:center}
  </style>
</head>
<body>
  <div class="hdr">
    <h1>Finio Financial Report</h1>
    <div class="meta">Period: ${ dateRangeLabel } &nbsp;·&nbsp; Generated: ${ new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) }</div>
  </div>

  <div class="stats">
    <div class="stat"><div class="lbl">Total Income</div><div class="val" style="color:#10B981">${ currencySymbol }${ fmt(totalIncome) }</div></div>
    <div class="stat"><div class="lbl">Total Expenses</div><div class="val" style="color:#F43F5E">${ currencySymbol }${ fmt(totalExpenses) }</div></div>
    <div class="stat"><div class="lbl">Net Savings</div><div class="val" style="color:${ net >= 0 ? '#10B981' : '#F43F5E' }">${ currencySymbol }${ fmt(Math.abs(net)) }</div></div>
  </div>

  <h2>Monthly Summary</h2>
  ${ monthlyRows
      ? `<table><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net Savings</th></tr>${ monthlyRows }</table>`
      : '<p class="empty">No transactions in the selected period.</p>' }

  <h2>Spending by Category</h2>
  ${ catRows
      ? `<table><tr><th>Category</th><th>Amount</th><th>Relative Spend</th></tr>${ catRows }</table>`
      : '<p class="empty">No expense data for the selected period.</p>' }

  <h2>Savings Goals</h2>
  ${ goalRows
      ? `<table><tr><th>Goal</th><th>Target Amount</th><th>Target Date</th><th>Status</th></tr>${ goalRows }</table>`
      : '<p class="empty">No savings goals found.</p>' }

  <div class="footer">Generated by Finio · Personal Finance Tracker</div>
</body>
</html>`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: DS.surface.screen },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: DS.border.subtle,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: DS.surface.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 28,
    letterSpacing: -0.4, color: DS.text.primary, textAlign: 'center',
  },

  scroll:        { flex: 1 },
  scrollContent: { padding: 16, gap: 8 },

  subtitle: {
    fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22,
    color: DS.text.muted, marginBottom: 8,
  },

  sectionLabel: {
    fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 15,
    letterSpacing: 0.8, textTransform: 'uppercase',
    color: DS.text.muted, marginTop: 8, marginBottom: 6, marginLeft: 2,
  },

  // Date range chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: DS.radius.full,
    borderWidth: 1.5, borderColor: DS.border.subtle,
    backgroundColor: DS.surface.elevated,
  },
  chipActive:     { borderColor: DS.primary, backgroundColor: hexToRgba(DS.primary, 0.12) },
  chipText:       { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, color: DS.text.secondary },
  chipTextActive: { color: DS.primaryLight },

  // Export cards
  exportCard: { marginBottom: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  cardIconWrap: {
    width: 52, height: 52, borderRadius: DS.radius.lg,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cardMeta: { flex: 1, gap: 4 },
  cardTitle: {
    fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22,
    color: DS.text.primary,
  },
  cardDesc: {
    fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19,
    color: DS.text.muted,
  },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 44, borderRadius: DS.radius.md,
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
    color: DS.text.muted,
  },

  // Loading overlay
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  overlayBox: {
    backgroundColor: DS.surface.card,
    borderRadius: DS.radius.xl,
    padding: 32, alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: DS.border.subtle,
    minWidth: 200,
    ...DS.shadow.modal,
  },
  overlayText: {
    fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22,
    color: DS.text.primary,
  },
  overlayHint: {
    fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18,
    color: DS.text.muted,
  },

  // Toast
  toast: {
    position: 'absolute', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1A3C30',
    borderWidth: 1, borderColor: hexToRgba(DS.primary, 0.4),
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: DS.radius.full,
  },
  toastText: {
    fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20,
    color: DS.primaryLight,
  },

  // Custom period picker
  pickerBody: { padding: 20, paddingTop: 8, gap: 6 },
  stepperRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 8,
  },
  stepperLabel: {
    fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 15,
    letterSpacing: 0.8, textTransform: 'uppercase', color: DS.text.muted,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  stepBtn: {
    width: 38, height: 38, borderRadius: DS.radius.md,
    backgroundColor: DS.surface.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
  stepValue: {
    fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 24,
    color: DS.text.primary, width: 68, textAlign: 'center',
  },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  monthChip: {
    width: '22%', paddingVertical: 8, borderRadius: DS.radius.md,
    backgroundColor: DS.surface.elevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  monthChipActive:     { borderColor: DS.primary, backgroundColor: hexToRgba(DS.primary, 0.12) },
  monthChipText:       { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, color: DS.text.secondary },
  monthChipTextActive: { color: DS.primaryLight, fontFamily: 'Inter_600SemiBold' },
  applyBtn: {
    height: 52, borderRadius: DS.radius.lg,
    backgroundColor: DS.primary, alignItems: 'center', justifyContent: 'center',
  },
  applyBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15, lineHeight: 20, color: '#fff' },
});
