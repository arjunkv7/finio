import React, { useCallback, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BrandHeader from '../components/BrandHeader';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';
import { hexToRgba } from '../utils/color';
import { useInvestmentsStore } from '../store/investmentsStore';
import { useSettingsStore } from '../store/settingsStore';
import { Investment, AssetType, CreateInvestmentInput } from '../types/db';
import AppCard from '../components/AppCard';
import BottomSheet from '../components/BottomSheet';

// ── Types ────────────────────────────────────────────────────────────────────

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// ── Constants ────────────────────────────────────────────────────────────────

interface AssetMeta { label: string; color: string; icon: IconName }

function makeAssetMeta(ds: DSType): Record<AssetType, AssetMeta> {
  return {
    stocks:        { label: 'Stocks',         color: ds.primary,      icon: 'trending-up' },
    mutual_fund:   { label: 'Mutual Fund',    color: ds.primaryLight, icon: 'chart-pie' },
    crypto:        { label: 'Crypto',         color: ds.purple,       icon: 'bitcoin' },
    fixed_deposit: { label: 'Fixed Deposit',  color: ds.tertiary,     icon: 'bank-outline' },
    gold:          { label: 'Gold',           color: '#F59E0B',       icon: 'gold' },
    real_estate:   { label: 'Real Estate',    color: '#0EA5E9',       icon: 'home-city-outline' },
    other:         { label: 'Other',          color: ds.text.muted,   icon: 'shape-outline' },
  };
}

const ASSET_TYPES: AssetType[] = [
  'stocks', 'mutual_fund', 'crypto', 'fixed_deposit', 'gold', 'real_estate', 'other',
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
  (paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ── Style factories ───────────────────────────────────────────────────────────

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: ds.surface.screen },

    header: {
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: ds.border.subtle,
    },
    headerTitle: {
      fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 32,
      letterSpacing: -0.48, color: ds.text.primary,
    },

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
    summaryChip: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
    },
    summaryDot: { width: 8, height: 8, borderRadius: 4 },
    summaryLabel: {
      flex: 1,
      fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: ds.text.secondary,
    },
    summaryValue: {
      fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18,
    },

    // Empty
    emptyBox: { alignItems: 'center', gap: 12, paddingVertical: 48 },
    emptyTitle: {
      fontFamily: 'Inter_600SemiBold', fontSize: 18, lineHeight: 24, color: ds.text.secondary,
    },
    emptyHint: {
      fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20,
      color: ds.text.muted, textAlign: 'center', maxWidth: 260,
    },

    // Section header
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 4, paddingVertical: 8,
    },
    sectionIconWrap: {
      width: 24, height: 24, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center',
    },
    sectionTitle: {
      flex: 1,
      fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18,
      textTransform: 'uppercase', letterSpacing: 0.5, color: ds.text.muted,
    },
    sectionTotal: {
      fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20,
    },

    // Row wrapper (card bg)
    rowWrap: {
      backgroundColor: ds.surface.card,
      borderRadius: 0,
      overflow: 'hidden',
    },

    // Investment row
    invRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: ds.surface.card,
      paddingHorizontal: 16, height: ROW_HEIGHT, gap: 12,
    },
    invIcon: {
      width: 42, height: 42, borderRadius: 21,
      alignItems: 'center', justifyContent: 'center',
    },
    invInfo: { flex: 1, gap: 5 },
    invName: {
      fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 20, color: ds.text.primary,
    },
    typeBadge: {
      alignSelf: 'flex-start',
      borderRadius: ds.radius.full,
      paddingHorizontal: 8, paddingVertical: 2,
    },
    typeBadgeText: {
      fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 14,
    },
    invRight: { alignItems: 'flex-end', gap: 4 },
    invAmount: {
      fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 20, color: ds.text.primary,
    },
    invDate: {
      fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 14, color: ds.text.muted,
    },
    deleteAction: {
      width: 68, height: ROW_HEIGHT,
      backgroundColor: ds.secondary,
      alignItems: 'center', justifyContent: 'center',
    },
    itemDivider: {
      height: StyleSheet.hairlineWidth, backgroundColor: ds.border.subtle, marginLeft: 70,
    },

    // FAB
    fab: {
      position: 'absolute', right: 20,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: ds.purple,
      alignItems: 'center', justifyContent: 'center',
      ...ds.shadow.modal,
    },

    // Sheet / form
    sheetContent: { padding: 20, gap: 6, paddingBottom: 8 },
    fieldLabel: {
      fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16,
      letterSpacing: 0.4, textTransform: 'uppercase',
      color: ds.text.muted, marginTop: 10,
    },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    currencyPrefix: {
      fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: ds.text.secondary,
    },
    input: {
      flex: 1, height: 44,
      backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.md, borderWidth: 1, borderColor: ds.border.subtle,
      paddingHorizontal: 14,
      fontFamily: 'Inter_400Regular', fontSize: 15, color: ds.text.primary,
    },
    textArea: { height: 72, paddingTop: 10, textAlignVertical: 'top' },
    dateRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      height: 44, backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.md, borderWidth: 1, borderColor: ds.border.subtle,
      paddingHorizontal: 14,
    },
    dateText: {
      flex: 1,
      fontFamily: 'Inter_400Regular', fontSize: 15, color: ds.text.primary,
    },
    typeScroll: { gap: 8, paddingVertical: 2 },
    typeChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderRadius: ds.radius.full, borderWidth: 1,
      paddingHorizontal: 12, paddingVertical: 7,
    },
    typeChipText: {
      fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16,
    },
    ctaBtn: {
      marginTop: 16, height: 52, borderRadius: ds.radius.lg,
      backgroundColor: ds.purple,
      alignItems: 'center', justifyContent: 'center',
    },
    ctaBtnDisabled: { opacity: 0.5 },
    ctaText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#fff' },
  });
}

function makeCalStyles(ds: DSType) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: ds.surface.elevated, borderRadius: ds.radius.lg, padding: 12, marginTop: 8,
    },
    nav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
    },
    navBtn: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: ds.surface.highest, alignItems: 'center', justifyContent: 'center',
    },
    navLabel: {
      fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: ds.text.primary,
    },
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

// ── Inline Calendar ───────────────────────────────────────────────────────────

function InlineCalendar({ value, onSelect }: { value: Date; onSelect: (d: Date) => void }) {
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
          const sel =
            day === value.getDate() &&
            viewMonth === value.getMonth() &&
            viewYear === value.getFullYear();
          const isToday =
            day === today.getDate() &&
            viewMonth === today.getMonth() &&
            viewYear === today.getFullYear();
          return (
            <TouchableOpacity
              key={day}
              style={[cal.cell, sel && cal.selectedCell]}
              onPress={() => onSelect(new Date(viewYear, viewMonth, day))}
              activeOpacity={0.7}
            >
              <Text style={[cal.dayText, isToday && !sel && cal.todayText, sel && cal.selectedText]}>
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── InvestmentRow ─────────────────────────────────────────────────────────────

const ROW_HEIGHT = 72;

function InvestmentRow({
  investment,
  currencySymbol,
  onDelete,
}: {
  investment: Investment;
  currencySymbol: string;
  onDelete: () => void;
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
          style={[s.deleteAction]}
          onPress={() => { swipeRef.current?.close(); onDelete(); }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRight}
      overshootRight={false}
      friction={2}
    >
      <View style={s.invRow}>
        <View style={[s.invIcon, { backgroundColor: hexToRgba(meta.color, 0.15) }]}>
          <MaterialCommunityIcons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={s.invInfo}>
          <Text style={s.invName} numberOfLines={1}>{investment.asset_name}</Text>
          <View style={[s.typeBadge, { backgroundColor: hexToRgba(meta.color, 0.12) }]}>
            <Text style={[s.typeBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <View style={s.invRight}>
          <Text style={s.invAmount}>
            {currencySymbol}{formatBal(investment.amount_invested)}
          </Text>
          <Text style={s.invDate}>{formatDateLocal(investment.investment_date)}</Text>
        </View>
      </View>
    </Swipeable>
  );
}

// ── Section type ─────────────────────────────────────────────────────────────

interface InvSection {
  title: string;
  type: AssetType;
  total: number;
  data: Investment[];
}

// ── InvestmentsScreen ─────────────────────────────────────────────────────────

export default function InvestmentsScreen() {
  const ds = useDS();
  const s = useMemo(() => makeStyles(ds), [ds]);
  const ASSET_META = useMemo(() => makeAssetMeta(ds), [ds]);
  const navigation = useNavigation();

  const insets = useSafeAreaInsets();
  const { investments, totalInvested, summaryByType, isLoading, loadFromDB, addInvestment, deleteInvestment } = useInvestmentsStore();
  const { currencySymbol } = useSettingsStore();

  const [showAdd, setShowAdd] = useState(false);

  // Form state
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('stocks');
  const [amount,    setAmount]    = useState('');
  const [date,      setDate]      = useState(new Date());
  const [notes,     setNotes]     = useState('');
  const [showCal,   setShowCal]   = useState(false);
  const [saving,    setSaving]    = useState(false);

  useFocusEffect(useCallback(() => { loadFromDB(); }, [loadFromDB]));

  // ── Sections ────────────────────────────────────────────────────────────────

  const sections = useMemo<InvSection[]>(() => {
    const grouped: Partial<Record<AssetType, Investment[]>> = {};
    for (const inv of investments) {
      if (!grouped[inv.asset_type]) grouped[inv.asset_type] = [];
      grouped[inv.asset_type]!.push(inv);
    }
    return Object.entries(grouped)
      .map(([type, data]) => ({
        title: ASSET_META[type as AssetType].label,
        type: type as AssetType,
        total: (data ?? []).reduce((s, i) => s + i.amount_invested, 0),
        data: data ?? [],
      }))
      .sort((a, b) => b.total - a.total);
  }, [investments, ASSET_META]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setAssetName(''); setAssetType('stocks'); setAmount('');
    setDate(new Date()); setNotes(''); setShowCal(false);
  };

  const handleAdd = async () => {
    if (!assetName.trim()) { Alert.alert('Asset name required'); return; }
    const paise = Math.round(parseFloat(amount) * 100);
    if (!amount.trim() || isNaN(paise) || paise <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number');
      return;
    }
    setSaving(true);
    try {
      await addInvestment({
        asset_name: assetName.trim(),
        asset_type: assetType,
        amount_invested: paise,
        investment_date: toDateStr(date),
        notes: notes.trim() || null,
      } as CreateInvestmentInput);
      setShowAdd(false);
      resetForm();
    } catch {
      Alert.alert('Error', 'Could not save investment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (inv: Investment) => {
    Alert.alert(
      'Delete investment?',
      `Remove ${inv.asset_name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteInvestment(inv.id) },
      ]
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      <BrandHeader onBack={() => navigation.goBack()} />

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
            {/* Hero card */}
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

            {/* Empty state */}
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
              onDelete={() => handleDelete(item)}
            />
          </View>
        )}
        SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
        ItemSeparatorComponent={() => (
          <View style={s.itemDivider} />
        )}
      />

      {/* ── FAB ── */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 72 }]}
        onPress={() => setShowAdd(true)}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── Add Investment Sheet ── */}
      <BottomSheet
        visible={showAdd}
        onClose={() => { setShowAdd(false); resetForm(); }}
        title="Add Investment"
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={s.sheetContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Asset name */}
            <Text style={s.fieldLabel}>Asset name *</Text>
            <TextInput
              style={s.input}
              value={assetName}
              onChangeText={setAssetName}
              placeholder="e.g. Nifty 50 Index Fund"
              placeholderTextColor={ds.text.muted}
              autoFocus
            />

            {/* Asset type */}
            <Text style={s.fieldLabel}>Asset type *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.typeScroll}
            >
              {ASSET_TYPES.map(t => {
                const meta = ASSET_META[t];
                const selected = assetType === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      s.typeChip,
                      selected
                        ? { backgroundColor: meta.color, borderColor: meta.color }
                        : { backgroundColor: hexToRgba(meta.color, 0.08), borderColor: hexToRgba(meta.color, 0.3) },
                    ]}
                    onPress={() => setAssetType(t)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name={meta.icon}
                      size={14}
                      color={selected ? '#fff' : meta.color}
                    />
                    <Text style={[s.typeChipText, { color: selected ? '#fff' : meta.color }]}>
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Amount */}
            <Text style={s.fieldLabel}>Amount invested *</Text>
            <View style={s.inputRow}>
              <Text style={s.currencyPrefix}>{currencySymbol}</Text>
              <TextInput
                style={s.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={ds.text.muted}
              />
            </View>

            {/* Date */}
            <Text style={s.fieldLabel}>Investment date</Text>
            <TouchableOpacity
              style={s.dateRow}
              onPress={() => setShowCal(c => !c)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="calendar" size={18} color={ds.text.muted} />
              <Text style={s.dateText}>
                {toDateStr(date) === toDateStr(new Date()) ? 'Today' : formatDateLocal(toDateStr(date))}
              </Text>
              <MaterialCommunityIcons name={showCal ? 'chevron-up' : 'chevron-down'} size={18} color={ds.text.muted} />
            </TouchableOpacity>
            {showCal && (
              <InlineCalendar
                value={date}
                onSelect={(d) => { setDate(d); setShowCal(false); }}
              />
            )}

            {/* Notes */}
            <Text style={s.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. SIP auto-debit"
              placeholderTextColor={ds.text.muted}
              multiline
              numberOfLines={2}
            />

            <TouchableOpacity
              style={[s.ctaBtn, saving && s.ctaBtnDisabled]}
              onPress={handleAdd}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={s.ctaText}>{saving ? 'Saving…' : 'Add Investment'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheet>
    </View>
  );
}
