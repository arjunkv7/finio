import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BrandHeader from '../components/BrandHeader';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';
import { hexToRgba } from '../utils/color';
import { useCategoriesStore } from '../store/categoriesStore';
import { useAccountsStore } from '../store/accountsStore';
import { useTransactionsStore } from '../store/transactionsStore';
import { useSettingsStore } from '../store/settingsStore';
import { Transaction, TransactionFilter } from '../types';
import {
  getTransactionsPaginated,
  getFilteredSummary,
  getDistinctExpenseTags,
} from '../db/queries';
import TransactionListItem from '../components/TransactionListItem';
import EmptyState from '../components/EmptyState';
import MonthPickerSheet from '../components/MonthPickerSheet';
import BottomSheet from '../components/BottomSheet';

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type TypeFilter = 'all' | 'income' | 'expense';
type DateMode = 'month' | 'custom';

// ── List item types ───────────────────────────────────────────────────────────

type ListItem =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'tx';     key: string; tx: Transaction };

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateGroupLabel(dateStr: string): string {
  const today     = toLocalDateStr(new Date());
  const yd        = new Date(); yd.setDate(yd.getDate() - 1);
  const yesterday = toLocalDateStr(yd);
  if (dateStr === today)     return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const thisYear = new Date().getFullYear();
  return dt.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
    ...(y !== thisYear && { year: 'numeric' }),
  });
}

function buildFilter(
  dateMode: DateMode,
  year: number,
  month: number,
  customStart: string,
  customEnd: string,
  typeFilter: TypeFilter,
  categoryFilter: string | null,
  tagFilter: string | null,
  search: string,
): TransactionFilter {
  const f: TransactionFilter = {};

  if (dateMode === 'month') {
    const pad = String(month).padStart(2, '0');
    f.start_date = `${year}-${pad}-01`;
    f.end_date   = `${year}-${pad}-31`;
  } else {
    if (customStart) f.start_date = customStart;
    if (customEnd)   f.end_date   = customEnd;
  }

  if (typeFilter !== 'all')   f.type        = typeFilter;
  if (categoryFilter)         f.category_id = categoryFilter;
  if (tagFilter)              f.tag         = tagFilter;
  if (search)                 f.search      = search;
  return f;
}

function formatPaise(paise: number, symbol: string): string {
  return `${symbol}${(Math.abs(paise) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

function shortDateStr(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ── Custom date range picker sheet ────────────────────────────────────────────

interface DateRangeSheetProps {
  visible: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  onApply: (start: string, end: string) => void;
  ds: DSType;
}

const CAL_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function generateCalDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const days: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= lastDate; d++) days.push(new Date(year, month, d));
  return days;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function DateRangeSheet({ visible, onClose, startDate, endDate, onApply, ds }: DateRangeSheetProps) {
  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selStart, setSelStart] = useState<Date | null>(null);
  const [selEnd,   setSelEnd]   = useState<Date | null>(null);
  const [picking,  setPicking]  = useState<'start' | 'end'>('start');

  useEffect(() => {
    if (visible) {
      const now = new Date();
      setCalYear(now.getFullYear());
      setCalMonth(now.getMonth());
      setSelStart(startDate ? (() => { const [y,m,d] = startDate.split('-').map(Number); return new Date(y,m-1,d); })() : null);
      setSelEnd(endDate ? (() => { const [y,m,d] = endDate.split('-').map(Number); return new Date(y,m-1,d); })() : null);
      setPicking('start');
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const calDays = useMemo(() => generateCalDays(calYear, calMonth), [calYear, calMonth]);
  const calRows = useMemo(() => {
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < calDays.length; i += 7) {
      const row = calDays.slice(i, i + 7);
      while (row.length < 7) row.push(null);
      rows.push(row);
    }
    return rows;
  }, [calDays]);

  const shiftMonth = (delta: number) => {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCalYear(y); setCalMonth(m);
  };

  const tapDay = (d: Date) => {
    if (picking === 'start') {
      setSelStart(d);
      setSelEnd(null);
      setPicking('end');
    } else {
      if (selStart && d < selStart) {
        setSelStart(d); setSelEnd(selStart); setPicking('start');
      } else {
        setSelEnd(d); setPicking('start');
      }
    }
  };

  const inRange = (d: Date) => selStart && selEnd && d > selStart && d < selEnd;
  const isStart = (d: Date) => !!(selStart && isSameDay(d, selStart));
  const isEnd   = (d: Date) => !!(selEnd && isSameDay(d, selEnd));

  const canApply = selStart !== null && selEnd !== null;

  const apply = () => {
    if (!canApply) return;
    onApply(toLocalDateStr(selStart!), toLocalDateStr(selEnd!));
    onClose();
  };

  const DOW = ['M','T','W','T','F','S','S'];
  const accent = ds.primary;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Custom Date Range">
      <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>

        {/* Picking indicator */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          {(['start', 'end'] as const).map(which => {
            const val = which === 'start' ? selStart : selEnd;
            const isActive = picking === which;
            return (
              <TouchableOpacity
                key={which}
                style={{
                  flex: 1, height: 44, borderRadius: 10,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: isActive ? accent : ds.border.subtle,
                  backgroundColor: isActive ? hexToRgba(accent, 0.1) : ds.surface.elevated,
                }}
                onPress={() => setPicking(which)}
                activeOpacity={0.75}
              >
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: ds.text.muted, marginBottom: 2 }}>
                  {which === 'start' ? 'FROM' : 'TO'}
                </Text>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: val ? ds.text.primary : ds.text.muted }}>
                  {val ? shortDateStr(toLocalDateStr(val)) : 'Select'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Month nav */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <TouchableOpacity style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => shiftMonth(-1)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={ds.text.secondary} />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontFamily: 'Inter_700Bold', fontSize: 16, color: ds.text.primary }}>
            {CAL_MONTHS[calMonth]} {calYear}
          </Text>
          <TouchableOpacity style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => shiftMonth(1)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-right" size={24} color={ds.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* DOW header */}
        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          {DOW.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: ds.text.muted }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        {calRows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', marginBottom: 2 }}>
            {row.map((d, ci) => {
              if (!d) return <View key={ci} style={{ flex: 1 }} />;
              const started = isStart(d);
              const ended   = isEnd(d);
              const inR     = inRange(d);
              const highlighted = started || ended;
              return (
                <TouchableOpacity
                  key={ci}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 2,
                    backgroundColor: inR ? hexToRgba(accent, 0.12) : 'transparent' }}
                  onPress={() => tapDay(d)}
                  activeOpacity={0.7}
                >
                  <View style={{
                    width: 34, height: 34, borderRadius: 17,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: highlighted ? accent : 'transparent',
                  }}>
                    <Text style={{
                      fontFamily: highlighted ? 'Inter_700Bold' : 'Inter_400Regular',
                      fontSize: 14,
                      color: highlighted ? '#fff' : ds.text.primary,
                    }}>
                      {d.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <TouchableOpacity
          style={{
            height: 52, borderRadius: 12, backgroundColor: canApply ? accent : ds.surface.elevated,
            alignItems: 'center', justifyContent: 'center', marginTop: 16,
            borderWidth: canApply ? 0 : 1, borderColor: ds.border.subtle,
          }}
          onPress={apply}
          disabled={!canApply}
          activeOpacity={0.85}
        >
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: canApply ? '#fff' : ds.text.muted }}>
            Apply Range
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </BottomSheet>
  );
}

// ── Monthly summary footer ────────────────────────────────────────────────────

interface SummaryBarProps {
  income: number;
  expenses: number;
  net: number;
  label: string;
  currencySymbol: string;
  ds: DSType;
  styles: ReturnType<typeof makeStyles>;
}

function SummaryBar({ income, expenses, net, label, currencySymbol, ds, styles }: SummaryBarProps) {
  const isPositive = net >= 0;
  return (
    <View style={styles.summaryContainer}>
      <Text style={styles.summaryPeriod}>{label}</Text>
      <View style={styles.summaryRow}>
        <View style={styles.summaryStat}>
          <View style={[styles.summaryDot, { backgroundColor: ds.primary }]} />
          <View>
            <Text style={styles.summaryStatLabel}>Income</Text>
            <Text style={[styles.summaryStatValue, { color: ds.primaryLight }]}>
              {formatPaise(income, currencySymbol)}
            </Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStat}>
          <View style={[styles.summaryDot, { backgroundColor: ds.secondary }]} />
          <View>
            <Text style={styles.summaryStatLabel}>Expenses</Text>
            <Text style={[styles.summaryStatValue, { color: ds.secondaryLight }]}>
              {formatPaise(expenses, currencySymbol)}
            </Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStat}>
          <View style={[styles.summaryDot, { backgroundColor: isPositive ? ds.primary : ds.secondary }]} />
          <View>
            <Text style={styles.summaryStatLabel}>Net</Text>
            <Text style={[styles.summaryStatValue, { color: isPositive ? ds.primaryLight : ds.secondaryLight }]}>
              {net < 0 ? '−' : '+'}{formatPaise(Math.abs(net), currencySymbol)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const ds       = useDS();
  const styles   = useMemo(() => makeStyles(ds), [ds]);
  const navigation  = useNavigation<any>();
  const insets      = useSafeAreaInsets();

  const { getCategoryById, incomeCategories, expenseCategories, loadFromDB: loadCats } = useCategoriesStore();
  const { accounts, loadFromDB: loadAccounts }     = useAccountsStore();
  const { deleteTransaction }                      = useTransactionsStore();
  const { currencySymbol }                         = useSettingsStore();

  // ── Filter state ──────────────────────────────────────────────────────────

  const now = new Date();
  const [dateMode,       setDateMode]       = useState<DateMode>('month');
  const [year,           setYear]           = useState(now.getFullYear());
  const [month,          setMonth]          = useState(now.getMonth() + 1);
  const [customStart,    setCustomStart]    = useState('');
  const [customEnd,      setCustomEnd]      = useState('');
  const [typeFilter,     setTypeFilter]     = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [tagFilter,      setTagFilter]      = useState<string | null>(null);
  const [availableTags,  setAvailableTags]  = useState<string[]>([]);
  const [search,         setSearch]         = useState('');
  const [debSearch,      setDebSearch]      = useState('');

  // ── Data state ────────────────────────────────────────────────────────────

  const [items,          setItems]          = useState<Transaction[]>([]);
  const [hasMore,        setHasMore]        = useState(false);
  const [isLoading,        setIsLoading]        = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [isFetchingMore,   setIsFetchingMore]   = useState(false);
  const [summary,        setSummary]        = useState({ income: 0, expenses: 0, net: 0 });
  const [monthPickerOpen,    setMonthPickerOpen]    = useState(false);
  const [dateRangeOpen,      setDateRangeOpen]      = useState(false);

  // Stable refs for loadMore closure
  const hasMoreRef        = useRef(false);
  const isFetchingMoreRef = useRef(false);
  const filterRef         = useRef<TransactionFilter>({});
  const itemCountRef      = useRef(0);

  const dateModRef       = useRef(dateMode);
  const yearRef          = useRef(year);
  const monthRef         = useRef(month);
  const customStartRef   = useRef(customStart);
  const customEndRef     = useRef(customEnd);
  const typeFilterRef    = useRef(typeFilter);
  const categoryFilterRef = useRef(categoryFilter);
  const tagFilterRef     = useRef(tagFilter);
  const debSearchRef     = useRef(debSearch);
  useEffect(() => { dateModRef.current       = dateMode;       }, [dateMode]);
  useEffect(() => { yearRef.current          = year;           }, [year]);
  useEffect(() => { monthRef.current         = month;          }, [month]);
  useEffect(() => { customStartRef.current   = customStart;    }, [customStart]);
  useEffect(() => { customEndRef.current     = customEnd;      }, [customEnd]);
  useEffect(() => { typeFilterRef.current    = typeFilter;     }, [typeFilter]);
  useEffect(() => { categoryFilterRef.current = categoryFilter; }, [categoryFilter]);
  useEffect(() => { tagFilterRef.current     = tagFilter;      }, [tagFilter]);
  useEffect(() => { debSearchRef.current     = debSearch;      }, [debSearch]);

  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { itemCountRef.current = items.length; }, [items]);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => { loadCats(); loadAccounts(); }, [loadCats, loadAccounts]);

  // Reload on focus
  useFocusEffect(useCallback(() => {
    triggerLoad(
      dateModRef.current, yearRef.current, monthRef.current,
      customStartRef.current, customEndRef.current,
      typeFilterRef.current, categoryFilterRef.current,
      tagFilterRef.current, debSearchRef.current, false,
    );
    getDistinctExpenseTags().then(setAvailableTags).catch(() => {});
  }, []));

  // ── Search debounce ───────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── Load when any filter changes ──────────────────────────────────────────

  const prevDateKeyRef = useRef<string>(`${dateMode}-${year}-${month}-${customStart}-${customEnd}`);

  useEffect(() => {
    const dateKey = `${dateMode}-${year}-${month}-${customStart}-${customEnd}`;
    const dateChanged = prevDateKeyRef.current !== dateKey;
    prevDateKeyRef.current = dateKey;
    triggerLoad(dateMode, year, month, customStart, customEnd, typeFilter, categoryFilter, tagFilter, debSearch, dateChanged);
  }, [dateMode, year, month, customStart, customEnd, typeFilter, categoryFilter, tagFilter, debSearch]);

  // ── Load helpers ──────────────────────────────────────────────────────────

  const triggerLoad = useCallback(async (
    dm: DateMode, y: number, mo: number,
    cs: string, ce: string,
    tf: TypeFilter, cf: string | null, tgf: string | null,
    s: string, clearFirst = false,
  ) => {
    const f = buildFilter(dm, y, mo, cs, ce, tf, cf, tgf, s);
    filterRef.current = f;
    setIsLoading(true);
    if (clearFirst) { setItems([]); setHasMore(false); }
    try {
      const [txs, sum] = await Promise.all([
        getTransactionsPaginated(f, PAGE_SIZE, 0),
        getFilteredSummary(f),
      ]);
      setItems(txs);
      hasMoreRef.current = txs.length === PAGE_SIZE;
      setHasMore(txs.length === PAGE_SIZE);
      setSummary(sum);
    } catch (e) { console.warn('[History] load error', e); }
    finally { setIsLoading(false); }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMoreRef.current || isFetchingMoreRef.current) return;
    isFetchingMoreRef.current = true;
    setIsFetchingMore(true);
    try {
      const txs = await getTransactionsPaginated(filterRef.current, PAGE_SIZE, itemCountRef.current);
      setItems(prev => [...prev, ...txs]);
      hasMoreRef.current = txs.length === PAGE_SIZE;
      setHasMore(txs.length === PAGE_SIZE);
    } catch (e) { console.warn('[History] loadMore error', e); }
    finally { isFetchingMoreRef.current = false; setIsFetchingMore(false); }
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleEdit = useCallback((tx: Transaction) => {
    navigation.navigate('AddTransaction', { editTx: tx });
  }, [navigation]);

  const handleDelete = useCallback((tx: Transaction) => {
    Alert.alert(
      'Delete Transaction',
      'This will permanently remove this transaction. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await deleteTransaction(tx.id);
            setItems(prev => prev.filter(t => t.id !== tx.id));
            getFilteredSummary(filterRef.current).then(setSummary).catch(() => {});
          },
        },
      ]
    );
  }, [deleteTransaction]);

  const handleMonthChange = useCallback((y: number, m: number) => {
    setDateMode('month');
    setYear(y); setMonth(m);
    setTypeFilter('all'); setCategoryFilter(null); setTagFilter(null); setSearch('');
  }, []);

  const handleCustomRange = useCallback((start: string, end: string) => {
    setDateMode('custom');
    setCustomStart(start); setCustomEnd(end);
    setTypeFilter('all'); setCategoryFilter(null); setTagFilter(null); setSearch('');
  }, []);

  // When type filter changes, reset dependent filters
  const handleTypeFilter = useCallback((tf: TypeFilter) => {
    setTypeFilter(tf);
    setCategoryFilter(null);
    setTagFilter(null);
  }, []);

  // ── Derived category list for filter ─────────────────────────────────────

  const filterCategories = useMemo(() => {
    if (typeFilter === 'income') return incomeCategories;
    if (typeFilter === 'expense') return expenseCategories;
    return [];
  }, [typeFilter, incomeCategories, expenseCategories]);

  // ── Summary bar label ─────────────────────────────────────────────────────

  const summaryLabel = useMemo(() => {
    if (dateMode === 'custom' && customStart && customEnd) {
      return `${shortDateStr(customStart)} – ${shortDateStr(customEnd)}`;
    }
    return `${MONTH_NAMES[month - 1]} ${year}`;
  }, [dateMode, customStart, customEnd, month, year]);

  // ── Grouped list data ─────────────────────────────────────────────────────

  const listData = useMemo<ListItem[]>(() => {
    const out: ListItem[] = [];
    let lastDate: string | null = null;
    for (const tx of items) {
      if (tx.transaction_date !== lastDate) {
        out.push({ kind: 'header', key: `h_${tx.transaction_date}`, label: dateGroupLabel(tx.transaction_date) });
        lastDate = tx.transaction_date;
      }
      out.push({ kind: 'tx', key: tx.id, tx });
    }
    return out;
  }, [items]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const accountName = useCallback((accountId: string | null) => {
    if (!accountId) return '';
    return accounts.find(a => a.id === accountId)?.name ?? '';
  }, [accounts]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.kind === 'header') {
      return (
        <View style={styles.dateHeader}>
          <Text style={styles.dateHeaderText}>{item.label}</Text>
        </View>
      );
    }
    const tx  = item.tx;
    const cat = tx.category_id ? getCategoryById(tx.category_id) : null;
    const acct = accountName(tx.account_id);
    const metaParts = [cat?.name, acct].filter(Boolean);
    if (tx.tag) metaParts.push(`#${tx.tag}`);
    const meta = metaParts.join('  ·  ');
    return (
      <TransactionListItem
        icon={(cat?.icon ?? 'cash-multiple') as any}
        iconColor={cat?.color ?? ds.text.muted}
        name={tx.description ?? cat?.name ?? (tx.type === 'income' ? 'Income' : tx.type === 'transfer' ? 'Transfer' : 'Expense')}
        category={meta || tx.type}
        date={''}
        amount={tx.amount}
        type={tx.type}
        onEdit={() => handleEdit(tx)}
        onDelete={() => handleDelete(tx)}
      />
    );
  }, [getCategoryById, accountName, handleEdit, handleDelete, ds, styles]);

  // ── Header component ──────────────────────────────────────────────────────

  const ListHeader = useMemo(() => (
    <View style={styles.listHeader}>
      {/* Summary */}
      <SummaryBar
        income={summary.income}
        expenses={summary.expenses}
        net={summary.net}
        label={summaryLabel}
        currencySymbol={currencySymbol}
        ds={ds}
        styles={styles}
      />

      {/* Search */}
      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={20} color={ds.text.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search transactions…"
          placeholderTextColor={ds.text.muted}
          selectionColor={ds.primary}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close-circle" size={18} color={ds.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Type filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {(['all', 'income', 'expense'] as TypeFilter[]).map((f) => {
          const active = typeFilter === f;
          const chipColor = f === 'income' ? ds.primary : f === 'expense' ? ds.secondary : ds.text.secondary;
          const label = f === 'all' ? 'All' : f === 'income' ? 'Income' : 'Expenses';
          return (
            <TouchableOpacity
              key={f}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: hexToRgba(chipColor, 0.18), borderColor: chipColor }
                  : { borderColor: ds.border.subtle },
              ]}
              onPress={() => handleTypeFilter(f)}
              activeOpacity={0.75}
            >
              {f !== 'all' && (
                <MaterialCommunityIcons
                  name={f === 'income' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                  size={14}
                  color={active ? chipColor : ds.text.muted}
                />
              )}
              <Text style={[styles.chipText, active && { color: chipColor }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Category filter chips (shown when type is income or expense) */}
      {filterCategories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {filterCategories.map(cat => {
            const active = categoryFilter === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.chip,
                  active
                    ? { backgroundColor: hexToRgba(cat.color, 0.18), borderColor: cat.color }
                    : { borderColor: ds.border.subtle },
                ]}
                onPress={() => setCategoryFilter(active ? null : cat.id)}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons
                  name={cat.icon as any}
                  size={14}
                  color={active ? cat.color : ds.text.muted}
                />
                <Text style={[styles.chipText, active && { color: cat.color }]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Tag filter chips (expense only) */}
      {typeFilter === 'expense' && availableTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {availableTags.map(t => {
            const active = tagFilter === t;
            return (
              <TouchableOpacity
                key={t}
                style={[
                  styles.chip,
                  active
                    ? { backgroundColor: hexToRgba(ds.secondary, 0.18), borderColor: ds.secondary }
                    : { borderColor: ds.border.subtle },
                ]}
                onPress={() => setTagFilter(active ? null : t)}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name="tag-outline" size={14} color={active ? ds.secondary : ds.text.muted} />
                <Text style={[styles.chipText, active && { color: ds.secondaryLight }]}>#{t}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [isLoading, items.length, summary, summaryLabel, currencySymbol, search, typeFilter, categoryFilter, tagFilter, filterCategories, availableTags, ds, styles]);

  // ── Footer component ──────────────────────────────────────────────────────

  const ListFooter = useMemo(() => (
    <View>
      {isFetchingMore && (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color={ds.primary} />
        </View>
      )}
      <View style={{ height: insets.bottom + 80 }} />
    </View>
  ), [isFetchingMore, insets.bottom, ds.primary, styles]);

  // ── Empty component ───────────────────────────────────────────────────────

  const ListEmpty = useMemo(() => !isLoading ? (
    <EmptyState
      icon={search ? 'text-search' : 'receipt-text-outline'}
      title={search ? 'No results found' : 'No transactions'}
      subtitle={
        search
          ? `Nothing matches "${search}". Try different keywords.`
          : `No ${typeFilter === 'all' ? '' : typeFilter + ' '}transactions for this period.`
      }
    />
  ) : (
    <View style={styles.loadingCenter}>
      <ActivityIndicator size="large" color={ds.primary} />
    </View>
  ), [isLoading, search, typeFilter, styles, ds]);

  // ── Date button label ─────────────────────────────────────────────────────

  const dateBtnLabel = useMemo(() => {
    if (dateMode === 'custom' && customStart && customEnd) {
      return `${shortDateStr(customStart)} – ${shortDateStr(customEnd)}`;
    }
    return `${MONTH_NAMES[month - 1]} ${year}`;
  }, [dateMode, customStart, customEnd, month, year]);

  // ── Screen ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <BrandHeader
        right={
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.monthBtn}
              onPress={() => setMonthPickerOpen(true)}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="calendar-month-outline" size={16} color={ds.primaryLight} />
              <Text style={styles.monthBtnText}>{dateBtnLabel}</Text>
              <MaterialCommunityIcons name="chevron-down" size={16} color={ds.primaryLight} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rangeBtn}
              onPress={() => setDateRangeOpen(true)}
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons
                name="calendar-range"
                size={18}
                color={dateMode === 'custom' ? ds.primaryLight : ds.text.muted}
              />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Main list */}
      <FlatList<ListItem>
        data={listData}
        keyExtractor={item => item.key}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={ListEmpty}
        onEndReached={loadMore}
        onEndReachedThreshold={0.25}
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={async () => {
              setIsPullRefreshing(true);
              await triggerLoad(
                dateMode, year, month, customStart, customEnd,
                typeFilter, categoryFilter, tagFilter, debSearch, true,
              );
              setIsPullRefreshing(false);
            }}
            tintColor={ds.primary}
            colors={[ds.primary]}
          />
        }
        contentContainerStyle={items.length === 0 && !isLoading ? { flex: 1 } : undefined}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      {/* Month picker */}
      <MonthPickerSheet
        visible={monthPickerOpen}
        onClose={() => setMonthPickerOpen(false)}
        year={year}
        month={month}
        onChange={handleMonthChange}
        ds={ds}
      />

      {/* Custom date range picker */}
      <DateRangeSheet
        visible={dateRangeOpen}
        onClose={() => setDateRangeOpen(false)}
        startDate={customStart}
        endDate={customEnd}
        onApply={handleCustomRange}
        ds={ds}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: ds.surface.screen },

    // Top bar
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    monthBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: ds.radius.full,
      backgroundColor: hexToRgba(ds.primary, 0.12),
      borderWidth: 1,
      borderColor: hexToRgba(ds.primary, 0.3),
    },
    monthBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13, lineHeight: 18,
      color: ds.primaryLight,
    },
    rangeBtn: {
      width: 32, height: 32,
      alignItems: 'center', justifyContent: 'center',
      borderRadius: ds.radius.full,
    },

    // List header (search + chips)
    listHeader: { paddingTop: 12, paddingBottom: 4 },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      paddingHorizontal: 12,
      height: 44,
      borderRadius: ds.radius.lg,
      backgroundColor: ds.surface.elevated,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      marginBottom: 12,
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
      flex: 1,
      fontFamily: 'Inter_400Regular',
      fontSize: 15, lineHeight: 20,
      color: ds.text.primary,
      padding: 0,
    },

    // Filter chips
    chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: ds.radius.full,
      backgroundColor: ds.surface.elevated,
      borderWidth: 1.5,
    },
    chipText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13, lineHeight: 18,
      color: ds.text.muted,
    },

    // Date group header
    dateHeader: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 6,
    },
    dateHeaderText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12, lineHeight: 16,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: ds.text.muted,
    },

    // Loading states
    loadingMore: { paddingVertical: 20, alignItems: 'center' },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },

    // Summary bar
    summaryContainer: {
      margin: 16,
      padding: 16,
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.xl,
      borderWidth: 1,
      borderColor: ds.border.subtle,
    },
    summaryPeriod: {
      fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18,
      letterSpacing: 0.6, textTransform: 'uppercase', color: ds.text.muted,
      marginBottom: 12,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center' },
    summaryStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    summaryDot: { width: 8, height: 8, borderRadius: 4 },
    summaryStatLabel: {
      fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 14, color: ds.text.muted,
      marginBottom: 2,
    },
    summaryStatValue: {
      fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18,
    },
    summaryDivider: { width: 1, height: 36, backgroundColor: ds.border.subtle, marginHorizontal: 8 },
  });
}
