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
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { DS } from '../constants';
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
}

function MonthPickerSheet({ visible, onClose, year, month, onChange }: MonthPickerSheetProps) {
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
      <View style={ps.body}>
        <View style={ps.row}>
          <TouchableOpacity style={ps.arrow} onPress={() => step(-1)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={DS.text.secondary} />
          </TouchableOpacity>
          <Text style={ps.label}>{MONTH_NAMES[lm - 1]} {ly}</Text>
          <TouchableOpacity
            style={ps.arrow} onPress={() => step(1)}
            disabled={isAtNow} activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="chevron-right" size={26}
              color={isAtNow ? DS.text.muted : DS.text.secondary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={ps.confirmBtn} onPress={confirm} activeOpacity={0.85}>
          <Text style={ps.confirmText}>Show {MONTH_NAMES[lm - 1]} {ly}</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const ps = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  label: {
    flex: 1, textAlign: 'center',
    fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 28,
    letterSpacing: -0.44, color: DS.text.primary,
  },
  confirmBtn: {
    height: 52, borderRadius: DS.radius.md, backgroundColor: DS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmText: {
    fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: '#fff',
  },
});

// ── Monthly summary footer ────────────────────────────────────────────────────

interface SummaryBarProps {
  income: number;
  expenses: number;
  net: number;
  year: number;
  month: number;
  currencySymbol: string;
}

function SummaryBar({ income, expenses, net, year, month, currencySymbol }: SummaryBarProps) {
  const isPositive = net >= 0;
  return (
    <View style={sb.container}>
      <Text style={sb.period}>{MONTH_NAMES[month - 1]} {year}</Text>
      <View style={sb.row}>
        <View style={sb.stat}>
          <View style={[sb.dot, { backgroundColor: DS.primary }]} />
          <View>
            <Text style={sb.statLabel}>Income</Text>
            <Text style={[sb.statValue, { color: DS.primaryLight }]}>
              {formatPaise(income, currencySymbol)}
            </Text>
          </View>
        </View>
        <View style={sb.divider} />
        <View style={sb.stat}>
          <View style={[sb.dot, { backgroundColor: DS.secondary }]} />
          <View>
            <Text style={sb.statLabel}>Expenses</Text>
            <Text style={[sb.statValue, { color: DS.secondaryLight }]}>
              {formatPaise(expenses, currencySymbol)}
            </Text>
          </View>
        </View>
        <View style={sb.divider} />
        <View style={sb.stat}>
          <View style={[sb.dot, { backgroundColor: isPositive ? DS.primary : DS.secondary }]} />
          <View>
            <Text style={sb.statLabel}>Net</Text>
            <Text style={[sb.statValue, { color: isPositive ? DS.primaryLight : DS.secondaryLight }]}>
              {net < 0 ? '−' : '+'}{formatPaise(Math.abs(net), currencySymbol)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const sb = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    backgroundColor: DS.surface.card,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.border.subtle,
  },
  period: {
    fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18,
    letterSpacing: 0.6, textTransform: 'uppercase', color: DS.text.muted,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: {
    fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 14, color: DS.text.muted,
    marginBottom: 2,
  },
  statValue: {
    fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18,
  },
  divider: { width: 1, height: 36, backgroundColor: DS.border.subtle, marginHorizontal: 8 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HistoryScreen() {
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
        <View style={s.dateHeader}>
          <Text style={s.dateHeaderText}>{item.label}</Text>
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
        iconColor={cat?.color ?? DS.text.muted}
        name={tx.description ?? cat?.name ?? (tx.type === 'income' ? 'Income' : tx.type === 'transfer' ? 'Transfer' : 'Expense')}
        category={meta || tx.type}
        date={''}
        amount={tx.amount}
        type={tx.type}
        onEdit={() => handleEdit(tx)}
        onDelete={() => handleDelete(tx)}
      />
    );
  }, [getCategoryById, accountName, handleEdit, handleDelete]);

  // ── Header component (search + chips) ────────────────────────────────────

  const ListHeader = (
    <View style={s.listHeader}>
      {/* Search */}
      <View style={s.searchRow}>
        <MaterialCommunityIcons name="magnify" size={20} color={DS.text.muted} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search transactions…"
          placeholderTextColor={DS.text.muted}
          selectionColor={DS.primary}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close-circle" size={18} color={DS.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {(['all', 'income', 'expense'] as TypeFilter[]).map((f) => {
          const active = typeFilter === f;
          const chipColor = f === 'income' ? DS.primary : f === 'expense' ? DS.secondary : DS.text.secondary;
          const label = f === 'all' ? 'All' : f === 'income' ? 'Income' : 'Expenses';
          return (
            <TouchableOpacity
              key={f}
              style={[
                s.chip,
                active
                  ? { backgroundColor: hexToRgba(chipColor, 0.18), borderColor: chipColor }
                  : { borderColor: DS.border.subtle },
              ]}
              onPress={() => setTypeFilter(f)}
              activeOpacity={0.75}
            >
              {f !== 'all' && (
                <MaterialCommunityIcons
                  name={f === 'income' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                  size={14}
                  color={active ? chipColor : DS.text.muted}
                />
              )}
              <Text style={[s.chipText, active && { color: chipColor }]}>{label}</Text>
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
        <View style={s.loadingMore}>
          <ActivityIndicator size="small" color={DS.primary} />
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
    <View style={s.loadingCenter}>
      <ActivityIndicator size="large" color={DS.primary} />
    </View>
  );

  // ── Screen ────────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <Text style={s.title}>History</Text>
        <TouchableOpacity
          style={s.monthBtn}
          onPress={() => setMonthPickerOpen(true)}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons name="calendar-month-outline" size={16} color={DS.primaryLight} />
          <Text style={s.monthBtnText}>{MONTH_NAMES[month - 1]} {year}</Text>
          <MaterialCommunityIcons name="chevron-down" size={16} color={DS.primaryLight} />
        </TouchableOpacity>
      </View>

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
            tintColor={DS.primary}
            colors={[DS.primary]}
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
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.surface.screen },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: DS.border.subtle,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24, lineHeight: 32, letterSpacing: -0.48,
    color: DS.text.primary,
  },
  monthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: DS.radius.full,
    backgroundColor: hexToRgba(DS.primary, 0.12),
    borderWidth: 1,
    borderColor: hexToRgba(DS.primary, 0.3),
  },
  monthBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13, lineHeight: 18,
    color: DS.primaryLight,
  },

  // List header (search + chips)
  listHeader: { paddingTop: 12, paddingBottom: 4 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: DS.radius.lg,
    backgroundColor: DS.surface.elevated,
    borderWidth: 1,
    borderColor: DS.border.subtle,
    marginBottom: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15, lineHeight: 20,
    color: DS.text.primary,
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
    borderRadius: DS.radius.full,
    backgroundColor: DS.surface.elevated,
    borderWidth: 1.5,
  },
  chipText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13, lineHeight: 18,
    color: DS.text.muted,
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
    color: DS.text.muted,
  },

  // Loading states
  loadingMore: { paddingVertical: 20, alignItems: 'center' },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
});
