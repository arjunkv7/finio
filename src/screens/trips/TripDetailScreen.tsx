import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { DSType } from '../../constants/colors';
import { hexToRgba } from '../../utils/color';
import { useDS } from '../../hooks/useDS';
import { useTripsStore } from '../../store/tripsStore';
import { useCategoriesStore } from '../../store/categoriesStore';
import { useSettingsStore } from '../../store/settingsStore';
import BottomSheet from '../../components/BottomSheet';
import { TripExpense, TripParticipant } from '../../types/db';
import { TripsStackParamList } from '../../types';

type Nav = StackNavigationProp<TripsStackParamList, 'TripDetail'>;
type Route = RouteProp<TripsStackParamList, 'TripDetail'>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  '#10B981', '#F43F5E', '#F59E0B', '#9C7EF0',
  '#3B82F6', '#EC4899', '#14B8A6', '#F97316',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return '';
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

const SPLIT_ICONS: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  equal: 'equal',
  custom: 'format-list-numbered',
  percentage: 'percent',
};

// ── Add Participant Sheet ─────────────────────────────────────────────────────

interface AddParticipantSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (names: string[]) => Promise<void>;
}

function makePsStyles(ds: DSType) {
  return StyleSheet.create({
    body: { padding: 20, gap: 12 },
    inputRow: {
      flexDirection: 'row',
      gap: 8,
    },
    inputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.md,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      paddingHorizontal: 12,
      height: 50,
      gap: 8,
    },
    inputWrapError: { borderColor: ds.secondary },
    input: {
      flex: 1,
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      lineHeight: 22,
      color: ds.text.primary,
      padding: 0,
    },
    addChipBtn: {
      height: 50,
      paddingHorizontal: 14,
      borderRadius: ds.radius.md,
      backgroundColor: hexToRgba(ds.primary, 0.15),
      alignItems: 'center',
      justifyContent: 'center',
    },
    addChipBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      lineHeight: 20,
      color: ds.primaryLight,
    },
    error: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 16,
      color: ds.secondaryLight,
    },
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: ds.radius.full,
      backgroundColor: hexToRgba(ds.primary, 0.12),
      borderWidth: 1,
      borderColor: hexToRgba(ds.primary, 0.25),
    },
    chipText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      lineHeight: 18,
      color: ds.primaryLight,
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
      borderRadius: ds.radius.md,
      backgroundColor: ds.primary,
      gap: 8,
      marginTop: 4,
    },
    btnText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      lineHeight: 22,
      color: '#fff',
    },
  });
}

function AddParticipantSheet({ visible, onClose, onAdd }: AddParticipantSheetProps) {
  const ds = useDS();
  const ps = useMemo(() => makePsStyles(ds), [ds]);
  const [inputValue, setInputValue] = useState('');
  const [pendingNames, setPendingNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!visible) { setInputValue(''); setPendingNames([]); setError(''); } }, [visible]);

  const addToPending = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    const names = trimmed.split(',').map(n => n.trim()).filter(Boolean);
    setPendingNames(prev => {
      const existing = new Set(prev.map(p => p.toLowerCase()));
      const toAdd = names.filter(n => !existing.has(n.toLowerCase()));
      return [...prev, ...toAdd];
    });
    setInputValue('');
    setError('');
  };

  const removePending = (index: number) => {
    setPendingNames(prev => prev.filter((_, i) => i !== index));
  };

  const handleAdd = async () => {
    const trimmed = inputValue.trim();
    const allNames = [...pendingNames];
    if (trimmed) {
      const extra = trimmed.split(',').map(n => n.trim()).filter(Boolean);
      const existing = new Set(allNames.map(p => p.toLowerCase()));
      extra.forEach(n => { if (!existing.has(n.toLowerCase())) { allNames.push(n); existing.add(n.toLowerCase()); } });
    }
    if (allNames.length === 0) { setError('Enter at least one name.'); return; }
    setSaving(true);
    try {
      await onAdd(allNames);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Participants">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={ps.body}>
          <View style={ps.inputRow}>
            <View style={[ps.inputWrap, error ? ps.inputWrapError : null]}>
              <MaterialCommunityIcons name="account-outline" size={18} color={ds.text.muted} />
              <TextInput
                style={ps.input}
                value={inputValue}
                onChangeText={(v) => { setInputValue(v); if (v.trim()) setError(''); }}
                placeholder="Name or comma-separated names"
                placeholderTextColor={ds.text.muted}
                selectionColor={ds.primary}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={addToPending}
              />
            </View>
            <TouchableOpacity style={ps.addChipBtn} onPress={addToPending} activeOpacity={0.75}>
              <Text style={ps.addChipBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {error ? <Text style={ps.error}>{error}</Text> : null}
          {pendingNames.length > 0 && (
            <View style={ps.chipsWrap}>
              {pendingNames.map((name, i) => (
                <TouchableOpacity key={`${name}-${i}`} style={ps.chip} onPress={() => removePending(i)} activeOpacity={0.75}>
                  <Text style={ps.chipText}>{name}</Text>
                  <MaterialCommunityIcons name="close-circle" size={14} color={ds.primaryLight} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity
            style={[ps.btn, saving && { opacity: 0.6 }]}
            onPress={handleAdd}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : null}
            <Text style={ps.btnText}>
              {saving ? 'Adding…' : pendingNames.length > 0 ? `Add ${pendingNames.length} Participant${pendingNames.length > 1 ? 's' : ''}` : 'Add Participant'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

// ── Expense Row ───────────────────────────────────────────────────────────────

interface ExpenseRowProps {
  expense: TripExpense;
  participants: TripParticipant[];
  currencySymbol: string;
  getCategoryName: (id: string | null) => { name: string; icon: string; color: string } | null;
}

function makeErStyles(ds: DSType) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 0,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: ds.border.subtle,
    },
    catIcon: {
      width: 40,
      height: 40,
      borderRadius: ds.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { flex: 1 },
    desc: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      lineHeight: 20,
      color: ds.text.primary,
      marginBottom: 4,
    },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    paidByChip: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: ds.radius.full,
      backgroundColor: hexToRgba(ds.primary, 0.12),
    },
    paidByText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      lineHeight: 16,
      color: ds.primaryLight,
    },
    splitLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 16,
      color: ds.text.muted,
    },
    amount: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      lineHeight: 22,
      letterSpacing: -0.2,
      color: ds.text.primary,
    },
  });
}

function ExpenseRow({ expense, participants, currencySymbol, getCategoryName }: ExpenseRowProps) {
  const ds = useDS();
  const er = useMemo(() => makeErStyles(ds), [ds]);
  const paidBy = participants.find((p) => p.id === expense.paid_by_participant_id);
  const cat = getCategoryName(expense.category_id);
  const amount = (expense.amount / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const splitIcon = SPLIT_ICONS[expense.split_type] ?? 'equal';

  return (
    <View style={er.row}>
      <View style={[er.catIcon, { backgroundColor: hexToRgba(cat?.color ?? ds.text.muted, 0.15) }]}>
        <MaterialCommunityIcons
          name={(cat?.icon ?? 'receipt') as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
          size={20}
          color={cat?.color ?? ds.text.muted}
        />
      </View>
      <View style={er.body}>
        <Text style={er.desc} numberOfLines={1}>{expense.description ?? cat?.name ?? 'Expense'}</Text>
        <View style={er.meta}>
          <View style={er.paidByChip}>
            <Text style={er.paidByText}>{paidBy?.name ?? '—'}</Text>
          </View>
          <MaterialCommunityIcons name={splitIcon} size={12} color={ds.text.muted} />
          <Text style={er.splitLabel}>{expense.split_type}</Text>
        </View>
      </View>
      <Text style={er.amount}>{currencySymbol}{amount}</Text>
    </View>
  );
}


// ── Main Screen ───────────────────────────────────────────────────────────────

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: ds.surface.screen },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: ds.border.subtle,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 20,
      lineHeight: 28,
      letterSpacing: -0.2,
      color: ds.text.primary,
    },
    headerSub: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
      marginTop: 1,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: ds.radius.full,
      borderWidth: 1,
    },
    statusSettled: {
      backgroundColor: hexToRgba(ds.primary, 0.12),
      borderColor: hexToRgba(ds.primary, 0.3),
    },
    statusPending: {
      backgroundColor: hexToRgba(ds.tertiary, 0.12),
      borderColor: hexToRgba(ds.tertiary, 0.3),
    },
    statusText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      lineHeight: 16,
    },
    statusTextSettled: { color: ds.primaryLight },
    statusTextPending: { color: ds.tertiaryLight },

    scroll: { flex: 1 },
    scrollContent: { paddingTop: 16, paddingHorizontal: 16, gap: 20 },

    totalCard: {
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.xl,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      padding: 20,
      alignItems: 'center',
    },
    totalLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      lineHeight: 16,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: ds.text.muted,
      marginBottom: 6,
    },
    totalAmount: {
      fontFamily: 'Inter_700Bold',
      fontSize: 36,
      lineHeight: 44,
      letterSpacing: -0.72,
      color: ds.text.primary,
    },
    totalSub: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
      marginTop: 4,
    },
    totalDivider: {
      width: '100%',
      height: StyleSheet.hairlineWidth,
      backgroundColor: ds.border.subtle,
      marginVertical: 14,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
    summaryStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    summaryDot: { width: 8, height: 8, borderRadius: 4 },
    summaryStatLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      lineHeight: 14,
      color: ds.text.muted,
      marginBottom: 2,
    },
    summaryStatValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18 },
    summaryDivider: { width: 1, height: 36, backgroundColor: ds.border.subtle, marginHorizontal: 8 },

    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: ds.border.subtle,
    },
    tabBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabBtnActive: { borderBottomColor: ds.primary },
    tabBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      lineHeight: 20,
      color: ds.text.muted,
    },
    tabBtnTextActive: { color: ds.primary },

    settleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: ds.border.subtle,
    },
    settleAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settleAvatarText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      lineHeight: 16,
    },
    settleBody: { flex: 1 },
    settleNames: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      lineHeight: 20,
      color: ds.text.primary,
    },
    settleSub: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 16,
      color: ds.text.muted,
      marginTop: 1,
    },
    settleAmt: {
      fontFamily: 'Inter_700Bold',
      fontSize: 15,
      lineHeight: 20,
      color: ds.tertiaryLight,
    },
    settleAllDone: {
      alignItems: 'center',
      paddingVertical: 32,
      gap: 8,
    },
    settleAllDoneText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      lineHeight: 20,
      color: ds.text.muted,
    },

    section: { gap: 0 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sectionTitle: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: ds.text.muted,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: ds.radius.full,
      backgroundColor: hexToRgba(ds.primary, 0.12),
    },
    addBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      lineHeight: 16,
      color: ds.primaryLight,
    },

    avatarRow: { marginHorizontal: -4 },
    avatarContent: { paddingHorizontal: 4, gap: 12 },
    avatarWrap: { alignItems: 'center', width: 56 },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    avatarInitials: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      lineHeight: 20,
      letterSpacing: -0.3,
    },
    selfDot: {
      position: 'absolute',
      bottom: 1,
      right: 1,
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: ds.surface.screen,
    },
    avatarName: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
      lineHeight: 14,
      color: ds.text.secondary,
      textAlign: 'center',
    },
    emptyHint: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: ds.text.muted,
      padding: 8,
    },

    expenseList: {
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.xl,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      overflow: 'hidden',
    },
    emptyExpenses: {
      alignItems: 'center',
      paddingVertical: 32,
      gap: 8,
    },
    emptyExpensesText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      lineHeight: 20,
      color: ds.text.muted,
      textAlign: 'center',
    },

    actionBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: ds.border.subtle,
      backgroundColor: ds.surface.screen,
    },
    addExpenseBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 52,
      borderRadius: ds.radius.md,
      backgroundColor: ds.primary,
    },
    addExpenseBtnText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      lineHeight: 22,
      color: '#fff',
    },
    settleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 52,
      paddingHorizontal: 16,
      borderRadius: ds.radius.md,
      borderWidth: 1.5,
      borderColor: ds.border.medium,
      backgroundColor: ds.surface.elevated,
    },
    settleBtnActive: {
      borderColor: hexToRgba(ds.primary, 0.4),
      backgroundColor: hexToRgba(ds.primary, 0.08),
    },
    settleBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      lineHeight: 20,
      color: ds.text.muted,
    },
    settleBtnTextActive: { color: ds.primaryLight },
  });
}

export default function TripDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { tripId } = route.params;
  const ds = useDS();
  const s = useMemo(() => makeStyles(ds), [ds]);

  const { activeTrip, refreshActiveTrip, updateTrip, addParticipant } = useTripsStore();
  const { expenseCategories } = useCategoriesStore();
  const { currencySymbol } = useSettingsStore();

  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [settling, setSettling] = useState(false);
  const [activeTab, setActiveTab] = useState<'expenses' | 'settlement'>('expenses');

  useFocusEffect(
    useCallback(() => {
      refreshActiveTrip();
    }, [refreshActiveTrip])
  );

  const getCategoryInfo = useCallback((id: string | null) => {
    if (!id) return null;
    const cat = expenseCategories.find((c) => c.id === id);
    if (!cat) return null;
    return { name: cat.name, icon: cat.icon, color: cat.color };
  }, [expenseCategories]);

  const handleMarkSettled = async () => {
    if (settling || !activeTrip) return;
    setSettling(true);
    try {
      await updateTrip(tripId, { is_settled: activeTrip.trip.is_settled === 1 ? 0 : 1 });
    } finally {
      setSettling(false);
    }
  };

  const handleAddParticipant = useCallback(async (names: string[]) => {
    for (const name of names) {
      await addParticipant({ trip_id: tripId, name });
    }
  }, [addParticipant, tripId]);

  if (!activeTrip || activeTrip.trip.id !== tripId) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={ds.text.primary} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={ds.primary} />
        </View>
      </View>
    );
  }

  const { trip, participants, expenses, total, settlement } = activeTrip;
  const isSettled = trip.is_settled === 1;
  const allSettled = settlement.length === 0;
  const toSettle = settlement.reduce((acc, s) => acc + s.amount, 0);
  const totalDisplay = (total / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const settleDisplay = (toSettle / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={ds.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>{trip.name}</Text>
          {(trip.start_date || trip.end_date) ? (
            <Text style={s.headerSub}>{formatDateRange(trip.start_date, trip.end_date)}</Text>
          ) : null}
        </View>
        <View style={[s.statusBadge, isSettled ? s.statusSettled : s.statusPending]}>
          <Text style={[s.statusText, isSettled ? s.statusTextSettled : s.statusTextPending]}>
            {isSettled ? 'Settled' : 'Active'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 180 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Trip total card ── */}
        <View style={s.totalCard}>
          <Text style={s.totalLabel}>TOTAL TRIP SPEND</Text>
          <Text style={s.totalAmount}>{currencySymbol}{totalDisplay}</Text>
          <Text style={s.totalSub}>{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</Text>
          <View style={s.totalDivider} />
          <View style={s.summaryRow}>
            <View style={s.summaryStat}>
              <View style={[s.summaryDot, { backgroundColor: ds.primary }]} />
              <View>
                <Text style={s.summaryStatLabel}>Expenses</Text>
                <Text style={[s.summaryStatValue, { color: ds.primaryLight }]}>{currencySymbol}{totalDisplay}</Text>
              </View>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryStat}>
              <View style={[s.summaryDot, { backgroundColor: ds.secondary }]} />
              <View>
                <Text style={s.summaryStatLabel}>To Settle</Text>
                <Text style={[s.summaryStatValue, { color: allSettled ? ds.primaryLight : ds.secondaryLight }]}>
                  {allSettled ? 'Cleared' : `${currencySymbol}${settleDisplay}`}
                </Text>
              </View>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryStat}>
              <View style={[s.summaryDot, { backgroundColor: allSettled ? ds.primary : ds.tertiary }]} />
              <View>
                <Text style={s.summaryStatLabel}>Status</Text>
                <Text style={[s.summaryStatValue, { color: allSettled ? ds.primaryLight : ds.tertiaryLight }]}>
                  {allSettled ? 'Settled' : 'Pending'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Participants ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Participants</Text>
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => setAddParticipantOpen(true)}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="account-plus-outline" size={16} color={ds.primary} />
              <Text style={s.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.avatarRow} contentContainerStyle={s.avatarContent}>
            {participants.map((p) => {
              const color = avatarColor(p.name);
              return (
                <View key={p.id} style={s.avatarWrap}>
                  <View style={[s.avatar, { backgroundColor: hexToRgba(color, 0.2), borderColor: hexToRgba(color, 0.4) }]}>
                    <Text style={[s.avatarInitials, { color }]}>{initials(p.name)}</Text>
                    {p.is_self === 1 && (
                      <View style={[s.selfDot, { backgroundColor: color }]} />
                    )}
                  </View>
                  <Text style={s.avatarName} numberOfLines={1}>{p.is_self ? 'Me' : p.name}</Text>
                </View>
              );
            })}
            {participants.length === 0 && (
              <Text style={s.emptyHint}>No participants yet.</Text>
            )}
          </ScrollView>
        </View>

        {/* ── Expenses / Settlement tabs ── */}
        <View style={s.tabBar}>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'expenses' && s.tabBtnActive]}
            onPress={() => setActiveTab('expenses')}
            activeOpacity={0.75}
          >
            <Text style={[s.tabBtnText, activeTab === 'expenses' && s.tabBtnTextActive]}>Expenses</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'settlement' && s.tabBtnActive]}
            onPress={() => setActiveTab('settlement')}
            activeOpacity={0.75}
          >
            <Text style={[s.tabBtnText, activeTab === 'settlement' && s.tabBtnTextActive]}>Settlement</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'expenses' ? (
          expenses.length === 0 ? (
            <View style={s.emptyExpenses}>
              <MaterialCommunityIcons name="receipt-outline" size={36} color={ds.text.muted} />
              <Text style={s.emptyExpensesText}>No expenses yet. Add one to get started.</Text>
            </View>
          ) : (
            <View>
              {expenses.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  participants={participants}
                  currencySymbol={currencySymbol}
                  getCategoryName={getCategoryInfo}
                />
              ))}
            </View>
          )
        ) : (
          allSettled ? (
            <View style={s.settleAllDone}>
              <MaterialCommunityIcons name="check-circle-outline" size={36} color={ds.primary} />
              <Text style={s.settleAllDoneText}>No outstanding balances</Text>
            </View>
          ) : (
            <View>
              {settlement.map((sv, i) => {
                const color = avatarColor(sv.from_name);
                const amt = (sv.amount / 100).toLocaleString('en-IN', {
                  minimumFractionDigits: 2, maximumFractionDigits: 2,
                });
                return (
                  <View key={i} style={s.settleRow}>
                    <View style={[s.settleAvatar, { backgroundColor: hexToRgba(color, 0.2) }]}>
                      <Text style={[s.settleAvatarText, { color }]}>{initials(sv.from_name)}</Text>
                    </View>
                    <View style={s.settleBody}>
                      <Text style={s.settleNames}>{sv.from_name} → {sv.to_name}</Text>
                      <Text style={s.settleSub}>needs to pay</Text>
                    </View>
                    <Text style={s.settleAmt}>{currencySymbol}{amt}</Text>
                  </View>
                );
              })}
            </View>
          )
        )}
      </ScrollView>

      {/* ── Sticky action bar ── */}
      <View style={[s.actionBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={s.addExpenseBtn}
          onPress={() => navigation.navigate('AddTripExpense', { tripId })}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#fff" />
          <Text style={s.addExpenseBtnText}>Add Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.settleBtn, isSettled && s.settleBtnActive, settling && { opacity: 0.6 }]}
          onPress={handleMarkSettled}
          disabled={settling}
          activeOpacity={0.85}
        >
          {settling ? (
            <ActivityIndicator size="small" color={isSettled ? ds.primary : ds.text.muted} />
          ) : (
            <MaterialCommunityIcons
              name={isSettled ? 'check-circle' : 'check-circle-outline'}
              size={20}
              color={isSettled ? ds.primaryLight : ds.text.muted}
            />
          )}
          <Text style={[s.settleBtnText, isSettled && s.settleBtnTextActive]}>
            {isSettled ? 'Settled' : 'Mark Settled'}
          </Text>
        </TouchableOpacity>
      </View>

      <AddParticipantSheet
        visible={addParticipantOpen}
        onClose={() => setAddParticipantOpen(false)}
        onAdd={handleAddParticipant}
      />
    </View>
  );
}
