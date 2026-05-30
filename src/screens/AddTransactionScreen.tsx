import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';
import { hexToRgba } from '../utils/color';
import { useCategoriesStore } from '../store/categoriesStore';
import { useAccountsStore } from '../store/accountsStore';
import { useTransactionsStore } from '../store/transactionsStore';
import { useRecurringStore } from '../store/recurringStore';
import { useSettingsStore } from '../store/settingsStore';
import { Category, RecurrenceFrequency, RootStackParamList } from '../types';
import BottomSheet from '../components/BottomSheet';

type Nav = StackNavigationProp<RootStackParamList, 'AddTransaction'>;
type Route = RouteProp<RootStackParamList, 'AddTransaction'>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Styles factory ────────────────────────────────────────────────────────────

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: ds.surface.screen,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: ds.border.subtle,
      backgroundColor: ds.surface.screen,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontFamily: 'Inter_600SemiBold',
      fontSize: 18,
      lineHeight: 24,
      color: ds.text.primary,
    },
    closeBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Scroll
    scroll: { flex: 1 },
    scrollContent: { padding: 16, gap: 20 },

    // Type tabs
    typeTabs: {
      flexDirection: 'row',
      gap: 10,
    },
    typeTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 48,
      borderRadius: ds.radius.lg,
      borderWidth: 1.5,
      backgroundColor: ds.surface.elevated,
    },
    typeTabText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      lineHeight: 20,
      color: ds.text.muted,
    },

    // Amount
    amountSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      gap: 4,
    },
    currencySymbol: {
      fontFamily: 'Inter_700Bold',
      fontSize: 40,
      lineHeight: 48,
      letterSpacing: -1.2,
      alignSelf: 'flex-start',
      marginTop: 6,
    },
    amountInput: {
      fontFamily: 'Inter_700Bold',
      fontSize: 56,
      lineHeight: 64,
      letterSpacing: -2.24,
      minWidth: 80,
      maxWidth: '85%',
      padding: 0,
      includeFontPadding: false,
    },

    // Error
    errorText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 16,
      color: ds.secondaryLight,
      marginTop: -8,
    },

    // Section
    section: { gap: 8 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: ds.text.muted,
    },
    optionalTag: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: ds.text.muted,
      textTransform: 'none',
      letterSpacing: 0,
    },
    emptyHint: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: ds.text.muted,
      paddingVertical: 8,
    },

    // Category sheet list
    categorySheetBody: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 6 },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: ds.radius.lg,
      backgroundColor: ds.surface.elevated,
      borderWidth: 1,
      borderColor: ds.border.subtle,
    },
    categoryRowSelected: {
      borderColor: ds.primary,
      backgroundColor: hexToRgba(ds.primary, 0.08),
    },
    categoryRowIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryRowName: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      lineHeight: 20,
      color: ds.text.primary,
    },

    // Details card
    detailsCard: {
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.xl,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      overflow: 'hidden',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    detailIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailContent: { flex: 1 },
    detailLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 16,
      color: ds.text.muted,
      marginBottom: 2,
    },
    detailValue: {
      fontFamily: 'Inter_500Medium',
      fontSize: 15,
      lineHeight: 20,
      color: ds.text.primary,
    },
    detailPlaceholder: { color: ds.text.muted },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: ds.border.subtle,
      marginLeft: 64,
    },

    // Text inputs
    inputWrap: {
      backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.md,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      paddingHorizontal: 14,
      minHeight: 48,
      justifyContent: 'center',
    },
    notesWrap: {
      minHeight: 88,
      paddingVertical: 10,
      justifyContent: 'flex-start',
    },
    textInput: {
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      lineHeight: 22,
      color: ds.text.primary,
      padding: 0,
    },
    notesInput: {
      minHeight: 68,
    },

    // Footer / save button
    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: ds.border.subtle,
      backgroundColor: ds.surface.screen,
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 54,
      borderRadius: ds.radius.md,
    },
    saveBtnText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 17,
      lineHeight: 22,
      color: '#fff',
    },

    // Date sheet
    dateSheetBody: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
    dateChips: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    dateChip: {
      flex: 1,
      height: 44,
      borderRadius: ds.radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ds.surface.elevated,
      borderWidth: 1,
      borderColor: ds.border.subtle,
    },
    dateChipActive: { backgroundColor: hexToRgba(ds.primary, 0.18), borderColor: ds.primary },
    dateChipText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      lineHeight: 20,
      color: ds.text.muted,
    },
    dateChipTextActive: { color: ds.primaryLight },
    dayNav: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.lg,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      marginBottom: 8,
      overflow: 'hidden',
    },
    dayNavBtn: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayNavLabel: {
      textAlign: 'center',
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.primary,
    },
    dateConfirmBtn: {
      height: 52,
      borderRadius: ds.radius.md,
      backgroundColor: ds.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    dateConfirmText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 16,
      lineHeight: 22,
      color: '#fff',
    },
    // Calendar
    calendarContainer: { marginBottom: 4 },
    calDowRow: { flexDirection: 'row', marginBottom: 2 },
    calDowCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
    calDowText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      color: ds.text.muted,
    },
    calRow: { flexDirection: 'row', marginBottom: 2 },
    calCell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
    calDayCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calDayText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      color: ds.text.primary,
    },
    calDaySelectedText: { color: '#fff', fontFamily: 'Inter_700Bold' },
    calDayDisabled: { color: ds.text.muted, opacity: 0.4 },
    // Time wheel picker
    timeDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: ds.border.subtle,
      marginTop: 12,
      marginBottom: 8,
    },
    timePickerWrap: {
      alignItems: 'center',
    },

    // Account sheet
    accountSheetBody: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 6 },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: ds.radius.lg,
      backgroundColor: ds.surface.elevated,
      borderWidth: 1,
      borderColor: ds.border.subtle,
    },
    accountRowSelected: {
      borderColor: ds.primary,
      backgroundColor: hexToRgba(ds.primary, 0.08),
    },
    accountRowIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountRowName: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      lineHeight: 20,
      color: ds.text.primary,
    },
    accountRowBal: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
    },

    // Recurring
    recurringRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    freqChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: ds.radius.full,
      borderWidth: 1,
    },
    freqChipText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      lineHeight: 18,
    },
    // Frequency sheet
    freqSheetBody: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 8 },
    freqOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: ds.radius.lg,
      backgroundColor: ds.surface.elevated,
      borderWidth: 1,
      borderColor: ds.border.subtle,
    },
    freqOptionSelected: {
      borderColor: ds.primary,
      backgroundColor: hexToRgba(ds.primary, 0.08),
    },
    freqOptionLabel: {
      flex: 1,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      lineHeight: 20,
      color: ds.text.primary,
    },
    freqOptionSub: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 16,
      color: ds.text.muted,
      marginTop: 2,
    },

    // Success overlay
    successOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.75)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
    },
    successCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: ds.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: ds.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 24,
      elevation: 12,
    },
    successText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 24,
      lineHeight: 32,
      color: '#fff',
      letterSpacing: -0.5,
    },
  });
}

// ── Category picker sheet ─────────────────────────────────────────────────────

interface CategorySheetProps {
  visible: boolean;
  onClose: () => void;
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function CategorySheet({ visible, onClose, categories, selectedId, onSelect }: CategorySheetProps) {
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select Category">
      <View style={styles.categorySheetBody}>
        {categories.map((cat) => {
          const isSelected = cat.id === selectedId;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryRow, isSelected && styles.categoryRowSelected]}
              onPress={() => { onSelect(cat.id); onClose(); }}
              activeOpacity={0.75}
            >
              <View style={[styles.categoryRowIcon, { backgroundColor: hexToRgba(cat.color, isSelected ? 0.25 : 0.12) }]}>
                <MaterialCommunityIcons
                  name={cat.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
                  size={20}
                  color={cat.color}
                />
              </View>
              <Text style={[styles.categoryRowName, isSelected && { color: cat.color }]}>{cat.name}</Text>
              {isSelected && (
                <MaterialCommunityIcons name="check-circle" size={20} color={ds.primary} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
}

// ── Date & time picker sheet ──────────────────────────────────────────────────

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW_LABELS = ['M','T','W','T','F','S','S'];
// ── Calendar helpers ──────────────────────────────────────────────────────────

function generateCalDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0
  const days: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= lastDate; d++) days.push(new Date(year, month, d));
  return days;
}

// ── Time wheel picker ─────────────────────────────────────────────────────────

const WHEEL_ITEM_H = 44;
const WHEEL_VISIBLE = 3;
const WHEEL_PAD = Math.floor(WHEEL_VISIBLE / 2);

interface WheelPickerProps {
  items: string[];
  initialIndex: number;
  onSelect: (idx: number) => void;
  width: number;
  accentColor: string;
}

function WheelPicker({ items, initialIndex, onSelect, width, accentColor }: WheelPickerProps) {
  const ds = useDS();
  const scrollRef = useRef<ScrollView>(null);
  const [displayIdx, setDisplayIdx] = useState(initialIndex);
  const didMount = useRef(false);

  useEffect(() => {
    const offset = initialIndex * WHEEL_ITEM_H;
    setDisplayIdx(initialIndex);
    if (!didMount.current) {
      didMount.current = true;
      const t = setTimeout(() => scrollRef.current?.scrollTo({ y: offset, animated: false }), 80);
      return () => clearTimeout(t);
    }
    scrollRef.current?.scrollTo({ y: offset, animated: false });
  }, [initialIndex]);

  return (
    <View style={{ width, height: WHEEL_ITEM_H * WHEEL_VISIBLE, overflow: 'hidden' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: WHEEL_ITEM_H * WHEEL_PAD,
          left: 2,
          right: 2,
          height: WHEEL_ITEM_H,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: accentColor,
        }}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: WHEEL_ITEM_H * WHEEL_PAD }}
        onMomentumScrollEnd={(e) => {
          const rawIdx = Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM_H);
          const idx = Math.max(0, Math.min(rawIdx, items.length - 1));
          setDisplayIdx(idx);
          onSelect(idx);
        }}
      >
        {items.map((item, i) => {
          const isSel = i === displayIdx;
          return (
            <View key={i} style={{ height: WHEEL_ITEM_H, alignItems: 'center', justifyContent: 'center', width }}>
              <Text style={{
                fontFamily: isSel ? 'Inter_700Bold' : 'Inter_400Regular',
                fontSize: isSel ? 20 : 16,
                color: isSel ? accentColor : ds.text.muted,
              }}>
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface TimeWheelPickerProps {
  date: Date;
  onChange: (d: Date) => void;
  accentColor?: string;
}

function TimeWheelPicker({ date, onChange, accentColor }: TimeWheelPickerProps) {
  const ds = useDS();
  const color = accentColor ?? ds.primary;

  const hours12 = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')), []);
  const minutes60 = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')), []);
  const ampmItems = ['AM', 'PM'];

  const h24 = date.getHours();
  const hourIdx = h24 % 12 === 0 ? 11 : (h24 % 12) - 1;
  const minIdx = date.getMinutes();
  const ampmIdx = h24 >= 12 ? 1 : 0;

  const applyChange = (hIdx: number, mIdx: number, apIdx: number) => {
    const nd = new Date(date);
    let h = hIdx + 1;
    if (apIdx === 1) { h = h === 12 ? 12 : h + 12; }
    else { h = h === 12 ? 0 : h; }
    nd.setHours(h, mIdx, 0, 0);
    onChange(nd);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      <WheelPicker items={hours12} initialIndex={hourIdx} onSelect={(i) => applyChange(i, minIdx, ampmIdx)} width={64} accentColor={color} />
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: ds.text.muted, marginHorizontal: 4 }}>:</Text>
      <WheelPicker items={minutes60} initialIndex={minIdx} onSelect={(i) => applyChange(hourIdx, i, ampmIdx)} width={64} accentColor={color} />
      <View style={{ width: 12 }} />
      <WheelPicker items={ampmItems} initialIndex={ampmIdx} onSelect={(i) => applyChange(hourIdx, minIdx, i)} width={56} accentColor={color} />
    </View>
  );
}

interface DateSheetProps {
  visible: boolean;
  onClose: () => void;
  date: Date;
  onChange: (d: Date) => void;
  accentColor?: string;
  allowFuture?: boolean;
}

function DateSheet({ visible, onClose, date, onChange, accentColor, allowFuture = false }: DateSheetProps) {
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);
  const color = accentColor ?? ds.primary;

  const [local, setLocal] = useState(() => new Date(date));
  const [showCalendar, setShowCalendar] = useState(false);
  const [calYear, setCalYear] = useState(date.getFullYear());
  const [calMonth, setCalMonth] = useState(date.getMonth());

  useEffect(() => {
    if (visible) {
      const d = new Date(date);
      setLocal(d);
      setCalYear(d.getFullYear());
      setCalMonth(d.getMonth());
      setShowCalendar(false);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(23, 59, 59, 999);
    return t;
  }, []);

  const shiftDay = (delta: number) => {
    const d = new Date(local);
    d.setDate(d.getDate() + delta);
    if (allowFuture || d <= today) setLocal(d);
  };

  const shiftMonth = (delta: number) => {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    if (!allowFuture) {
      const now = new Date();
      if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth())) return;
    }
    setCalYear(y);
    setCalMonth(m);
  };

  const selectCalDay = (d: Date) => {
    const nd = new Date(local);
    nd.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    setLocal(nd);
    setShowCalendar(false);
  };

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

  const todayMidnight = useMemo(() => { const t = new Date(); t.setHours(0,0,0,0); return t; }, []);
  const yesterday = useMemo(() => { const d = new Date(todayMidnight); d.setDate(d.getDate() - 1); return d; }, [todayMidnight]);

  const canGoNextMonth = useMemo(() => {
    if (allowFuture) return true;
    const now = new Date();
    return calYear < now.getFullYear() || (calYear === now.getFullYear() && calMonth < now.getMonth());
  }, [calYear, calMonth, allowFuture]);

  const isAtToday = isSameDay(local, todayMidnight);

  const confirm = () => { onChange(new Date(local)); onClose(); };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Date & Time">
      <ScrollView
        style={{ maxHeight: 520 }}
        contentContainerStyle={styles.dateSheetBody}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Quick chips */}
        <View style={styles.dateChips}>
          {[{ label: 'Yesterday', d: yesterday }, { label: 'Today', d: todayMidnight }].map(({ label, d }) => {
            const active = isSameDay(local, d);
            return (
              <TouchableOpacity
                key={label}
                style={[styles.dateChip, active && styles.dateChipActive]}
                onPress={() => {
                  const nd = new Date(local);
                  nd.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                  setLocal(nd);
                  setShowCalendar(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.dateChipText, active && { color: color }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date nav row — chevrons navigate day or month; centre taps to toggle calendar */}
        <View style={styles.dayNav}>
          <TouchableOpacity
            style={styles.dayNavBtn}
            onPress={showCalendar ? () => shiftMonth(-1) : () => shiftDay(-1)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color={ds.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 }}
            onPress={() => {
              if (!showCalendar) {
                setCalYear(local.getFullYear());
                setCalMonth(local.getMonth());
              }
              setShowCalendar(v => !v);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.dayNavLabel}>
              {showCalendar
                ? `${MONTH_NAMES[calMonth]} ${calYear}`
                : local.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            <MaterialCommunityIcons
              name={showCalendar ? 'chevron-up' : 'calendar-month-outline'}
              size={14}
              color={ds.text.muted}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dayNavBtn}
            onPress={showCalendar ? () => shiftMonth(1) : () => shiftDay(1)}
            disabled={showCalendar ? !canGoNextMonth : isAtToday}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={(showCalendar ? !canGoNextMonth : isAtToday) ? ds.text.muted : ds.text.secondary}
            />
          </TouchableOpacity>
        </View>

        {/* Calendar grid */}
        {showCalendar && (
          <View style={styles.calendarContainer}>
            <View style={styles.calDowRow}>
              {DOW_LABELS.map((d, i) => (
                <View key={i} style={styles.calDowCell}>
                  <Text style={styles.calDowText}>{d}</Text>
                </View>
              ))}
            </View>
            {calRows.map((row, ri) => (
              <View key={ri} style={styles.calRow}>
                {row.map((d, ci) => {
                  if (!d) return <View key={ci} style={styles.calCell} />;
                  const isSel = isSameDay(d, local);
                  const isTod = isSameDay(d, todayMidnight);
                  const isFut = d > todayMidnight;
                  return (
                    <TouchableOpacity
                      key={ci}
                      style={styles.calCell}
                      onPress={() => selectCalDay(d)}
                      disabled={!allowFuture && isFut}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.calDayCircle,
                        isSel && { backgroundColor: color },
                        isTod && !isSel && { borderWidth: 1.5, borderColor: color },
                      ]}>
                        <Text style={[
                          styles.calDayText,
                          isSel && styles.calDaySelectedText,
                          isFut && styles.calDayDisabled,
                          isTod && !isSel && { color },
                        ]}>
                          {d.getDate()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {/* Time picker */}
        <View style={styles.timeDivider} />
        <View style={styles.timePickerWrap}>
          <TimeWheelPicker date={local} onChange={setLocal} accentColor={color} />
        </View>

        <TouchableOpacity style={[styles.dateConfirmBtn, { backgroundColor: color }]} onPress={confirm} activeOpacity={0.85}>
          <Text style={styles.dateConfirmText}>Confirm</Text>
        </TouchableOpacity>
      </ScrollView>
    </BottomSheet>
  );
}

// ── Frequency picker sheet ────────────────────────────────────────────────────

const FREQ_OPTIONS: { value: RecurrenceFrequency; label: string; sub: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { value: 'daily',   label: 'Daily',   sub: 'Every day',          icon: 'calendar-today' },
  { value: 'weekly',  label: 'Weekly',  sub: 'Every 7 days',       icon: 'calendar-week' },
  { value: 'monthly', label: 'Monthly', sub: 'Same day each month', icon: 'calendar-month' },
  { value: 'yearly',  label: 'Yearly',  sub: 'Same date each year', icon: 'calendar-star' },
];

interface FrequencySheetProps {
  visible: boolean;
  onClose: () => void;
  selected: RecurrenceFrequency;
  onSelect: (f: RecurrenceFrequency) => void;
  accentColor?: string;
}

function FrequencySheet({ visible, onClose, selected, onSelect, accentColor }: FrequencySheetProps) {
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);
  const color = accentColor ?? ds.primary;
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Repeat Frequency">
      <View style={styles.freqSheetBody}>
        {FREQ_OPTIONS.map(opt => {
          const isSelected = opt.value === selected;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.freqOption, isSelected && styles.freqOptionSelected]}
              onPress={() => { onSelect(opt.value); onClose(); }}
              activeOpacity={0.75}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: hexToRgba(color, 0.12) }}>
                <MaterialCommunityIcons name={opt.icon} size={20} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.freqOptionLabel, isSelected && { color }]}>{opt.label}</Text>
                <Text style={styles.freqOptionSub}>{opt.sub}</Text>
              </View>
              {isSelected && <MaterialCommunityIcons name="check-circle" size={20} color={color} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
}

// ── Account picker sheet ──────────────────────────────────────────────────────

interface AccountSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function AccountSheet({ visible, onClose, selectedId, onSelect }: AccountSheetProps) {
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);
  const { accounts } = useAccountsStore();
  const { currencySymbol } = useSettingsStore();
  const active = accounts.filter((a) => !a.is_archived);

  const ACCOUNT_ICONS: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
    bank: 'bank', cash: 'cash', wallet: 'wallet', credit: 'credit-card', other: 'shape-outline',
  };
  const ACCOUNT_COLORS: Record<string, string> = {
    bank: ds.primary, cash: ds.primaryLight, wallet: ds.tertiary, credit: ds.secondary, other: ds.purple,
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select Account">
      <View style={styles.accountSheetBody}>
        {active.map((a) => {
          const icon = ACCOUNT_ICONS[a.type] ?? 'bank';
          const color = ACCOUNT_COLORS[a.type] ?? ds.primary;
          const isSelected = a.id === selectedId;
          const bal = (Math.abs(a.balance) / 100).toLocaleString('en-IN', {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
          });
          return (
            <TouchableOpacity
              key={a.id}
              style={[styles.accountRow, isSelected && styles.accountRowSelected]}
              onPress={() => { onSelect(a.id); onClose(); }}
              activeOpacity={0.75}
            >
              <View style={[styles.accountRowIcon, { backgroundColor: hexToRgba(color, 0.15) }]}>
                <MaterialCommunityIcons name={icon} size={20} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountRowName}>{a.name}</Text>
                <Text style={styles.accountRowBal}>{currencySymbol}{bal}</Text>
              </View>
              {isSelected && (
                <MaterialCommunityIcons name="check-circle" size={20} color={ds.primary} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
}

// ── Success overlay ───────────────────────────────────────────────────────────

function SuccessOverlay({ visible }: { visible: boolean }) {
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          damping: 14,
          stiffness: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.successOverlay, { opacity }]}>
      <Animated.View style={[styles.successCircle, { transform: [{ scale }] }]}>
        <MaterialCommunityIcons name="check" size={48} color="#fff" />
      </Animated.View>
      <Text style={styles.successText}>Saved!</Text>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────


export default function AddTransactionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);

  const { incomeCategories, expenseCategories, loadFromDB: loadCats } = useCategoriesStore();
  const { accounts, loadFromDB: loadAccounts } = useAccountsStore();
  const { addTransaction, updateTransaction } = useTransactionsStore();
  const { addRecurring, processDue } = useRecurringStore();
  const { currencySymbol } = useSettingsStore();

  const editTx = route.params?.editTx;
  const isEditing = editTx != null;
  const defaultType = route.params?.defaultType ?? 'expense';

  const [txType, setTxType] = useState<'income' | 'expense'>(() => {
    if (editTx?.type === 'income') return 'income';
    if (editTx?.type === 'expense') return 'expense';
    return defaultType;
  });
  const [amount, setAmount] = useState(() =>
    editTx ? String(editTx.amount / 100) : ''
  );
  const [categoryId, setCategoryId] = useState<string | null>(() => editTx?.category_id ?? null);
  const [accountId, setAccountId]   = useState<string | null>(() => editTx?.account_id ?? null);
  const [date, setDate] = useState<Date>(() => {
    if (editTx?.transaction_date) {
      const [y, m, d] = editTx.transaction_date.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      if (editTx.transaction_time) {
        const [h, min] = editTx.transaction_time.split(':').map(Number);
        dt.setHours(h, min, 0, 0);
      }
      return dt;
    }
    return new Date();
  });
  const [description, setDescription] = useState(() => editTx?.description ?? '');
  const [notes, setNotes]             = useState(() => editTx?.notes ?? '');
  const [tag, setTag]                 = useState(() => editTx?.tag ?? '');

  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');

  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen]       = useState(false);
  const [freqSheetOpen, setFreqSheetOpen]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [amountError, setAmountError]     = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [accountError, setAccountError]   = useState('');

  const amountRef = useRef<TextInput>(null);

  // ── Load data & set defaults ──────────────────────────────────────────────

  useEffect(() => {
    loadCats();
    loadAccounts();
  }, [loadCats, loadAccounts]);

  // Default account = first active (only when NOT editing — edit tx has its own account)
  useEffect(() => {
    if (accountId == null && !isEditing) {
      const first = accounts.find((a) => !a.is_archived);
      if (first) setAccountId(first.id);
    }
  }, [accounts, accountId, isEditing]);

  // Reset category when type switches
  const handleTypeSwitch = useCallback((t: 'income' | 'expense') => {
    setTxType(t);
    setCategoryId(null);
    setCategoryError('');
    if (t !== 'expense') setTag('');
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────

  const typeColor = txType === 'income' ? ds.primary : ds.secondary;
  const typeColorLight = txType === 'income' ? ds.primaryLight : ds.secondaryLight;
  const categories = txType === 'income' ? incomeCategories : expenseCategories;

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedCategory = categories.find((c) => c.id === categoryId);

  // ── Validation & save ─────────────────────────────────────────────────────

  const validate = (): boolean => {
    let ok = true;
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setAmountError('Enter an amount greater than 0.');
      ok = false;
    } else {
      setAmountError('');
    }
    if (!categoryId) {
      setCategoryError('Pick a category.');
      ok = false;
    } else {
      setCategoryError('');
    }
    if (!accountId) {
      setAccountError('Select an account.');
      ok = false;
    } else {
      setAccountError('');
    }
    return ok;
  };

  const handleSave = async () => {
    if (!validate() || saving) return;
    setSaving(true);
    try {
      const amountPaise = Math.round(parseFloat(amount) * 100);
      const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

      if (isRecurring && !isEditing) {
        await addRecurring({
          type: txType,
          amount: amountPaise,
          account_id: accountId!,
          category_id: categoryId,
          description: description.trim() || null,
          notes: notes.trim() || null,
          frequency,
          start_date: toISODate(date),
          time_of_day: timeStr,
        });
        await processDue();
      } else {
        const payload = {
          type: txType,
          amount: amountPaise,
          account_id: accountId!,
          category_id: categoryId,
          transaction_date: toISODate(date),
          transaction_time: timeStr,
          description: description.trim() || null,
          notes: notes.trim() || null,
          tag: txType === 'expense' ? (tag.trim() || null) : null,
        };
        if (isEditing) {
          await updateTransaction(editTx!.id, payload);
        } else {
          await addTransaction(payload);
        }
      }
      setShowSuccess(true);
      setTimeout(() => navigation.goBack(), 700);
    } catch {
      setSaving(false);
    }
  };

  // ── Amount change — strip non-numeric except one dot ─────────────────────

  const handleAmountChange = (raw: string) => {
    // Allow digits and a single decimal point
    const cleaned = raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setAmount(cleaned);
    if (amountError && parseFloat(cleaned) > 0) setAmountError('');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="close" size={24} color={ds.text.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Transaction' : 'Add Transaction'}</Text>
        <View style={styles.closeBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 16 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Type tabs ── */}
          <View style={styles.typeTabs}>
            {(['expense', 'income'] as const).map((t) => {
              const active = txType === t;
              const tColor = t === 'income' ? ds.primary : ds.secondary;
              const tColorLight = t === 'income' ? ds.primaryLight : ds.secondaryLight;
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeTab,
                    active
                      ? { backgroundColor: hexToRgba(tColor, 0.18), borderColor: tColor }
                      : { borderColor: ds.border.subtle },
                  ]}
                  onPress={() => handleTypeSwitch(t)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={t === 'income' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                    size={18}
                    color={active ? tColorLight : ds.text.muted}
                  />
                  <Text style={[styles.typeTabText, active && { color: tColorLight }]}>
                    {t === 'income' ? 'Income' : 'Expense'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Amount ── */}
          <TouchableOpacity
            style={styles.amountSection}
            activeOpacity={1}
            onPress={() => amountRef.current?.focus()}
          >
            <Text style={[styles.currencySymbol, { color: typeColor }]}>{currencySymbol}</Text>
            <TextInput
              ref={amountRef}
              style={[styles.amountInput, { color: amount ? typeColorLight : ds.text.muted }]}
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              autoFocus
              placeholder="0"
              placeholderTextColor={ds.text.muted}
              selectionColor={typeColor}
              returnKeyType="done"
            />
          </TouchableOpacity>
          {amountError ? (
            <Text style={[styles.errorText, { textAlign: 'center' }]}>{amountError}</Text>
          ) : null}

          {/* ── Details rows ── */}
          <View style={styles.detailsCard}>
            {/* Category */}
            <TouchableOpacity
              style={styles.detailRow}
              onPress={() => setCategorySheetOpen(true)}
              activeOpacity={0.75}
            >
              <View style={[styles.detailIcon, { backgroundColor: selectedCategory ? hexToRgba(selectedCategory.color, 0.15) : hexToRgba(ds.purple, 0.12) }]}>
                <MaterialCommunityIcons
                  name={selectedCategory ? (selectedCategory.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']) : 'shape-outline'}
                  size={18}
                  color={selectedCategory ? selectedCategory.color : ds.purple}
                />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Category{categoryError ? <Text style={styles.errorText}>  {categoryError}</Text> : null}</Text>
                <Text style={[styles.detailValue, !selectedCategory && styles.detailPlaceholder]}>
                  {selectedCategory?.name ?? 'Select category'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={ds.text.muted} />
            </TouchableOpacity>

            <View style={styles.divider} />
            {/* Account */}
            <TouchableOpacity
              style={styles.detailRow}
              onPress={() => setAccountSheetOpen(true)}
              activeOpacity={0.75}
            >
              <View style={[styles.detailIcon, { backgroundColor: hexToRgba(ds.primary, 0.12) }]}>
                <MaterialCommunityIcons name="bank-outline" size={18} color={ds.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Account</Text>
                <Text style={[styles.detailValue, !selectedAccount && styles.detailPlaceholder]}>
                  {selectedAccount?.name ?? 'Select account'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={ds.text.muted} />
            </TouchableOpacity>
            {accountError ? <Text style={[styles.errorText, { marginLeft: 52, marginBottom: 8 }]}>{accountError}</Text> : null}

            <View style={styles.divider} />

            {/* Date */}
            <TouchableOpacity
              style={styles.detailRow}
              onPress={() => setDateSheetOpen(true)}
              activeOpacity={0.75}
            >
              <View style={[styles.detailIcon, { backgroundColor: hexToRgba(ds.tertiary, 0.12) }]}>
                <MaterialCommunityIcons name="calendar-outline" size={18} color={ds.tertiary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date & Time</Text>
                <Text style={styles.detailValue}>
                  {formatDateLabel(date)}
                  {!isSameDay(date, new Date()) && ` · ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                  {`  ${String(date.getHours() % 12 || 12).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} ${date.getHours() >= 12 ? 'PM' : 'AM'}`}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={ds.text.muted} />
            </TouchableOpacity>
            <View style={styles.divider} />

            {/* Recurring */}
            {!isEditing && (
              <View style={styles.recurringRow}>
                <View style={[styles.detailIcon, { backgroundColor: hexToRgba(ds.purple, 0.12) }]}>
                  <MaterialCommunityIcons name="repeat" size={18} color={ds.purple} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Recurring</Text>
                  {isRecurring ? (
                    <TouchableOpacity
                      style={[styles.freqChip, { borderColor: typeColor, backgroundColor: hexToRgba(typeColor, 0.1) }]}
                      onPress={() => setFreqSheetOpen(true)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="chevron-down" size={14} color={typeColorLight} />
                      <Text style={[styles.freqChipText, { color: typeColorLight }]}>
                        {FREQ_OPTIONS.find(f => f.value === frequency)?.label ?? 'Monthly'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.detailValue}>Off</Text>
                  )}
                </View>
                <Switch
                  value={isRecurring}
                  onValueChange={setIsRecurring}
                  trackColor={{ false: ds.border.subtle, true: hexToRgba(typeColor, 0.45) }}
                  thumbColor={isRecurring ? typeColor : ds.text.muted}
                />
              </View>
            )}
          </View>

          {/* ── Description ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.textInput}
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. Swiggy order, EMI payment…"
                placeholderTextColor={ds.text.muted}
                selectionColor={ds.primary}
                returnKeyType="next"
                maxLength={120}
              />
            </View>
          </View>

          {/* ── Notes ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes <Text style={styles.optionalTag}>(optional)</Text></Text>
            <View style={[styles.inputWrap, styles.notesWrap]}>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any extra details…"
                placeholderTextColor={ds.text.muted}
                selectionColor={ds.primary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={500}
              />
            </View>
          </View>

          {/* ── Tag (expense only) ── */}
          {txType === 'expense' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Tag <Text style={styles.optionalTag}>(optional)</Text></Text>
              </View>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.textInput}
                  value={tag}
                  onChangeText={setTag}
                  placeholder="e.g. split, reimbursable, work…"
                  placeholderTextColor={ds.text.muted}
                  selectionColor={ds.secondary}
                  returnKeyType="done"
                  maxLength={40}
                  autoCapitalize="none"
                />
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── CTA ── */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: typeColor },
              saving && { opacity: 0.6 },
            ]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#fff" />
            <Text style={styles.saveBtnText}>
              {saving
                ? 'Saving…'
                : isEditing
                  ? `Update ${txType === 'income' ? 'Income' : 'Expense'}`
                  : isRecurring
                    ? `Set Up Recurring`
                    : `Add ${txType === 'income' ? 'Income' : 'Expense'}`}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Bottom sheets ── */}
      <AccountSheet
        visible={accountSheetOpen}
        onClose={() => setAccountSheetOpen(false)}
        selectedId={accountId}
        onSelect={setAccountId}
      />
      <DateSheet
        visible={dateSheetOpen}
        onClose={() => setDateSheetOpen(false)}
        date={date}
        onChange={setDate}
        accentColor={typeColor}
        allowFuture={isRecurring}
      />
      <FrequencySheet
        visible={freqSheetOpen}
        onClose={() => setFreqSheetOpen(false)}
        selected={frequency}
        onSelect={setFrequency}
        accentColor={typeColor}
      />
      <CategorySheet
        visible={categorySheetOpen}
        onClose={() => setCategorySheetOpen(false)}
        categories={categories}
        selectedId={categoryId}
        onSelect={(id) => { setCategoryId(id); setCategoryError(''); }}
      />

      {/* ── Success overlay ── */}
      <SuccessOverlay visible={showSuccess} />
    </View>
  );
}
