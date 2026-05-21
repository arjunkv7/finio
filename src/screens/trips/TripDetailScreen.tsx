import React, { useCallback, useEffect, useState } from 'react';
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

import { DS } from '../../constants';
import { hexToRgba } from '../../utils/color';
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
  DS.primary, DS.secondary, DS.tertiary, DS.purple,
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
  onAdd: (name: string) => Promise<void>;
}

function AddParticipantSheet({ visible, onClose, onAdd }: AddParticipantSheetProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!visible) { setName(''); setError(''); } }, [visible]);

  const handleAdd = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    try { await onAdd(name.trim()); setName(''); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Participant">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={ps.body}>
          <View style={ps.inputWrap}>
            <MaterialCommunityIcons name="account-outline" size={18} color={DS.text.muted} style={ps.inputIcon} />
            <TextInput
              style={ps.input}
              value={name}
              onChangeText={(v) => { setName(v); if (v.trim()) setError(''); }}
              placeholder="Participant name"
              placeholderTextColor={DS.text.muted}
              selectionColor={DS.primary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />
          </View>
          {error ? <Text style={ps.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[ps.btn, saving && { opacity: 0.6 }]}
            onPress={handleAdd}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : null}
            <Text style={ps.btnText}>{saving ? 'Adding…' : 'Add Participant'}</Text>
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

function ExpenseRow({ expense, participants, currencySymbol, getCategoryName }: ExpenseRowProps) {
  const paidBy = participants.find((p) => p.id === expense.paid_by_participant_id);
  const cat = getCategoryName(expense.category_id);
  const amount = (expense.amount / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const splitIcon = SPLIT_ICONS[expense.split_type] ?? 'equal';

  return (
    <View style={er.row}>
      <View style={[er.catIcon, { backgroundColor: hexToRgba(cat?.color ?? DS.text.muted, 0.15) }]}>
        <MaterialCommunityIcons
          name={(cat?.icon ?? 'receipt') as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
          size={20}
          color={cat?.color ?? DS.text.muted}
        />
      </View>
      <View style={er.body}>
        <Text style={er.desc} numberOfLines={1}>{expense.description ?? cat?.name ?? 'Expense'}</Text>
        <View style={er.meta}>
          <View style={er.paidByChip}>
            <Text style={er.paidByText}>{paidBy?.name ?? '—'}</Text>
          </View>
          <MaterialCommunityIcons name={splitIcon} size={12} color={DS.text.muted} />
          <Text style={er.splitLabel}>{expense.split_type}</Text>
        </View>
      </View>
      <Text style={er.amount}>{currencySymbol}{amount}</Text>
    </View>
  );
}

// ── Settlement Card ───────────────────────────────────────────────────────────

interface SettlementBarProps {
  currencySymbol: string;
}

function SettlementBar({ currencySymbol }: SettlementBarProps) {
  const { activeTrip } = useTripsStore();
  const settlement = activeTrip?.settlement ?? [];

  if (settlement.length === 0) {
    return (
      <View style={sb.card}>
        <View style={sb.header}>
          <MaterialCommunityIcons name="check-circle-outline" size={18} color={DS.primary} />
          <Text style={sb.headerText}>All settled!</Text>
        </View>
        <Text style={sb.allSettledSub}>No outstanding balances.</Text>
      </View>
    );
  }

  return (
    <View style={sb.card}>
      <View style={sb.header}>
        <MaterialCommunityIcons name="swap-horizontal" size={18} color={DS.tertiary} />
        <Text style={sb.headerText}>Settlement Summary</Text>
      </View>
      {settlement.map((s, i) => {
        const amt = (s.amount / 100).toLocaleString('en-IN', {
          minimumFractionDigits: 2, maximumFractionDigits: 2,
        });
        return (
          <View key={i} style={sb.row}>
            <View style={[sb.avatar, { backgroundColor: hexToRgba(DS.secondary, 0.15) }]}>
              <Text style={[sb.avatarText, { color: DS.secondaryLight }]}>{initials(s.from_name)}</Text>
            </View>
            <View style={sb.rowBody}>
              <Text style={sb.rowText}>
                <Text style={sb.nameHighlight}>{s.from_name}</Text>
                <Text style={sb.rowText}> pays </Text>
                <Text style={sb.nameHighlight}>{s.to_name}</Text>
              </Text>
            </View>
            <Text style={sb.amt}>{currencySymbol}{amt}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { tripId } = route.params;

  const { activeTrip, refreshActiveTrip, updateTrip, addParticipant } = useTripsStore();
  const { expenseCategories } = useCategoriesStore();
  const { currencySymbol } = useSettingsStore();

  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [settling, setSettling] = useState(false);

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

  const handleAddParticipant = useCallback(async (name: string) => {
    await addParticipant({ trip_id: tripId, name });
  }, [addParticipant, tripId]);

  if (!activeTrip || activeTrip.trip.id !== tripId) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={DS.text.primary} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={DS.primary} />
        </View>
      </View>
    );
  }

  const { trip, participants, expenses, total } = activeTrip;
  const isSettled = trip.is_settled === 1;
  const totalDisplay = (total / 100).toLocaleString('en-IN', {
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
          <MaterialCommunityIcons name="arrow-left" size={24} color={DS.text.primary} />
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
        {/* ── Trip total stat ── */}
        <View style={s.totalCard}>
          <Text style={s.totalLabel}>TOTAL TRIP SPEND</Text>
          <Text style={s.totalAmount}>{currencySymbol}{totalDisplay}</Text>
          <Text style={s.totalSub}>{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</Text>
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
              <MaterialCommunityIcons name="account-plus-outline" size={16} color={DS.primary} />
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

        {/* ── Expenses ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Expenses</Text>
          </View>
          {expenses.length === 0 ? (
            <View style={s.emptyExpenses}>
              <MaterialCommunityIcons name="receipt-outline" size={36} color={DS.text.muted} />
              <Text style={s.emptyExpensesText}>No expenses yet. Add one to get started.</Text>
            </View>
          ) : (
            <View style={s.expenseList}>
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
          )}
        </View>

        {/* ── Settlement summary ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Settlement</Text>
          <View style={{ marginTop: 8 }}>
            <SettlementBar currencySymbol={currencySymbol} />
          </View>
        </View>
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
            <ActivityIndicator size="small" color={isSettled ? DS.primary : DS.text.muted} />
          ) : (
            <MaterialCommunityIcons
              name={isSettled ? 'check-circle' : 'check-circle-outline'}
              size={20}
              color={isSettled ? DS.primaryLight : DS.text.muted}
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

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.surface.screen },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: DS.border.subtle,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
    color: DS.text.primary,
  },
  headerSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: DS.text.muted,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: DS.radius.full,
    borderWidth: 1,
  },
  statusSettled: {
    backgroundColor: hexToRgba(DS.primary, 0.12),
    borderColor: hexToRgba(DS.primary, 0.3),
  },
  statusPending: {
    backgroundColor: hexToRgba(DS.tertiary, 0.12),
    borderColor: hexToRgba(DS.tertiary, 0.3),
  },
  statusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
  },
  statusTextSettled: { color: DS.primaryLight },
  statusTextPending: { color: DS.tertiaryLight },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 16, paddingHorizontal: 16, gap: 20 },

  totalCard: {
    backgroundColor: DS.surface.card,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.border.subtle,
    padding: 20,
    alignItems: 'center',
  },
  totalLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: DS.text.muted,
    marginBottom: 6,
  },
  totalAmount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.72,
    color: DS.text.primary,
  },
  totalSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: DS.text.muted,
    marginTop: 4,
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
    color: DS.text.muted,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: DS.radius.full,
    backgroundColor: hexToRgba(DS.primary, 0.12),
  },
  addBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: DS.primaryLight,
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
    borderColor: DS.surface.screen,
  },
  avatarName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 14,
    color: DS.text.secondary,
    textAlign: 'center',
  },
  emptyHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: DS.text.muted,
    padding: 8,
  },

  expenseList: {
    backgroundColor: DS.surface.card,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.border.subtle,
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
    color: DS.text.muted,
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
    borderTopColor: DS.border.subtle,
    backgroundColor: DS.surface.screen,
  },
  addExpenseBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: DS.radius.md,
    backgroundColor: DS.primary,
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
    borderRadius: DS.radius.md,
    borderWidth: 1.5,
    borderColor: DS.border.medium,
    backgroundColor: DS.surface.elevated,
  },
  settleBtnActive: {
    borderColor: hexToRgba(DS.primary, 0.4),
    backgroundColor: hexToRgba(DS.primary, 0.08),
  },
  settleBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: DS.text.muted,
  },
  settleBtnTextActive: { color: DS.primaryLight },
});

// ── Expense row styles ────────────────────────────────────────────────────────

const er = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.border.subtle,
  },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: DS.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  desc: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: DS.text.primary,
    marginBottom: 4,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  paidByChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: DS.radius.full,
    backgroundColor: hexToRgba(DS.primary, 0.12),
  },
  paidByText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    lineHeight: 16,
    color: DS.primaryLight,
  },
  splitLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: DS.text.muted,
  },
  amount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
    color: DS.text.primary,
  },
});

// ── Settlement bar styles ─────────────────────────────────────────────────────

const sb = StyleSheet.create({
  card: {
    backgroundColor: DS.surface.card,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.border.subtle,
    padding: 16,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  headerText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    lineHeight: 20,
    color: DS.text.primary,
  },
  allSettledSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: DS.text.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    lineHeight: 16,
  },
  rowBody: { flex: 1 },
  rowText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: DS.text.secondary,
  },
  nameHighlight: {
    fontFamily: 'Inter_600SemiBold',
    color: DS.text.primary,
  },
  amt: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    lineHeight: 20,
    color: DS.tertiaryLight,
  },
});

// ── Add participant sheet styles ──────────────────────────────────────────────

const ps = StyleSheet.create({
  body: { padding: 20, gap: 12 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.surface.elevated,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: DS.border.subtle,
    paddingHorizontal: 12,
    height: 50,
    gap: 8,
  },
  inputIcon: {},
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: DS.text.primary,
    padding: 0,
  },
  error: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: DS.secondaryLight,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: DS.radius.md,
    backgroundColor: DS.primary,
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
