import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { DSType } from '../../constants/colors';
import { useDS } from '../../hooks/useDS';
import { hexToRgba } from '../../utils/color';
import { useTripsStore } from '../../store/tripsStore';
import { useCategoriesStore } from '../../store/categoriesStore';
import { useSettingsStore } from '../../store/settingsStore';
import { TripParticipant } from '../../types/db';
import { TripsStackParamList } from '../../types';

type Nav = StackNavigationProp<TripsStackParamList, 'AddTripExpense'>;
type Route = RouteProp<TripsStackParamList, 'AddTripExpense'>;

type SplitType = 'equal' | 'custom' | 'percentage';

function getAvatarPalette(ds: DSType): string[] {
  return [
    ds.primary, ds.secondary, ds.tertiary, ds.purple,
    '#3B82F6', '#EC4899', '#14B8A6', '#F97316',
  ];
}

function avatarColor(name: string, ds: DSType): string {
  const palette = getAvatarPalette(ds);
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Style factories ───────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const CAT_COLS = 4;
const CAT_CELL = Math.floor((SCREEN_W - 32 - (CAT_COLS - 1) * 8) / CAT_COLS);

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: ds.surface.screen },

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
    closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

    scroll: { flex: 1 },
    scrollContent: { padding: 16, gap: 20 },

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
      color: ds.primary,
      alignSelf: 'flex-start',
      marginTop: 6,
    },
    amountInput: {
      fontFamily: 'Inter_700Bold',
      fontSize: 56,
      lineHeight: 64,
      letterSpacing: -2.24,
      minWidth: 80,
      maxWidth: SCREEN_W - 80,
      padding: 0,
      includeFontPadding: false,
    },
    errorCenter: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 16,
      color: ds.secondaryLight,
      textAlign: 'center',
      marginTop: -12,
    },
    errorInline: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 16,
      color: ds.secondaryLight,
    },

    section: { gap: 8 },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: ds.text.muted,
    },
    optional: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      textTransform: 'none',
      letterSpacing: 0,
    },
    emptyHint: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: ds.text.muted,
      paddingVertical: 4,
    },

    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.md,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      paddingHorizontal: 14,
      height: 48,
      gap: 8,
    },
    inputIcon: {},
    inputText: {
      flex: 1,
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      lineHeight: 22,
      color: ds.text.primary,
      padding: 0,
    },

    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    catCell: {
      width: CAT_CELL,
      height: CAT_CELL,
      borderRadius: ds.radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      backgroundColor: ds.surface.elevated,
      borderWidth: 1.5,
      borderColor: ds.border.subtle,
    },
    catIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 10,
      lineHeight: 14,
      color: ds.text.muted,
      textAlign: 'center',
      paddingHorizontal: 4,
    },

    paidByRow: { gap: 8, paddingVertical: 2 },
    paidByChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: ds.radius.full,
      backgroundColor: ds.surface.elevated,
      borderWidth: 1.5,
      borderColor: ds.border.subtle,
    },
    paidByAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    paidByInitials: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      lineHeight: 14,
    },
    paidByName: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.secondary,
      maxWidth: 80,
    },

    splitToggle: {
      flexDirection: 'row',
      backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.md,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      padding: 4,
      gap: 4,
    },
    splitBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      height: 40,
      borderRadius: ds.radius.md - 2,
    },
    splitBtnActive: { backgroundColor: hexToRgba(ds.primary, 0.18) },
    splitBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
    },
    splitBtnTextActive: { color: ds.primaryLight },

    perPersonHint: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      lineHeight: 16,
      color: ds.primaryLight,
    },
    perPersonHintError: { color: ds.secondaryLight },
    splitErrorText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 16,
      color: ds.secondaryLight,
      marginTop: -4,
    },
    splitList: {
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.xl,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      overflow: 'hidden',
    },

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
      backgroundColor: ds.primary,
    },
    saveBtnText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 17,
      lineHeight: 22,
      color: '#fff',
    },
  });
}

function makeSplitRowStyles(ds: DSType) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: ds.border.subtle,
    },
    rowExcluded: { opacity: 0.5 },
    checkWrap: { padding: 2 },
    check: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: ds.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkActive: {
      backgroundColor: ds.primary,
      borderColor: ds.primary,
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
    name: {
      flex: 1,
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      lineHeight: 20,
      color: ds.text.primary,
    },
    nameExcluded: { color: ds.text.muted },
    equalAmt: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      lineHeight: 20,
      color: ds.primaryLight,
    },
    input: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.sm,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      paddingHorizontal: 8,
      height: 36,
      minWidth: 80,
      gap: 2,
    },
    inputError: { borderColor: ds.secondary },
    inputPrefix: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
    },
    inputSuffix: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
    },
    inputText: {
      flex: 1,
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      lineHeight: 20,
      color: ds.text.primary,
      padding: 0,
      textAlign: 'right',
      minWidth: 50,
    },
  });
}

// ── Category cell ─────────────────────────────────────────────────────────────

interface CatCellProps {
  icon: string;
  name: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}

function CatCell({ icon, name, color, selected, onPress }: CatCellProps) {
  const ds = useDS();
  const s = useMemo(() => makeStyles(ds), [ds]);

  return (
    <TouchableOpacity
      style={[
        s.catCell,
        selected && { borderColor: color, backgroundColor: hexToRgba(color, 0.1) },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[s.catIcon, { backgroundColor: hexToRgba(color, selected ? 0.25 : 0.1) }]}>
        <MaterialCommunityIcons
          name={icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
          size={20}
          color={selected ? color : ds.text.muted}
        />
      </View>
      <Text style={[s.catLabel, selected && { color }]} numberOfLines={1}>{name}</Text>
    </TouchableOpacity>
  );
}

// ── Participant chip (Paid By) ─────────────────────────────────────────────────

interface PaidByChipProps {
  participant: TripParticipant;
  selected: boolean;
  onPress: () => void;
}

function PaidByChip({ participant, selected, onPress }: PaidByChipProps) {
  const ds = useDS();
  const s = useMemo(() => makeStyles(ds), [ds]);

  const color = avatarColor(participant.name, ds);
  const displayName = participant.is_self ? 'Me' : participant.name;
  return (
    <TouchableOpacity
      style={[
        s.paidByChip,
        selected && { borderColor: color, backgroundColor: hexToRgba(color, 0.12) },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[s.paidByAvatar, { backgroundColor: hexToRgba(color, 0.2) }]}>
        <Text style={[s.paidByInitials, { color }]}>{initials(participant.name)}</Text>
      </View>
      <Text style={[s.paidByName, selected && { color }]} numberOfLines={1}>{displayName}</Text>
      {selected && (
        <MaterialCommunityIcons name="check-circle" size={14} color={color} />
      )}
    </TouchableOpacity>
  );
}

// ── Split row ─────────────────────────────────────────────────────────────────

interface SplitRowProps {
  participant: TripParticipant;
  splitType: SplitType;
  value: string;
  perPersonDisplay: string;
  excluded: boolean;
  onChangeValue: (v: string) => void;
  onToggleExclude: () => void;
  currencySymbol: string;
  error?: boolean;
}

function SplitRow({
  participant, splitType, value, perPersonDisplay, excluded,
  onChangeValue, onToggleExclude, currencySymbol, error,
}: SplitRowProps) {
  const ds = useDS();
  const sr = useMemo(() => makeSplitRowStyles(ds), [ds]);

  const color = avatarColor(participant.name, ds);
  const displayName = participant.is_self ? 'Me' : participant.name;

  return (
    <View style={[sr.row, excluded && sr.rowExcluded]}>
      {/* Exclude checkbox */}
      <TouchableOpacity onPress={onToggleExclude} activeOpacity={0.7} style={sr.checkWrap}>
        <View style={[sr.check, !excluded && sr.checkActive]}>
          {!excluded && <MaterialCommunityIcons name="check" size={12} color="#fff" />}
        </View>
      </TouchableOpacity>

      {/* Avatar */}
      <View style={[sr.avatar, { backgroundColor: hexToRgba(color, 0.15) }]}>
        <Text style={[sr.avatarText, { color }]}>{initials(participant.name)}</Text>
      </View>

      {/* Name */}
      <Text style={[sr.name, excluded && sr.nameExcluded]} numberOfLines={1}>{displayName}</Text>

      {/* Value input or computed display */}
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        {splitType === 'equal' ? (
          <Text style={[sr.equalAmt, excluded && { color: ds.text.muted }]}>{perPersonDisplay}</Text>
        ) : splitType === 'custom' ? (
          <View style={[sr.input, error && sr.inputError, excluded && { opacity: 0.4 }]}>
            <Text style={sr.inputPrefix}>{currencySymbol}</Text>
            <TextInput
              style={sr.inputText}
              value={value}
              onChangeText={onChangeValue}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={ds.text.muted}
              selectionColor={ds.primary}
              editable={!excluded}
            />
          </View>
        ) : (
          <View style={[sr.input, error && sr.inputError, excluded && { opacity: 0.4 }]}>
            <TextInput
              style={sr.inputText}
              value={value}
              onChangeText={onChangeValue}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={ds.text.muted}
              selectionColor={ds.primary}
              editable={!excluded}
            />
            <Text style={sr.inputSuffix}>%</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function AddTripExpenseScreen() {
  const ds = useDS();
  const s = useMemo(() => makeStyles(ds), [ds]);

  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { tripId } = route.params;

  const { activeTrip, addExpense } = useTripsStore();
  const { expenseCategories, loadFromDB: loadCats } = useCategoriesStore();
  const { currencySymbol } = useSettingsStore();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [paidById, setPaidById] = useState<string | null>(null);
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // ── Errors ─────────────────────────────────────────────────────────────────
  const [amountError, setAmountError] = useState('');
  const [paidByError, setPaidByError] = useState('');
  const [splitError, setSplitError] = useState('');

  const participants = activeTrip?.participants ?? [];

  useEffect(() => {
    loadCats();
    // Default paidBy to the "self" participant
    const selfP = participants.find((p) => p.is_self === 1);
    if (selfP && !paidById) setPaidById(selfP.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants.length]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const includedParticipants = participants.filter((p) => !excluded.has(p.id));
  const amountNum = parseFloat(amount) || 0;
  const amountPaise = Math.round(amountNum * 100);

  const perPersonAmt = includedParticipants.length > 0
    ? amountNum / includedParticipants.length
    : 0;
  const perPersonDisplay = `${currencySymbol}${perPersonAmt.toFixed(2)}`;

  const customTotal = includedParticipants.reduce(
    (sum, p) => sum + (parseFloat(customAmounts[p.id] ?? '0') || 0),
    0
  );
  const percentTotal = includedParticipants.reduce(
    (sum, p) => sum + (parseFloat(percentages[p.id] ?? '0') || 0),
    0
  );

  // ── Helpers ────────────────────────────────────────────────────────────────
  const handleAmountChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setAmount(cleaned);
    if (amountError && parseFloat(cleaned) > 0) setAmountError('');
  };

  const toggleExclude = (id: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const setCustomAmount = (id: string, v: string) => {
    const cleaned = v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setCustomAmounts((prev) => ({ ...prev, [id]: cleaned }));
    if (splitError) setSplitError('');
  };

  const setPercentage = (id: string, v: string) => {
    const cleaned = v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setPercentages((prev) => ({ ...prev, [id]: cleaned }));
    if (splitError) setSplitError('');
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    let ok = true;
    if (!amount || amountNum <= 0) { setAmountError('Enter an amount greater than 0.'); ok = false; }
    else setAmountError('');
    if (!paidById) { setPaidByError('Select who paid.'); ok = false; }
    else setPaidByError('');
    if (includedParticipants.length === 0) { setSplitError('At least one participant must be included.'); ok = false; }
    else if (splitType === 'custom') {
      const diff = Math.abs(customTotal - amountNum);
      if (diff > 0.01) { setSplitError(`Amounts must sum to ${currencySymbol}${amountNum.toFixed(2)} (currently ${currencySymbol}${customTotal.toFixed(2)}).`); ok = false; }
      else setSplitError('');
    } else if (splitType === 'percentage') {
      const diff = Math.abs(percentTotal - 100);
      if (diff > 0.1) { setSplitError(`Percentages must sum to 100% (currently ${percentTotal.toFixed(1)}%).`); ok = false; }
      else setSplitError('');
    } else {
      setSplitError('');
    }
    return ok;
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate() || saving) return;
    setSaving(true);
    try {
      // Build splits
      const splits = participants.map((p) => {
        const isExcluded = excluded.has(p.id);
        let shareAmount = 0;
        if (!isExcluded) {
          if (splitType === 'equal') {
            shareAmount = Math.round(amountPaise / includedParticipants.length);
          } else if (splitType === 'custom') {
            shareAmount = Math.round((parseFloat(customAmounts[p.id] ?? '0') || 0) * 100);
          } else {
            const pct = (parseFloat(percentages[p.id] ?? '0') || 0) / 100;
            shareAmount = Math.round(amountPaise * pct);
          }
        }
        return { participant_id: p.id, share_amount: shareAmount, is_excluded: isExcluded ? 1 : 0 };
      });

      await addExpense(
        {
          trip_id: tripId,
          paid_by_participant_id: paidById!,
          category_id: categoryId,
          amount: amountPaise,
          description: description.trim() || null,
          split_type: splitType,
          expense_date: toISODate(new Date()),
        },
        splits,
      );
      navigation.goBack();
    } catch {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={s.closeBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="close" size={24} color={ds.text.secondary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Add Expense</Text>
        <View style={s.closeBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.scrollContent, { paddingBottom: 16 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Amount ── */}
          <TouchableOpacity style={s.amountSection} activeOpacity={1}>
            <Text style={s.currencySymbol}>{currencySymbol}</Text>
            <TextInput
              style={[s.amountInput, { color: amount ? ds.primaryLight : ds.text.muted }]}
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              autoFocus
              placeholder="0"
              placeholderTextColor={ds.text.muted}
              selectionColor={ds.primary}
              returnKeyType="done"
            />
          </TouchableOpacity>
          {amountError ? <Text style={s.errorCenter}>{amountError}</Text> : null}

          {/* ── Description ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>DESCRIPTION</Text>
            <View style={s.inputWrap}>
              <MaterialCommunityIcons name="text-short" size={16} color={ds.text.muted} style={s.inputIcon} />
              <TextInput
                style={s.inputText}
                value={description}
                onChangeText={setDescription}
                placeholder="What was this expense for?"
                placeholderTextColor={ds.text.muted}
                selectionColor={ds.primary}
                returnKeyType="next"
                maxLength={120}
              />
            </View>
          </View>

          {/* ── Category ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>CATEGORY <Text style={s.optional}>(optional)</Text></Text>
            {expenseCategories.length === 0 ? (
              <Text style={s.emptyHint}>No categories found.</Text>
            ) : (
              <View style={s.catGrid}>
                {expenseCategories.map((cat) => (
                  <CatCell
                    key={cat.id}
                    icon={cat.icon}
                    name={cat.name}
                    color={cat.color}
                    selected={categoryId === cat.id}
                    onPress={() => setCategoryId((prev) => prev === cat.id ? null : cat.id)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* ── Paid By ── */}
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>PAID BY</Text>
              {paidByError ? <Text style={s.errorInline}>{paidByError}</Text> : null}
            </View>
            {participants.length === 0 ? (
              <Text style={s.emptyHint}>Add participants to the trip first.</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.paidByRow}
              >
                {participants.map((p) => (
                  <PaidByChip
                    key={p.id}
                    participant={p}
                    selected={paidById === p.id}
                    onPress={() => { setPaidById(p.id); setPaidByError(''); }}
                  />
                ))}
              </ScrollView>
            )}
          </View>

          {/* ── Split Type ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>SPLIT TYPE</Text>
            <View style={s.splitToggle}>
              {(['equal', 'custom', 'percentage'] as SplitType[]).map((type) => {
                const active = splitType === type;
                const icons: Record<SplitType, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
                  equal: 'equal', custom: 'format-list-numbered', percentage: 'percent',
                };
                const labels: Record<SplitType, string> = {
                  equal: 'Equal', custom: 'Custom', percentage: 'Percent',
                };
                return (
                  <TouchableOpacity
                    key={type}
                    style={[s.splitBtn, active && s.splitBtnActive]}
                    onPress={() => { setSplitType(type); setSplitError(''); }}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons
                      name={icons[type]}
                      size={15}
                      color={active ? ds.primaryLight : ds.text.muted}
                    />
                    <Text style={[s.splitBtnText, active && s.splitBtnTextActive]}>{labels[type]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Split details ── */}
          {participants.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionRow}>
                <Text style={s.sectionTitle}>INCLUDE IN SPLIT</Text>
                {splitType === 'equal' && amountNum > 0 && includedParticipants.length > 0 && (
                  <Text style={s.perPersonHint}>{perPersonDisplay} each</Text>
                )}
                {splitType === 'custom' && amountNum > 0 && (
                  <Text style={[
                    s.perPersonHint,
                    Math.abs(customTotal - amountNum) > 0.01 && s.perPersonHintError,
                  ]}>
                    {currencySymbol}{customTotal.toFixed(2)} / {currencySymbol}{amountNum.toFixed(2)}
                  </Text>
                )}
                {splitType === 'percentage' && (
                  <Text style={[
                    s.perPersonHint,
                    Math.abs(percentTotal - 100) > 0.1 && s.perPersonHintError,
                  ]}>
                    {percentTotal.toFixed(1)}% / 100%
                  </Text>
                )}
              </View>
              {splitError ? <Text style={s.splitErrorText}>{splitError}</Text> : null}
              <View style={s.splitList}>
                {participants.map((p) => (
                  <SplitRow
                    key={p.id}
                    participant={p}
                    splitType={splitType}
                    value={splitType === 'custom' ? (customAmounts[p.id] ?? '') : (percentages[p.id] ?? '')}
                    perPersonDisplay={perPersonDisplay}
                    excluded={excluded.has(p.id)}
                    onChangeValue={(v) => splitType === 'custom' ? setCustomAmount(p.id, v) : setPercentage(p.id, v)}
                    onToggleExclude={() => toggleExclude(p.id)}
                    currencySymbol={currencySymbol}
                    error={!!splitError}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Footer CTA ── */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#fff" />
            <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Add Expense'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
