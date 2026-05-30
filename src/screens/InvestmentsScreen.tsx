import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  RefreshControl,
  ScrollView,
  Animated,
  FlatList,
  Switch,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PageHeader from '../components/PageHeader';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';
import { hexToRgba } from '../utils/color';
import { useInvestmentsStore, InvestmentWithTotal } from '../store/investmentsStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAccountsStore } from '../store/accountsStore';
import { useRecurringStore } from '../store/recurringStore';
import {
  Account,
  AssetType,
  CreateInvestmentInput,
  InvestmentContribution,
  RecurrenceFrequency,
} from '../types/db';
import AppCard from '../components/AppCard';
import BottomSheet, { BottomSheetScrollView } from '../components/BottomSheet';
import { getNextRunDate } from '../db/queries/recurringQueries';

// ── Types ────────────────────────────────────────────────────────────────────

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// ── Constants ────────────────────────────────────────────────────────────────

interface AssetMeta { label: string; color: string; icon: IconName }

function makeAssetMeta(ds: DSType): Record<AssetType, AssetMeta> {
  return {
    stocks:        { label: 'Stocks',        color: ds.primary,      icon: 'trending-up' },
    mutual_fund:   { label: 'Mutual Fund',   color: ds.primaryLight, icon: 'chart-pie' },
    crypto:        { label: 'Crypto',        color: ds.purple,       icon: 'bitcoin' },
    fixed_deposit: { label: 'Fixed Deposit', color: ds.tertiary,     icon: 'bank-outline' },
    gold:          { label: 'Gold',          color: '#F59E0B',       icon: 'gold' },
    real_estate:   { label: 'Real Estate',   color: '#0EA5E9',       icon: 'home-city-outline' },
    other:         { label: 'Other',         color: ds.text.muted,   icon: 'shape-outline' },
  };
}

const ASSET_TYPES: AssetType[] = [
  'stocks', 'mutual_fund', 'crypto', 'fixed_deposit', 'gold', 'real_estate', 'other',
];

const FREQ_OPTIONS: { value: RecurrenceFrequency; label: string; icon: IconName }[] = [
  { value: 'daily',   label: 'Daily',   icon: 'calendar-today' },
  { value: 'weekly',  label: 'Weekly',  icon: 'calendar-week' },
  { value: 'monthly', label: 'Monthly', icon: 'calendar-month' },
  { value: 'yearly',  label: 'Yearly',  icon: 'calendar-star' },
];

const MONTHS_FULL = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_HEADERS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ── Helpers ──────────────────────────────────────────────────────────────────

const toDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateLocal = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

const formatBal = (paise: number): string =>
  (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Style factories ───────────────────────────────────────────────────────────

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: ds.surface.screen },

    listContent: { padding: 16, gap: 0 },

    // Hero
    heroCard: { marginBottom: 16 },
    heroLabel: {
      fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16,
      letterSpacing: 0.6, textTransform: 'uppercase', color: ds.text.muted, marginBottom: 4,
    },
    heroAmount: {
      fontFamily: 'Inter_700Bold', fontSize: 36, lineHeight: 44,
      letterSpacing: -1.2, color: ds.purple, marginBottom: 14,
    },
    summaryRow: { gap: 8 },
    summaryChip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    summaryDot: { width: 8, height: 8, borderRadius: 4 },
    summaryLabel: {
      flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: ds.text.secondary,
    },
    summaryValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18 },

    // Empty
    emptyBox: { alignItems: 'center', gap: 12, paddingVertical: 48 },
    emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, lineHeight: 24, color: ds.text.secondary },
    emptyHint: {
      fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20,
      color: ds.text.muted, textAlign: 'center', maxWidth: 260,
    },

    // Section header
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 8 },
    sectionIconWrap: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    sectionTitle: {
      flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18,
      textTransform: 'uppercase', letterSpacing: 0.5, color: ds.text.muted,
    },
    sectionTotal: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },

    rowWrap: { backgroundColor: ds.surface.card, borderRadius: 0, overflow: 'hidden' },

    // Investment row
    invRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: ds.surface.card, paddingHorizontal: 16, height: ROW_HEIGHT, gap: 12,
    },
    invIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    invInfo: { flex: 1, gap: 4 },
    invName: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 20, color: ds.text.primary },
    badgeRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', alignItems: 'center' },
    typeBadge: { alignSelf: 'flex-start', borderRadius: ds.radius.full, paddingHorizontal: 8, paddingVertical: 2 },
    typeBadgeText: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 14 },
    recurringBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      borderRadius: ds.radius.full, paddingHorizontal: 6, paddingVertical: 2,
    },
    recurringBadgeText: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14 },
    linkedAccBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      borderRadius: ds.radius.full, paddingHorizontal: 6, paddingVertical: 2,
    },
    linkedAccText: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14 },
    invRight: { alignItems: 'flex-end', gap: 4 },
    invAmount: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 20, color: ds.text.primary },
    invDate: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 14, color: ds.text.muted },
    deleteAction: {
      width: 68, height: ROW_HEIGHT, backgroundColor: ds.secondary,
      alignItems: 'center', justifyContent: 'center',
    },
    itemDivider: { height: StyleSheet.hairlineWidth, backgroundColor: ds.border.subtle, marginLeft: 70 },

    // FAB
    fab: {
      position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28,
      backgroundColor: ds.purple, alignItems: 'center', justifyContent: 'center', ...ds.shadow.modal,
    },

    // Form / sheet
    sheetContent: { padding: 20, gap: 6, paddingBottom: 8 },
    fieldLabel: {
      fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16,
      letterSpacing: 0.4, textTransform: 'uppercase', color: ds.text.muted, marginTop: 10,
    },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    currencyPrefix: { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: ds.text.secondary },
    input: {
      flex: 1, height: 44, backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.md, borderWidth: 1, borderColor: ds.border.subtle,
      paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 15, color: ds.text.primary,
    },
    textArea: { height: 72, paddingTop: 10, textAlignVertical: 'top' },
    dateRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10, height: 44,
      backgroundColor: ds.surface.elevated, borderRadius: ds.radius.md,
      borderWidth: 1, borderColor: ds.border.subtle, paddingHorizontal: 14,
    },
    dateText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, color: ds.text.primary },
    typeScroll: { gap: 8, paddingVertical: 2 },
    typeChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderRadius: ds.radius.full, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7,
    },
    typeChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16 },
    accountChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderRadius: ds.radius.full, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7,
    },
    accountChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16 },
    // Recurring toggle row
    toggleRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: ds.surface.elevated, borderRadius: ds.radius.md,
      borderWidth: 1, borderColor: ds.border.subtle,
      paddingHorizontal: 14, paddingVertical: 12,
    },
    toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    toggleLabel: { fontFamily: 'Inter_500Medium', fontSize: 15, color: ds.text.primary },
    toggleSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: ds.text.muted, marginTop: 2 },
    ctaBtn: {
      marginTop: 16, height: 52, borderRadius: ds.radius.lg,
      backgroundColor: ds.purple, alignItems: 'center', justifyContent: 'center',
    },
    ctaBtnDisabled: { opacity: 0.5 },
    ctaText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#fff' },

    // Detail view
    detailHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: ds.border.subtle,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: ds.surface.elevated, alignItems: 'center', justifyContent: 'center',
    },
    detailTitle: {
      flex: 1, fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 26,
      letterSpacing: -0.3, color: ds.text.primary,
    },
    heroCardDetail: { margin: 16, marginBottom: 8 },
    totalLabel: {
      fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 14,
      letterSpacing: 0.6, textTransform: 'uppercase', color: ds.text.muted, marginBottom: 4,
    },
    totalAmount: {
      fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 38,
      letterSpacing: -0.8, color: ds.purple, marginBottom: 10,
    },
    statsRow: {
      flexDirection: 'row', paddingTop: 12,
      borderTopWidth: 1, borderTopColor: ds.border.subtle,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statVal: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 20, color: ds.text.primary },
    statLbl: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 14, color: ds.text.muted, marginTop: 2 },
    statDivider: { width: 1, height: 32, backgroundColor: ds.border.subtle },
    contribSectionHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
    },
    contribSectionLabel: {
      fontFamily: 'Inter_500Medium', fontSize: 11, color: ds.text.muted,
      letterSpacing: 1.2, textTransform: 'uppercase',
    },
    addContribBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: ds.purple, borderRadius: ds.radius.full, paddingHorizontal: 12, paddingVertical: 6,
    },
    addContribText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#fff' },
    contribList: { paddingHorizontal: 16 },
    contribRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
    contribDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
    contribBody: { flex: 1, gap: 2 },
    contribAmount: { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22 },
    contribNote: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: ds.text.muted },
    contribMeta: { alignItems: 'flex-end', gap: 6 },
    contribDate: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: ds.text.muted },
    contribDivider: { height: StyleSheet.hairlineWidth, backgroundColor: ds.border.subtle },
  });
}

function makeCalStyles(ds: DSType) {
  return StyleSheet.create({
    wrap: { backgroundColor: ds.surface.elevated, borderRadius: ds.radius.lg, padding: 12, marginTop: 8 },
    nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    navBtn: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: ds.surface.highest, alignItems: 'center', justifyContent: 'center',
    },
    navLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: ds.text.primary },
    row: { flexDirection: 'row', marginBottom: 6 },
    dayH: { flex: 1, textAlign: 'center', fontFamily: 'Inter_500Medium', fontSize: 11, color: ds.text.muted },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    selectedCell: { backgroundColor: ds.purple, borderRadius: 20 },
    dayText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: ds.text.secondary },
    todayText: { fontFamily: 'Inter_700Bold', color: ds.purple },
    selectedText: { fontFamily: 'Inter_700Bold', color: '#fff' },
  });
}

// ── InlineCalendar ────────────────────────────────────────────────────────────

function InlineCalendar({ value, onSelect, accentColor }: {
  value: Date; onSelect: (d: Date) => void; accentColor?: string;
}) {
  const ds = useDS();
  const cal = useMemo(() => makeCalStyles(ds), [ds]);
  const [viewYear, setViewYear]   = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const goPrev = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };
  const today = new Date();
  const accent = accentColor ?? ds.purple;
  return (
    <View style={cal.wrap}>
      <View style={cal.nav}>
        <TouchableOpacity onPress={goPrev} style={cal.navBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={20} color={ds.text.secondary} />
        </TouchableOpacity>
        <Text style={cal.navLabel}>{MONTHS_FULL[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={goNext} style={cal.navBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-right" size={20} color={ds.text.secondary} />
        </TouchableOpacity>
      </View>
      <View style={cal.row}>
        {DAY_HEADERS.map(h => <Text key={h} style={cal.dayH}>{h}</Text>)}
      </View>
      <View style={cal.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`e${i}`} style={cal.cell} />;
          const sel = day === value.getDate() && viewMonth === value.getMonth() && viewYear === value.getFullYear();
          const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
          return (
            <TouchableOpacity
              key={day}
              style={[cal.cell, sel && [cal.selectedCell, { backgroundColor: accent }]]}
              onPress={() => onSelect(new Date(viewYear, viewMonth, day))}
              activeOpacity={0.7}
            >
              <Text style={[cal.dayText, isToday && !sel && [cal.todayText, { color: accent }], sel && cal.selectedText]}>
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── AccountChips ─────────────────────────────────────────────────────────────

function AccountChips({ ds, s, activeAccounts, selectedAccountId, onSelect }: {
  ds: DSType;
  s: ReturnType<typeof makeStyles>;
  activeAccounts: Account[];
  selectedAccountId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (activeAccounts.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeScroll}>
      <TouchableOpacity
        style={[s.accountChip,
          selectedAccountId === null
            ? { backgroundColor: ds.text.muted, borderColor: ds.text.muted }
            : { backgroundColor: hexToRgba(ds.text.muted, 0.08), borderColor: hexToRgba(ds.text.muted, 0.3) }]}
        onPress={() => onSelect(null)} activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="close-circle-outline" size={14} color={selectedAccountId === null ? '#fff' : ds.text.muted} />
        <Text style={[s.accountChipText, { color: selectedAccountId === null ? '#fff' : ds.text.muted }]}>None</Text>
      </TouchableOpacity>
      {activeAccounts.map(acc => {
        const sel = selectedAccountId === acc.id;
        return (
          <TouchableOpacity
            key={acc.id}
            style={[s.accountChip,
              sel
                ? { backgroundColor: ds.purple, borderColor: ds.purple }
                : { backgroundColor: hexToRgba(ds.purple, 0.08), borderColor: hexToRgba(ds.purple, 0.3) }]}
            onPress={() => onSelect(acc.id)} activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="bank-outline" size={14} color={sel ? '#fff' : ds.purple} />
            <Text style={[s.accountChipText, { color: sel ? '#fff' : ds.purple }]}>{acc.name}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ── InvestmentRow ─────────────────────────────────────────────────────────────

const ROW_HEIGHT = 72;

function InvestmentRow({
  investment, currencySymbol, accountName, hasRecurring, onDelete, onTap,
}: {
  investment: InvestmentWithTotal;
  currencySymbol: string;
  accountName: string | null;
  hasRecurring: boolean;
  onDelete: () => void;
  onTap: () => void;
}) {
  const ds = useDS();
  const s = useMemo(() => makeStyles(ds), [ds]);
  const ASSET_META = useMemo(() => makeAssetMeta(ds), [ds]);
  const swipeRef = useRef<Swipeable>(null);
  const meta = ASSET_META[investment.asset_type] ?? ASSET_META.other;

  const renderRight = (progress: Animated.AnimatedInterpolation<number>) => {
    const tx = progress.interpolate({ inputRange: [0, 1], outputRange: [68, 0] });
    return (
      <Animated.View style={{ transform: [{ translateX: tx }] }}>
        <TouchableOpacity
          style={s.deleteAction}
          onPress={() => { swipeRef.current?.close(); onDelete(); }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRight} overshootRight={false} friction={2}>
      <TouchableOpacity style={s.invRow} onPress={onTap} activeOpacity={0.85}>
        <View style={[s.invIcon, { backgroundColor: hexToRgba(meta.color, 0.15) }]}>
          <MaterialCommunityIcons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={s.invInfo}>
          <Text style={s.invName} numberOfLines={1}>{investment.asset_name}</Text>
          <View style={s.badgeRow}>
            <View style={[s.typeBadge, { backgroundColor: hexToRgba(meta.color, 0.12) }]}>
              <Text style={[s.typeBadgeText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            {hasRecurring && (
              <View style={[s.recurringBadge, { backgroundColor: hexToRgba(ds.purple, 0.1) }]}>
                <MaterialCommunityIcons name="repeat" size={10} color={ds.purple} />
                <Text style={[s.recurringBadgeText, { color: ds.purple }]}>SIP</Text>
              </View>
            )}
            {accountName && (
              <View style={[s.linkedAccBadge, { backgroundColor: hexToRgba(ds.primary, 0.1) }]}>
                <MaterialCommunityIcons name="bank-outline" size={10} color={ds.primary} />
                <Text style={[s.linkedAccText, { color: ds.primary }]}>{accountName}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={s.invRight}>
          <Text style={s.invAmount}>{currencySymbol}{formatBal(investment.total_amount)}</Text>
          <Text style={s.invDate}>{formatDateLocal(investment.investment_date)}</Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

// ── Section type ─────────────────────────────────────────────────────────────

interface InvSection {
  title: string; type: AssetType; total: number; data: InvestmentWithTotal[];
}

// ── InvestmentDetailView ──────────────────────────────────────────────────────

function InvestmentDetailView({
  investmentId, onBack,
}: { investmentId: string; onBack: () => void }) {
  const ds = useDS();
  const s = useMemo(() => makeStyles(ds), [ds]);
  const ASSET_META = useMemo(() => makeAssetMeta(ds), [ds]);
  const insets = useSafeAreaInsets();
  const { currencySymbol } = useSettingsStore();
  const {
    investments, activeContributions,
    selectInvestment, addContribution, deleteContribution,
  } = useInvestmentsStore();
  const { accounts, loadFromDB: loadAccounts } = useAccountsStore();
  const { addRecurring } = useRecurringStore();

  const activeAccounts = useMemo(() => accounts.filter(a => !a.is_archived), [accounts]);
  const investment = investments.find(i => i.id === investmentId);
  const meta = investment ? (ASSET_META[investment.asset_type] ?? ASSET_META.other) : ASSET_META.other;
  const accent = meta.color;

  const [showAdd,           setShowAdd]           = useState(false);
  const [amount,            setAmount]            = useState('');
  const [date,              setDate]              = useState(new Date());
  const [showCal,           setShowCal]           = useState(false);
  const [note,              setNote]              = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isRecurring,       setIsRecurring]       = useState(false);
  const [frequency,         setFrequency]         = useState<RecurrenceFrequency>('monthly');
  const [saving,            setSaving]            = useState(false);

  useEffect(() => {
    selectInvestment(investmentId);
    loadAccounts();
    return () => { selectInvestment(null); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investmentId]);

  const resetForm = () => {
    setAmount(''); setNote(''); setDate(new Date());
    setSelectedAccountId(null); setIsRecurring(false); setFrequency('monthly'); setShowCal(false);
  };

  const handleAdd = async () => {
    const paise = Math.round(parseFloat(amount) * 100);
    if (!amount.trim() || isNaN(paise) || paise <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number'); return;
    }
    if (isRecurring && !selectedAccountId) {
      Alert.alert('Account required', 'Select an account to enable recurring.'); return;
    }
    setSaving(true);
    try {
      await addContribution({
        investment_id: investmentId,
        amount: paise,
        notes: note.trim() || null,
        contribution_date: toDateStr(date),
        account_id: selectedAccountId,
      });
      if (isRecurring && selectedAccountId && investment) {
        const nextDate = getNextRunDate(toDateStr(date), frequency);
        await addRecurring({
          type: 'expense',
          amount: paise,
          account_id: selectedAccountId,
          description: `SIP: ${investment.asset_name}`,
          frequency,
          start_date: nextDate,
          investment_id: investmentId,
        });
      }
      setShowAdd(false);
      resetForm();
    } catch {
      Alert.alert('Error', 'Could not save contribution');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (c: InvestmentContribution) => {
    const linkedAccName = c.account_id
      ? (activeAccounts.find(a => a.id === c.account_id)?.name ?? null)
      : null;
    const revertNote = linkedAccName
      ? `\n\nThis contribution was funded from "${linkedAccName}" — the amount will be returned to that account.`
      : '';
    Alert.alert('Delete contribution?', `This cannot be undone.${revertNote}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteContribution(c.id, investmentId) },
    ]);
  };

  if (!investment) return null;

  const sipTotal = activeContributions.reduce((s, c) => s + c.amount, 0);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.detailHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={ds.text.primary} />
        </TouchableOpacity>
        <View style={[s.invIcon, { backgroundColor: hexToRgba(accent, 0.15) }]}>
          <MaterialCommunityIcons name={meta.icon} size={18} color={accent} />
        </View>
        <Text style={s.detailTitle} numberOfLines={1}>{investment.asset_name}</Text>
      </View>

      {/* Stats card */}
      <View style={s.heroCardDetail}>
        <AppCard padding={20}>
          <Text style={s.totalLabel}>Total Invested</Text>
          <Text style={[s.totalAmount, { color: accent }]}>
            {currencySymbol}{formatBal(investment.total_amount)}
          </Text>
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statVal}>{currencySymbol}{formatBal(investment.amount_invested)}</Text>
              <Text style={s.statLbl}>Initial</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statVal}>{currencySymbol}{formatBal(sipTotal)}</Text>
              <Text style={s.statLbl}>SIP added</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statVal}>{activeContributions.length}</Text>
              <Text style={s.statLbl}>SIP entries</Text>
            </View>
          </View>
        </AppCard>
      </View>

      {/* Contributions list */}
      <View style={s.contribSectionHeader}>
        <Text style={s.contribSectionLabel}>SIP Contributions ({activeContributions.length})</Text>
        <TouchableOpacity style={s.addContribBtn} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
          <MaterialCommunityIcons name="plus" size={15} color="#fff" />
          <Text style={s.addContribText}>Add More</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeContributions}
        keyExtractor={c => c.id}
        contentContainerStyle={[s.contribList, { paddingBottom: insets.bottom + 80 }]}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <MaterialCommunityIcons name="cash-plus" size={36} color={ds.text.muted} />
            <Text style={s.emptyTitle}>No SIP entries yet</Text>
            <Text style={s.emptyHint}>Tap "Add More" to record a new installment</Text>
          </View>
        }
        renderItem={({ item }) => {
          const linkedAccName = item.account_id
            ? (activeAccounts.find(a => a.id === item.account_id)?.name ?? null)
            : null;
          return (
            <View style={s.contribRow}>
              <View style={[s.contribDot, { backgroundColor: hexToRgba(accent, 0.8) }]} />
              <View style={s.contribBody}>
                <Text style={[s.contribAmount, { color: accent }]}>
                  +{currencySymbol}{formatBal(item.amount)}
                </Text>
                {item.notes ? <Text style={s.contribNote}>{item.notes}</Text> : null}
                {linkedAccName && (
                  <View style={[s.linkedAccBadge, { backgroundColor: hexToRgba(ds.primary, 0.1) }]}>
                    <MaterialCommunityIcons name="bank-outline" size={10} color={ds.primary} />
                    <Text style={[s.linkedAccText, { color: ds.primary }]}>{linkedAccName}</Text>
                  </View>
                )}
              </View>
              <View style={s.contribMeta}>
                <Text style={s.contribDate}>{formatDateLocal(item.contribution_date)}</Text>
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={15} color={ds.text.muted} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={s.contribDivider} />}
      />

      {/* Add Contribution Sheet */}
      <BottomSheet
        visible={showAdd}
        onClose={() => { setShowAdd(false); resetForm(); }}
        title="Add SIP Contribution"
      >
        <BottomSheetScrollView contentContainerStyle={s.sheetContent} keyboardShouldPersistTaps="handled">
          <Text style={s.fieldLabel}>Amount *</Text>
          <View style={s.inputRow}>
            <Text style={s.currencyPrefix}>{currencySymbol}</Text>
            <TextInput
              style={s.input} value={amount} onChangeText={setAmount}
              keyboardType="decimal-pad" placeholder="0.00"
              placeholderTextColor={ds.text.muted} autoFocus
            />
          </View>

          <Text style={s.fieldLabel}>Date</Text>
          <TouchableOpacity style={s.dateRow} onPress={() => setShowCal(c => !c)} activeOpacity={0.8}>
            <MaterialCommunityIcons name="calendar" size={18} color={ds.text.muted} />
            <Text style={s.dateText}>{toDateStr(date) === toDateStr(new Date()) ? 'Today' : formatDateLocal(toDateStr(date))}</Text>
            <MaterialCommunityIcons name={showCal ? 'chevron-up' : 'chevron-down'} size={18} color={ds.text.muted} />
          </TouchableOpacity>
          {showCal && <InlineCalendar value={date} onSelect={d => { setDate(d); setShowCal(false); }} accentColor={accent} />}

          <Text style={s.fieldLabel}>Note (optional)</Text>
          <TextInput
            style={[s.input, s.textArea]} value={note} onChangeText={setNote}
            placeholder="e.g. March SIP" placeholderTextColor={ds.text.muted} multiline numberOfLines={2}
          />

          <Text style={s.fieldLabel}>Deduct from account (optional)</Text>
          <AccountChips ds={ds} s={s} activeAccounts={activeAccounts} selectedAccountId={selectedAccountId} onSelect={setSelectedAccountId} />

          {/* Recurring toggle */}
          <Text style={s.fieldLabel}>Recurring</Text>
          <View style={s.toggleRow}>
            <View style={s.toggleLeft}>
              <MaterialCommunityIcons name="repeat" size={20} color={isRecurring ? ds.purple : ds.text.muted} />
              <View>
                <Text style={s.toggleLabel}>Repeat automatically</Text>
                <Text style={s.toggleSub}>
                  {isRecurring && selectedAccountId ? 'Account will be debited on schedule' : 'Account required for recurring'}
                </Text>
              </View>
            </View>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ false: ds.border.subtle, true: hexToRgba(ds.purple, 0.4) }}
              thumbColor={isRecurring ? ds.purple : ds.text.muted}
            />
          </View>
          {isRecurring && (
            <>
              <Text style={s.fieldLabel}>Frequency</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeScroll}>
                {FREQ_OPTIONS.map(opt => {
                  const sel = frequency === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[s.typeChip, sel
                        ? { backgroundColor: ds.purple, borderColor: ds.purple }
                        : { backgroundColor: hexToRgba(ds.purple, 0.08), borderColor: hexToRgba(ds.purple, 0.3) }]}
                      onPress={() => setFrequency(opt.value)} activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name={opt.icon} size={13} color={sel ? '#fff' : ds.purple} />
                      <Text style={[s.typeChipText, { color: sel ? '#fff' : ds.purple }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          <TouchableOpacity
            style={[s.ctaBtn, saving && s.ctaBtnDisabled]}
            onPress={handleAdd} disabled={saving} activeOpacity={0.85}
          >
            <Text style={s.ctaText}>{saving ? 'Saving…' : isRecurring ? 'Save & Schedule' : 'Add Contribution'}</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

// ── InvestmentsScreen ─────────────────────────────────────────────────────────

export default function InvestmentsScreen() {
  const ds = useDS();
  const s = useMemo(() => makeStyles(ds), [ds]);
  const ASSET_META = useMemo(() => makeAssetMeta(ds), [ds]);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const {
    investments, totalInvested, summaryByType, isLoading,
    loadFromDB, addInvestment, deleteInvestment,
  } = useInvestmentsStore();
  const { currencySymbol } = useSettingsStore();
  const { accounts, loadFromDB: loadAccounts } = useAccountsStore();
  const { items: recurringItems, loadFromDB: loadRecurring, addRecurring } = useRecurringStore();

  const activeAccounts = useMemo(() => accounts.filter(a => !a.is_archived), [accounts]);

  const [detailInvestmentId, setDetailInvestmentId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Add-investment form state
  const [assetName,         setAssetName]         = useState('');
  const [assetType,         setAssetType]         = useState<AssetType>('stocks');
  const [amount,            setAmount]            = useState('');
  const [date,              setDate]              = useState(new Date());
  const [notes,             setNotes]             = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isRecurring,       setIsRecurring]       = useState(false);
  const [frequency,         setFrequency]         = useState<RecurrenceFrequency>('monthly');
  const [showCal,           setShowCal]           = useState(false);
  const [saving,            setSaving]            = useState(false);

  useFocusEffect(useCallback(() => {
    loadFromDB(); loadAccounts(); loadRecurring();
  }, [loadFromDB, loadAccounts, loadRecurring]));

  useEffect(() => {
    if (!detailInvestmentId) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setDetailInvestmentId(null); return true;
    });
    return () => sub.remove();
  }, [detailInvestmentId]);

  if (detailInvestmentId) {
    return <InvestmentDetailView investmentId={detailInvestmentId} onBack={() => setDetailInvestmentId(null)} />;
  }

  const sections = (() => {
    const grouped: Partial<Record<AssetType, InvestmentWithTotal[]>> = {};
    for (const inv of investments) {
      if (!grouped[inv.asset_type]) grouped[inv.asset_type] = [];
      grouped[inv.asset_type]!.push(inv);
    }
    return Object.entries(grouped)
      .map(([type, data]) => ({
        title: ASSET_META[type as AssetType].label,
        type: type as AssetType,
        total: (data ?? []).reduce((acc, i) => acc + i.total_amount, 0),
        data: data ?? [],
      }))
      .sort((a, b) => b.total - a.total) as InvSection[];
  })();

  const investmentRecurringIds = new Set(
    recurringItems.filter(r => r.investment_id).map(r => r.investment_id!)
  );

  const resetForm = () => {
    setAssetName(''); setAssetType('stocks'); setAmount('');
    setDate(new Date()); setNotes(''); setSelectedAccountId(null);
    setIsRecurring(false); setFrequency('monthly'); setShowCal(false);
  };

  const handleAdd = async () => {
    if (!assetName.trim()) { Alert.alert('Asset name required'); return; }
    const paise = Math.round(parseFloat(amount) * 100);
    if (!amount.trim() || isNaN(paise) || paise <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number'); return;
    }
    if (isRecurring && !selectedAccountId) {
      Alert.alert('Account required', 'Select an account to enable recurring.'); return;
    }
    setSaving(true);
    try {
      const created = await addInvestment({
        asset_name: assetName.trim(),
        asset_type: assetType,
        amount_invested: paise,
        investment_date: toDateStr(date),
        notes: notes.trim() || null,
        account_id: selectedAccountId,
      } as CreateInvestmentInput);

      if (isRecurring && selectedAccountId) {
        const nextDate = getNextRunDate(toDateStr(date), frequency);
        await addRecurring({
          type: 'expense',
          amount: paise,
          account_id: selectedAccountId,
          description: `SIP: ${assetName.trim()}`,
          frequency,
          start_date: nextDate,
          investment_id: created.id,
        });
      }
      setShowAdd(false); resetForm();
    } catch {
      Alert.alert('Error', 'Could not save investment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (inv: InvestmentWithTotal) => {
    const linkedAccName = inv.account_id
      ? (activeAccounts.find(a => a.id === inv.account_id)?.name ?? null)
      : null;
    const revertNote = linkedAccName
      ? `\n\n${inv.asset_name} was funded from "${linkedAccName}" — the amount will be returned to that account.`
      : '';
    Alert.alert('Delete investment?', `Remove ${inv.asset_name}?${revertNote}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteInvestment(inv.id) },
    ]);
  };

  return (
    <View style={s.root}>
      <PageHeader onBack={() => navigation.goBack()} title="Investments" />

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadFromDB} tintColor={ds.primary} colors={[ds.primary]} />
        }
        ListHeaderComponent={
          <View>
            <AppCard padding={22} style={s.heroCard}>
              <Text style={s.heroLabel}>Total Invested</Text>
              <Text style={s.heroAmount}>{currencySymbol}{formatBal(totalInvested)}</Text>
              {summaryByType.length > 0 && (
                <View style={s.summaryRow}>
                  {summaryByType.slice(0, 3).map(({ asset_type, total }) => {
                    const meta = ASSET_META[asset_type] ?? ASSET_META.other;
                    return (
                      <View key={asset_type} style={s.summaryChip}>
                        <View style={[s.summaryDot, { backgroundColor: meta.color }]} />
                        <Text style={s.summaryLabel}>{meta.label}</Text>
                        <Text style={[s.summaryValue, { color: meta.color }]}>
                          {currencySymbol}{formatBal(total)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </AppCard>
            {investments.length === 0 && (
              <View style={s.emptyBox}>
                <MaterialCommunityIcons name="trending-up" size={52} color={ds.primary} style={{ opacity: 0.4 }} />
                <Text style={s.emptyTitle}>No investments yet</Text>
                <Text style={s.emptyHint}>Start building your portfolio — tap + to add your first investment</Text>
              </View>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => {
          const meta = ASSET_META[section.type] ?? ASSET_META.other;
          return (
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconWrap, { backgroundColor: hexToRgba(meta.color, 0.12) }]}>
                <MaterialCommunityIcons name={meta.icon} size={14} color={meta.color} />
              </View>
              <Text style={s.sectionTitle}>{section.title}</Text>
              <Text style={[s.sectionTotal, { color: meta.color }]}>
                {currencySymbol}{formatBal(section.total)}
              </Text>
            </View>
          );
        }}
        renderItem={({ item }) => (
          <View style={s.rowWrap}>
            <InvestmentRow
              investment={item}
              currencySymbol={currencySymbol}
              accountName={item.account_id ? (activeAccounts.find(a => a.id === item.account_id)?.name ?? null) : null}
              hasRecurring={investmentRecurringIds.has(item.id)}
              onDelete={() => handleDelete(item)}
              onTap={() => setDetailInvestmentId(item.id)}
            />
          </View>
        )}
        SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
        ItemSeparatorComponent={() => <View style={s.itemDivider} />}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 72 }]}
        onPress={() => setShowAdd(true)}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Investment Sheet */}
      <BottomSheet
        visible={showAdd}
        onClose={() => { setShowAdd(false); resetForm(); }}
        title="Add Investment"
      >
        <BottomSheetScrollView contentContainerStyle={s.sheetContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={s.fieldLabel}>Asset name *</Text>
          <TextInput
            style={s.input} value={assetName} onChangeText={setAssetName}
            placeholder="e.g. Nifty 50 Index Fund" placeholderTextColor={ds.text.muted} autoFocus
          />

          <Text style={s.fieldLabel}>Asset type *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeScroll}>
            {ASSET_TYPES.map(t => {
              const meta = ASSET_META[t];
              const selected = assetType === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[s.typeChip, selected
                    ? { backgroundColor: meta.color, borderColor: meta.color }
                    : { backgroundColor: hexToRgba(meta.color, 0.08), borderColor: hexToRgba(meta.color, 0.3) }]}
                  onPress={() => setAssetType(t)} activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name={meta.icon} size={14} color={selected ? '#fff' : meta.color} />
                  <Text style={[s.typeChipText, { color: selected ? '#fff' : meta.color }]}>{meta.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={s.fieldLabel}>Amount invested *</Text>
          <View style={s.inputRow}>
            <Text style={s.currencyPrefix}>{currencySymbol}</Text>
            <TextInput
              style={s.input} value={amount} onChangeText={setAmount}
              keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={ds.text.muted}
            />
          </View>

          <Text style={s.fieldLabel}>Investment date</Text>
          <TouchableOpacity style={s.dateRow} onPress={() => setShowCal(c => !c)} activeOpacity={0.8}>
            <MaterialCommunityIcons name="calendar" size={18} color={ds.text.muted} />
            <Text style={s.dateText}>{toDateStr(date) === toDateStr(new Date()) ? 'Today' : formatDateLocal(toDateStr(date))}</Text>
            <MaterialCommunityIcons name={showCal ? 'chevron-up' : 'chevron-down'} size={18} color={ds.text.muted} />
          </TouchableOpacity>
          {showCal && <InlineCalendar value={date} onSelect={d => { setDate(d); setShowCal(false); }} />}

          <Text style={s.fieldLabel}>Notes (optional)</Text>
          <TextInput
            style={[s.input, s.textArea]} value={notes} onChangeText={setNotes}
            placeholder="e.g. SIP auto-debit" placeholderTextColor={ds.text.muted} multiline numberOfLines={2}
          />

          <Text style={s.fieldLabel}>Deduct from account (optional)</Text>
          <AccountChips ds={ds} s={s} activeAccounts={activeAccounts} selectedAccountId={selectedAccountId} onSelect={setSelectedAccountId} />

          <Text style={s.fieldLabel}>Recurring</Text>
          <View style={s.toggleRow}>
            <View style={s.toggleLeft}>
              <MaterialCommunityIcons name="repeat" size={20} color={isRecurring ? ds.purple : ds.text.muted} />
              <View>
                <Text style={s.toggleLabel}>Repeat automatically</Text>
                <Text style={s.toggleSub}>
                  {isRecurring && selectedAccountId ? 'Account will be debited on schedule' : 'Account required for recurring'}
                </Text>
              </View>
            </View>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ false: ds.border.subtle, true: hexToRgba(ds.purple, 0.4) }}
              thumbColor={isRecurring ? ds.purple : ds.text.muted}
            />
          </View>
          {isRecurring && (
            <>
              <Text style={s.fieldLabel}>Frequency</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeScroll}>
                {FREQ_OPTIONS.map(opt => {
                  const sel = frequency === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[s.typeChip, sel
                        ? { backgroundColor: ds.purple, borderColor: ds.purple }
                        : { backgroundColor: hexToRgba(ds.purple, 0.08), borderColor: hexToRgba(ds.purple, 0.3) }]}
                      onPress={() => setFrequency(opt.value)} activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name={opt.icon} size={13} color={sel ? '#fff' : ds.purple} />
                      <Text style={[s.typeChipText, { color: sel ? '#fff' : ds.purple }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          <TouchableOpacity
            style={[s.ctaBtn, saving && s.ctaBtnDisabled]}
            onPress={handleAdd} disabled={saving} activeOpacity={0.85}
          >
            <Text style={s.ctaText}>{saving ? 'Saving…' : isRecurring ? 'Save & Schedule' : 'Add Investment'}</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}
