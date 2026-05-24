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
import { getTransactionsPaginated, getMonthlySummary } from '../db/queries';
import TransactionListItem from '../components/TransactionListItem';
import BottomSheet from '../components/BottomSheet';
import EmptyState from '../components/EmptyState';

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type TypeFilter = 'all' | 'income' | 'expense';

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
  year: number, month: number,
  typeFilter: TypeFilter, search: string
): TransactionFilter {
  const pad = String(month).padStart(2, '0');
  const f: TransactionFilter = {
    start_date: `${year}-${pad}-01`,
    end_date:   `${year}-${pad}-31`,
  };
  if (typeFilter !== 'all') f.type = typeFilter;
  if (search)               f.search = search;
  return f;
}

function formatPaise(paise: number, symbol: string): string {
  return `${symbol}${(Math.abs(paise) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

// ── Month picker sheet ────────────────────────────────────────────────────────

interface MonthPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
  ds: DSType;
  styles: ReturnType<typeof makeStyles>;
}

function MonthPickerSheet({ visible, onClose, year, month, onChange, ds, styles }: MonthPickerSheetProps) {
  const [ly, setLy] = useState(year);
  const [lm, setLm] = useState(month);
  const now = new Date();
  const isAtNow = ly === now.getFullYear() && lm === now.getMonth() + 1;

  useEffect(() => { if (visible) { setLy(year); setLm(month); } }, [visible, year, month]);

  const step = (delta: number) => {
    let nm = lm + delta;
    let ny = ly;
    if (nm > 12) { nm = 1; ny++; }
    if (nm < 1)  { nm = 12; ny--; }
    if (ny > now.getFullYear() || (ny === now.getFullYear() && nm > now.getMonth() + 1)) return;
    setLy(ny); setLm(nm);
  };

  const confirm = () => { onChange(ly, lm); onClose(); };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select Month">
      <View style={styles.pickerBody}>
        <View style={styles.pickerRow}>
          <TouchableOpacity style={styles.pickerArrow} onPress={() => step(-1)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={ds.text.secondary} />
          </TouchableOpacity>
          <Text style={styles.pickerLabel}>{MONTH_NAMES[lm - 1]} {ly}</Text>
          <TouchableOpacity
            style={styles.pickerArrow} onPress={() => step(1)}
            disabled={isAtNow} activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="chevron-right" size={26}
              color={isAtNow ? ds.text.muted : ds.text.secondary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.pickerConfirmBtn} onPress={confirm} activeOpacity={0.85}>
          <Text style={styles.pickerConfirmText}>Show {MONTH_NAMES[lm - 1]} {ly}</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

// ── Monthly summary footer ────────────────────────────────────────────────────

interface SummaryBarProps {
  income: number;
  expenses: number;
  net: number;
  year: number;
  month: number;
  currencySymbol: string;
  ds: DSType;
  styles: ReturnType<typeof makeStyles>;
}

function SummaryBar({ income, expenses, net, year, month, currencySymbol, ds, styles }: SummaryBarProps) {
  const isPositive = net >= 0;
  return (
    <View style={styles.summaryContainer}>
      <Text style={styles.summaryPeriod}>{MONTH_NAMES[month - 1]} {year}</Text>
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

  const { getCategoryById, loadFromDB: loadCats } = useCategoriesStore();
  const { accounts, loadFromDB: loadAccounts }     = useAccountsStore();
  const { deleteTransaction }                      = useTransactionsStore();
  const { currencySymbol }                         = useSettingsStore();

  // ── Filter state ──────────────────────────────────────────────────────────

  const now = new Date();
  const [year,        setYear]        = useState(now.getFullYear());
  const [month,       setMonth]       = useState(now.getMonth() + 1);
  const [typeFilter,  setTypeFilter]  = useState<TypeFilter>('all');
  const [search,      setSearch]      = useState('');
  const [debSearch,   setDebSearch]   = useState('');

  // ── Data state ────────────────────────────────────────────────────────────

  const [items,          setItems]          = useState<Transaction[]>([]);
  const [hasMore,        setHasMore]        = useState(false);
  const [isLoading,      setIsLoading]      = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [monthSummary,   setMonthSummary]   = useState({ income: 0, expenses: 0, net: 0 });
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  // Stable refs for loadMore closure
  const hasMoreRef        = useRef(false);
  const isFetchingMoreRef = useRef(false);
  const filterRef         = useRef<TransactionFilter>({});
  const itemCountRef      = useRef(0);

  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { itemCountRef.current = items.length; }, [items]);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => { loadCats(); loadAccounts(); }, [loadCats, loadAccounts]);

  // Reload list when returning from AddTransaction (new/edited tx)
  useFocusEffect(useCallback(() => {
    triggerLoad(year, month, typeFilter, debSearch);
  }, [year, month, typeFilter, debSearch]));

  // ── Search debounce ───────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── Load when any filter changes ──────────────────────────────────────────

  useEffect(() => {
    triggerLoad(year, month, typeFilter, debSearch);
  }, [year, month, typeFilter, debSearch]);

  // ── Load helpers ──────────────────────────────────────────────────────────

  const triggerLoad = useCallback(async (
    y: number, mo: number, tf: TypeFilter, s: string
  ) => {
    const f = buildFilter(y, mo, tf, s);
    filterRef.current = f;
    setIsLoading(true);
    setItems([]);
    setHasMore(false);
    try {
      const [txs, summary] = await Promise.all([
        getTransactionsPaginated(f, PAGE_SIZE, 0),
        getMonthlySummary(y, mo),
      ]);
      setItems(txs);
      hasMoreRef.current = txs.length === PAGE_SIZE;
      setHasMore(txs.length === PAGE_SIZE);
      setMonthSummary(summary);
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
            // Refresh summary
            getMonthlySummary(year, month).then(setMonthSummary).catch(() => {});
          },
        },
      ]
    );
  }, [deleteTransaction, year, month]);

  const handleMonthChange = useCallback((y: number, m: number) => {
    setYear(y); setMonth(m); setTypeFilter('all'); setSearch('');
  }, []);

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
    const meta = [cat?.name, acct].filter(Boolean).join('  ·  ');
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

  // ── Header component (search + chips) ────────────────────────────────────

  const ListHeader = (
    <View style={styles.listHeader}>
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

      {/* Filter chips */}
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
              onPress={() => setTypeFilter(f)}
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
    </View>
  );

  // ── Footer component (summary + load more) ────────────────────────────────

  const ListFooter = (
    <View>
      {isFetchingMore && (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color={ds.primary} />
        </View>
      )}
      {!hasMore && items.length > 0 && (
        <SummaryBar
          income={monthSummary.income}
          expenses={monthSummary.expenses}
          net={monthSummary.net}
          year={year}
          month={month}
          currencySymbol={currencySymbol}
          ds={ds}
          styles={styles}
        />
      )}
      <View style={{ height: insets.bottom + 80 }} />
    </View>
  );

  // ── Empty component ───────────────────────────────────────────────────────

  const ListEmpty = !isLoading ? (
    <EmptyState
      icon={search ? 'text-search' : 'receipt-text-outline'}
      title={search ? 'No results found' : 'No transactions'}
      subtitle={
        search
          ? `Nothing matches "${search}". Try different keywords.`
          : `No ${typeFilter === 'all' ? '' : typeFilter + ' '}transactions in ${MONTH_NAMES[month - 1]} ${year}.`
      }
    />
  ) : (
    <View style={styles.loadingCenter}>
      <ActivityIndicator size="large" color={ds.primary} />
    </View>
  );

  // ── Screen ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <BrandHeader
        right={
          <TouchableOpacity
            style={styles.monthBtn}
            onPress={() => setMonthPickerOpen(true)}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name="calendar-month-outline" size={16} color={ds.primaryLight} />
            <Text style={styles.monthBtnText}>{MONTH_NAMES[month - 1]} {year}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color={ds.primaryLight} />
          </TouchableOpacity>
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
            refreshing={isLoading}
            onRefresh={() => triggerLoad(year, month, typeFilter, debSearch)}
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
        styles={styles}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: ds.surface.screen },

    // Top bar
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: ds.border.subtle,
    },
    title: {
      fontFamily: 'Inter_700Bold',
      fontSize: 24, lineHeight: 32, letterSpacing: -0.48,
      color: ds.text.primary,
    },
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

    // Month picker sheet (formerly `ps`)
    pickerBody: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 },
    pickerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    pickerArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    pickerLabel: {
      flex: 1, textAlign: 'center',
      fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 28,
      letterSpacing: -0.44, color: ds.text.primary,
    },
    pickerConfirmBtn: {
      height: 52, borderRadius: ds.radius.md, backgroundColor: ds.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    pickerConfirmText: {
      fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: '#fff',
    },

    // Summary bar (formerly `sb`)
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
