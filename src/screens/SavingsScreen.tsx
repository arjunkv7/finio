import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  RefreshControl,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PageHeader from '../components/PageHeader';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';
import { hexToRgba } from '../utils/color';
import { useSavingsStore, GoalWithProgress } from '../store/savingsStore';
import { useSettingsStore } from '../store/settingsStore';
import { SavingsContribution } from '../types/db';
import AppCard from '../components/AppCard';
import ProgressBar from '../components/ProgressBar';
import BottomSheet from '../components/BottomSheet';

// ── Types ────────────────────────────────────────────────────────────────────

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// ── Constants ────────────────────────────────────────────────────────────────

const GOAL_ICONS: { icon: IconName; label: string }[] = [
  { icon: 'piggy-bank',    label: 'Savings'   },
  { icon: 'home',          label: 'Home'      },
  { icon: 'car',           label: 'Car'       },
  { icon: 'airplane',      label: 'Travel'    },
  { icon: 'school',        label: 'Education' },
  { icon: 'heart',         label: 'Health'    },
  { icon: 'shopping',      label: 'Shopping'  },
  { icon: 'gift',          label: 'Gift'      },
  { icon: 'umbrella',      label: 'Emergency' },
  { icon: 'rocket-launch', label: 'Dream'     },
];

const GOAL_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#F43F5E', '#06B6D4'];

const MONTHS_FULL = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

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

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: ds.border.subtle,
    },
    headerTitle: {
      flex: 1,
      fontFamily: 'Inter_700Bold',
      fontSize: 24,
      lineHeight: 32,
      letterSpacing: -0.48,
      color: ds.text.primary,
    },
    badgeWrap: {
      backgroundColor: hexToRgba(ds.primary, 0.12),
      borderRadius: ds.radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badge: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      lineHeight: 16,
      color: ds.primaryLight,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: ds.surface.elevated,
      alignItems: 'center', justifyContent: 'center',
    },
    headerIcon: {
      width: 32, height: 32, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
    },

    scroll: { flex: 1 },
    scrollContent: { padding: 16, gap: 12 },

    // Hero
    heroCard: {},
    heroLabel: {
      fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16,
      letterSpacing: 0.6, textTransform: 'uppercase', color: ds.text.muted, marginBottom: 4,
    },
    heroAmount: {
      fontFamily: 'Inter_700Bold', fontSize: 36, lineHeight: 44,
      letterSpacing: -1.2, color: ds.primary, marginBottom: 16,
    },
    heroRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingTop: 14, borderTopWidth: 1, borderTopColor: ds.border.subtle,
    },
    heroStat: { flex: 1, alignItems: 'center' },
    heroStatVal: {
      fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 28, color: ds.text.primary,
    },
    heroStatLbl: {
      fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: ds.text.muted, marginTop: 2,
    },
    heroStatDivider: { width: 1, height: 32, backgroundColor: ds.border.subtle },

    // Section label
    sectionLabel: {
      fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16,
      letterSpacing: 0.6, textTransform: 'uppercase', color: ds.text.muted,
      marginLeft: 2, marginTop: 4, marginBottom: -4,
    },

    // Goal card
    goalCard: {},
    goalCardDimmed: { opacity: 0.6 },
    goalCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    goalIconWrap: {
      width: 44, height: 44, borderRadius: ds.radius.lg,
      alignItems: 'center', justifyContent: 'center',
    },
    goalCardInfo: { flex: 1, gap: 2 },
    goalName: {
      fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: ds.text.primary,
    },
    goalDays: {
      fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: ds.text.muted,
    },
    pctBadge: {
      borderRadius: ds.radius.full, paddingHorizontal: 10, paddingVertical: 4,
    },
    pctText: {
      fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18,
    },
    goalCardBottom: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginTop: 10,
    },
    goalSaved: {
      fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: ds.text.primary,
    },
    goalTarget: {
      fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: ds.text.muted,
    },

    // Empty state
    emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 48 },
    emptyTitle: {
      fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: ds.text.secondary,
    },
    emptyHint: {
      fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: ds.text.muted, textAlign: 'center',
    },

    // FAB
    fab: {
      position: 'absolute', right: 20,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: ds.primary,
      alignItems: 'center', justifyContent: 'center',
      ...ds.shadow.modal,
    },

    // Sheet / form
    sheetContent: { padding: 20, gap: 8, paddingBottom: 8 },
    fieldLabel: {
      fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16,
      letterSpacing: 0.4, textTransform: 'uppercase',
      color: ds.text.muted, marginTop: 8,
    },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    currencyPrefix: {
      fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: ds.text.secondary,
    },
    input: {
      flex: 1,
      height: 44,
      backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.md,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      paddingHorizontal: 14,
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      color: ds.text.primary,
    },
    textArea: { height: 72, paddingTop: 10, textAlignVertical: 'top' },
    dateRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      height: 44, backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.md, borderWidth: 1,
      borderColor: ds.border.subtle, paddingHorizontal: 14,
    },
    dateText: {
      flex: 1,
      fontFamily: 'Inter_400Regular', fontSize: 15, color: ds.text.primary,
    },
    ctaBtn: {
      marginTop: 16,
      height: 52, borderRadius: ds.radius.lg,
      backgroundColor: ds.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    ctaBtnDisabled: { opacity: 0.5 },
    ctaText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#fff' },

    // Icon grid
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    iconCell: {
      width: '18%',
      aspectRatio: 1,
      borderRadius: ds.radius.md,
      borderWidth: 1.5,
      borderColor: ds.border.subtle,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    },
    iconLabel: {
      fontFamily: 'Inter_400Regular', fontSize: 9, lineHeight: 12,
      color: ds.text.muted, textAlign: 'center',
    },

    // Color row
    colorRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
    swatch: { width: 32, height: 32, borderRadius: 16 },
    swatchSelected: { borderWidth: 3, borderColor: '#fff' },

    // Detail header
    detailHero: { padding: 16, paddingBottom: 0 },
    amountsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    amountLabel: {
      fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 14,
      textTransform: 'uppercase', letterSpacing: 0.4, color: ds.text.muted, marginBottom: 2,
    },
    amountBig: {
      fontFamily: 'Inter_700Bold', fontSize: 28, lineHeight: 36, letterSpacing: -0.8,
    },
    amountSecondary: {
      fontFamily: 'Inter_600SemiBold', fontSize: 18, lineHeight: 24, color: ds.text.secondary,
    },
    daysText: {
      fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: ds.text.muted,
      marginTop: 10,
    },
    completedBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    },
    completedText: {
      fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18, color: ds.primaryLight,
    },

    contribSectionHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
    },
    addContribBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: ds.primary, borderRadius: ds.radius.full,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    addContribText: {
      fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#fff',
    },
    contribList: { paddingHorizontal: 16 },
    contribRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 14, gap: 12,
    },
    contribDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
    contribBody: { flex: 1, gap: 2 },
    contribAmount: {
      fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22,
    },
    contribNote: {
      fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: ds.text.muted,
    },
    contribMeta: { alignItems: 'flex-end', gap: 6 },
    contribDate: {
      fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: ds.text.muted,
    },
    contribDivider: {
      height: StyleSheet.hairlineWidth, backgroundColor: ds.border.subtle,
    },
  });
}

function makeCalStyles(ds: DSType) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.lg,
      padding: 12,
      marginTop: 8,
    },
    nav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 10,
    },
    navBtn: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: ds.surface.highest,
      alignItems: 'center', justifyContent: 'center',
    },
    navLabel: {
      fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: ds.text.primary,
    },
    row: { flexDirection: 'row', marginBottom: 6 },
    dayH: {
      flex: 1, textAlign: 'center',
      fontFamily: 'Inter_500Medium', fontSize: 11, color: ds.text.muted,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    selectedCell: { backgroundColor: ds.primary, borderRadius: 20 },
    dayText: {
      fontFamily: 'Inter_400Regular', fontSize: 13, color: ds.text.secondary,
    },
    todayText: { fontFamily: 'Inter_700Bold', color: ds.primary },
    selectedText: { fontFamily: 'Inter_700Bold', color: '#fff' },
  });
}

// ── Inline Calendar (used inside BottomSheet forms) ──────────────────────────

function InlineCalendar({
  value,
  onSelect,
}: {
  value: Date;
  onSelect: (d: Date) => void;
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

  return (
    <View style={cal.wrap}>
      {/* Month nav */}
      <View style={cal.nav}>
        <TouchableOpacity onPress={goPrev} style={cal.navBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={20} color={ds.text.secondary} />
        </TouchableOpacity>
        <Text style={cal.navLabel}>{MONTHS_FULL[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={goNext} style={cal.navBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-right" size={20} color={ds.text.secondary} />
        </TouchableOpacity>
      </View>

      {/* Day-of-week headers */}
      <View style={cal.row}>
        {DAY_HEADERS.map(h => (
          <Text key={h} style={cal.dayH}>{h}</Text>
        ))}
      </View>

      {/* Day grid */}
      <View style={cal.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`e${i}`} style={cal.cell} />;
          const isSelected =
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
              style={[cal.cell, isSelected && cal.selectedCell]}
              onPress={() => onSelect(new Date(viewYear, viewMonth, day))}
              activeOpacity={0.7}
            >
              <Text style={[cal.dayText, isToday && !isSelected && cal.todayText, isSelected && cal.selectedText]}>
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── GoalDetailView ────────────────────────────────────────────────────────────

interface GoalDetailProps {
  goalId: string;
  onBack: () => void;
}

function GoalDetailView({ goalId, onBack }: GoalDetailProps) {
  const ds = useDS();
  const s = useMemo(() => makeStyles(ds), [ds]);

  const insets = useSafeAreaInsets();
  const { goals, activeGoalContributions, selectGoal, addContribution, deleteContribution } = useSavingsStore();
  const { currencySymbol } = useSettingsStore();

  const goal = goals.find(g => g.id === goalId);

  const [showContrib, setShowContrib] = useState(false);
  const [amount, setAmount]           = useState('');
  const [date, setDate]               = useState(new Date());
  const [showCal, setShowCal]         = useState(false);
  const [note, setNote]               = useState('');
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    selectGoal(goalId);
    return () => { selectGoal(null); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId]);

  const resetContribForm = () => {
    setAmount(''); setNote(''); setDate(new Date()); setShowCal(false);
  };

  const handleAdd = async () => {
    const paise = Math.round(parseFloat(amount) * 100);
    if (!amount.trim() || isNaN(paise) || paise <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number');
      return;
    }
    setSaving(true);
    try {
      await addContribution({
        goal_id: goalId,
        amount: paise,
        notes: note.trim() || null,
        contribution_date: toDateStr(date),
      });
      setShowContrib(false);
      resetContribForm();
    } catch {
      Alert.alert('Error', 'Could not save contribution');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (c: SavingsContribution) => {
    Alert.alert('Delete contribution?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteContribution(c.id, goalId) },
    ]);
  };

  if (!goal) return null;

  const accent       = goal.color ?? ds.primary;
  const isCompleted  = goal.is_completed === 1;
  const iconName     = (goal.icon ?? 'piggy-bank') as IconName;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={ds.text.primary} />
        </TouchableOpacity>
        <View style={[s.headerIcon, { backgroundColor: hexToRgba(accent, 0.2) }]}>
          <MaterialCommunityIcons name={iconName} size={18} color={accent} />
        </View>
        <Text style={s.headerTitle} numberOfLines={1}>{goal.name}</Text>
        {isCompleted && (
          <MaterialCommunityIcons name="check-circle" size={22} color={ds.primary} />
        )}
      </View>

      {/* ── Progress hero ── */}
      <View style={s.detailHero}>
        <AppCard padding={20}>
          <View style={s.amountsRow}>
            <View>
              <Text style={s.amountLabel}>Saved</Text>
              <Text style={[s.amountBig, { color: accent }]}>
                {currencySymbol}{formatBal(goal.contributed)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.amountLabel}>Target</Text>
              <Text style={s.amountSecondary}>
                {currencySymbol}{formatBal(goal.target_amount)}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: 14 }}>
            <ProgressBar
              value={goal.contributed}
              max={goal.target_amount}
              color={accent}
              height={10}
              showPercent
            />
          </View>
          {goal.target_date && !isCompleted && (
            <Text style={s.daysText}>
              {goal.daysRemaining !== null
                ? goal.daysRemaining > 0
                  ? `${goal.daysRemaining} days remaining · ${formatDateLocal(goal.target_date)}`
                  : `Target date passed (${formatDateLocal(goal.target_date)})`
                : formatDateLocal(goal.target_date)}
            </Text>
          )}
          {isCompleted && (
            <View style={s.completedBadge}>
              <MaterialCommunityIcons name="check-circle" size={14} color={ds.primaryLight} />
              <Text style={s.completedText}>Goal completed!</Text>
            </View>
          )}
        </AppCard>
      </View>

      {/* ── Contributions list ── */}
      <View style={s.contribSectionHeader}>
        <Text style={s.sectionLabel}>
          Contributions ({activeGoalContributions.length})
        </Text>
        {!isCompleted && (
          <TouchableOpacity
            style={s.addContribBtn}
            onPress={() => setShowContrib(true)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="plus" size={15} color="#fff" />
            <Text style={s.addContribText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={activeGoalContributions}
        keyExtractor={c => c.id}
        contentContainerStyle={[s.contribList, { paddingBottom: insets.bottom + 80 }]}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <MaterialCommunityIcons name="piggy-bank-outline" size={36} color={ds.text.muted} />
            <Text style={s.emptyTitle}>No contributions yet</Text>
            {!isCompleted && (
              <Text style={s.emptyHint}>Tap "Add" to record your first deposit</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.contribRow}>
            <View style={[s.contribDot, { backgroundColor: hexToRgba(accent, 0.8) }]} />
            <View style={s.contribBody}>
              <Text style={[s.contribAmount, { color: accent }]}>
                +{currencySymbol}{formatBal(item.amount)}
              </Text>
              {item.notes ? <Text style={s.contribNote}>{item.notes}</Text> : null}
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
        )}
        ItemSeparatorComponent={() => <View style={s.contribDivider} />}
      />

      {/* ── Add Contribution Sheet ── */}
      <BottomSheet
        visible={showContrib}
        onClose={() => { setShowContrib(false); resetContribForm(); }}
        title="Add Contribution"
      >
        <ScrollView
            contentContainerStyle={s.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Amount */}
            <Text style={s.fieldLabel}>Amount *</Text>
            <View style={s.inputRow}>
              <Text style={s.currencyPrefix}>{currencySymbol}</Text>
              <TextInput
                style={s.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={ds.text.muted}
                autoFocus
              />
            </View>

            {/* Date */}
            <Text style={s.fieldLabel}>Date</Text>
            <TouchableOpacity
              style={s.dateRow}
              onPress={() => setShowCal(c => !c)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="calendar" size={18} color={ds.text.muted} />
              <Text style={s.dateText}>{toDateStr(date) === toDateStr(new Date()) ? 'Today' : formatDateLocal(toDateStr(date))}</Text>
              <MaterialCommunityIcons name={showCal ? 'chevron-up' : 'chevron-down'} size={18} color={ds.text.muted} />
            </TouchableOpacity>
            {showCal && (
              <InlineCalendar
                value={date}
                onSelect={(d) => { setDate(d); setShowCal(false); }}
              />
            )}

            {/* Notes */}
            <Text style={s.fieldLabel}>Note (optional)</Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Monthly deposit"
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
              <Text style={s.ctaText}>{saving ? 'Saving…' : 'Add Contribution'}</Text>
            </TouchableOpacity>
          </ScrollView>
      </BottomSheet>
    </View>
  );
}

// ── SavingsScreen ─────────────────────────────────────────────────────────────

export default function SavingsScreen() {
  const ds = useDS();
  const s = useMemo(() => makeStyles(ds), [ds]);
  const navigation = useNavigation();

  const insets = useSafeAreaInsets();
  const { goals, isLoading, loadFromDB, addGoal, addContribution } = useSavingsStore();
  const { currencySymbol } = useSettingsStore();

  const [detailGoalId, setDetailGoalId] = useState<string | null>(null);
  const [showCreate, setShowCreate]     = useState(false);

  // Create-goal form state
  const [goalName,    setGoalName]    = useState('');
  const [goalTarget,  setGoalTarget]  = useState('');
  const [goalDate,    setGoalDate]    = useState<Date | null>(null);
  const [goalIcon,    setGoalIcon]    = useState<IconName>('piggy-bank');
  const [goalColor,   setGoalColor]   = useState(GOAL_COLORS[0]);
  const [showDateCal, setShowDateCal] = useState(false);
  const [creating,    setCreating]    = useState(false);

  // Quick-add contribution from list
  const [addContribGoalId,  setAddContribGoalId]  = useState<string | null>(null);
  const [addContribAmount,  setAddContribAmount]  = useState('');
  const [addContribDate,    setAddContribDate]    = useState(new Date());
  const [addContribNote,    setAddContribNote]    = useState('');
  const [addContribShowCal, setAddContribShowCal] = useState(false);
  const [addContribSaving,  setAddContribSaving]  = useState(false);

  useFocusEffect(useCallback(() => { loadFromDB(); }, [loadFromDB]));

  // Hardware back intercept when viewing goal detail
  useEffect(() => {
    if (!detailGoalId) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setDetailGoalId(null);
      return true;
    });
    return () => sub.remove();
  }, [detailGoalId]);

  if (detailGoalId) {
    return <GoalDetailView goalId={detailGoalId} onBack={() => setDetailGoalId(null)} />;
  }

  const totalSaved    = goals.reduce((sum, g) => sum + g.contributed, 0);
  const activeGoals   = goals.filter(g => g.is_completed === 0 && g.is_deleted === 0);
  const completedGoals = goals.filter(g => g.is_completed === 1 && g.is_deleted === 0);

  const resetCreateForm = () => {
    setGoalName(''); setGoalTarget(''); setGoalDate(null);
    setGoalIcon('piggy-bank'); setGoalColor(GOAL_COLORS[0]); setShowDateCal(false);
  };

  const handleCreate = async () => {
    if (!goalName.trim()) { Alert.alert('Name required'); return; }
    const paise = Math.round(parseFloat(goalTarget) * 100);
    if (!goalTarget.trim() || isNaN(paise) || paise <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive target amount');
      return;
    }
    setCreating(true);
    try {
      await addGoal({
        name: goalName.trim(),
        target_amount: paise,
        target_date: goalDate ? toDateStr(goalDate) : null,
        icon: goalIcon,
        color: goalColor,
      });
      setShowCreate(false);
      resetCreateForm();
    } catch {
      Alert.alert('Error', 'Could not create goal');
    } finally {
      setCreating(false);
    }
  };

  const resetAddContribForm = () => {
    setAddContribAmount(''); setAddContribNote('');
    setAddContribDate(new Date()); setAddContribShowCal(false);
  };

  const handleQuickAdd = async () => {
    if (!addContribGoalId) return;
    const paise = Math.round(parseFloat(addContribAmount) * 100);
    if (!addContribAmount.trim() || isNaN(paise) || paise <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number');
      return;
    }
    setAddContribSaving(true);
    try {
      await addContribution({
        goal_id: addContribGoalId,
        amount: paise,
        notes: addContribNote.trim() || null,
        contribution_date: toDateStr(addContribDate),
      });
      setAddContribGoalId(null);
      resetAddContribForm();
      loadFromDB();
    } catch {
      Alert.alert('Error', 'Could not save contribution');
    } finally {
      setAddContribSaving(false);
    }
  };

  const renderGoalCard = (goal: GoalWithProgress, dimmed = false) => {
    const accent      = goal.color ?? ds.primary;
    const iconName    = (goal.icon ?? 'piggy-bank') as IconName;
    const isCompleted = goal.is_completed === 1;

    return (
      <TouchableOpacity
        key={goal.id}
        activeOpacity={0.85}
        onPress={() => setDetailGoalId(goal.id)}
      >
        <AppCard padding={18} style={[s.goalCard, dimmed && s.goalCardDimmed]}>
          {/* Top row */}
          <View style={s.goalCardTop}>
            <View style={[s.goalIconWrap, { backgroundColor: hexToRgba(accent, 0.15) }]}>
              <MaterialCommunityIcons name={iconName} size={22} color={accent} />
            </View>
            <View style={s.goalCardInfo}>
              <Text style={s.goalName}>{goal.name}</Text>
              {goal.target_date && !isCompleted && (
                <Text style={s.goalDays}>
                  {goal.daysRemaining !== null && goal.daysRemaining > 0
                    ? `${goal.daysRemaining} days left`
                    : goal.daysRemaining === 0
                      ? 'Due today'
                      : 'Overdue'}
                </Text>
              )}
            </View>
            {isCompleted ? (
              <MaterialCommunityIcons name="check-circle" size={24} color={ds.primary} />
            ) : (
              <View style={[s.pctBadge, { backgroundColor: hexToRgba(accent, 0.15) }]}>
                <Text style={[s.pctText, { color: accent }]}>{goal.percent}%</Text>
              </View>
            )}
          </View>

          {/* Progress bar */}
          <View style={{ marginTop: 14 }}>
            <ProgressBar
              value={goal.contributed}
              max={goal.target_amount}
              color={isCompleted ? ds.primary : accent}
              height={6}
            />
          </View>

          {/* Bottom row */}
          <View style={s.goalCardBottom}>
            <View>
              <Text style={s.goalSaved}>
                {currencySymbol}{formatBal(goal.contributed)} saved
              </Text>
              <Text style={s.goalTarget}>
                of {currencySymbol}{formatBal(goal.target_amount)}
              </Text>
            </View>
            {!isCompleted && (
              <TouchableOpacity
                style={s.addContribBtn}
                onPress={() => setAddContribGoalId(goal.id)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="plus" size={15} color="#fff" />
                <Text style={s.addContribText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </AppCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.root}>
      <PageHeader onBack={() => navigation.goBack()} title="Savings Goals" />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadFromDB} tintColor={ds.primary} colors={[ds.primary]} />
        }
      >
        {/* ── Total saved hero ── */}
        <AppCard padding={22} style={s.heroCard}>
          <Text style={s.heroLabel}>Total Saved</Text>
          <Text style={s.heroAmount}>{currencySymbol}{formatBal(totalSaved)}</Text>
          <View style={s.heroRow}>
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{activeGoals.length}</Text>
              <Text style={s.heroStatLbl}>Active goals</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{completedGoals.length}</Text>
              <Text style={s.heroStatLbl}>Completed</Text>
            </View>
          </View>
        </AppCard>

        {/* ── Active goals ── */}
        {activeGoals.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Active Goals</Text>
            {activeGoals.map(g => renderGoalCard(g, false))}
          </>
        )}

        {/* ── Completed goals ── */}
        {completedGoals.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Completed</Text>
            {completedGoals.map(g => renderGoalCard(g, true))}
          </>
        )}

        {/* ── Empty state ── */}
        {goals.filter(g => g.is_deleted === 0).length === 0 && (
          <View style={s.emptyBox}>
            <MaterialCommunityIcons name="piggy-bank-outline" size={48} color={ds.text.muted} />
            <Text style={s.emptyTitle}>No savings goals yet</Text>
            <Text style={s.emptyHint}>Tap + below to create your first goal</Text>
          </View>
        )}
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 72 }]}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── Quick-Add Contribution Sheet ── */}
      <BottomSheet
        visible={addContribGoalId !== null}
        onClose={() => { setAddContribGoalId(null); resetAddContribForm(); }}
        title="Add Contribution"
      >
        <ScrollView
          contentContainerStyle={s.sheetContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.fieldLabel}>Amount *</Text>
          <View style={s.inputRow}>
            <Text style={s.currencyPrefix}>{currencySymbol}</Text>
            <TextInput
              style={s.input}
              value={addContribAmount}
              onChangeText={setAddContribAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={ds.text.muted}
              autoFocus
            />
          </View>

          <Text style={s.fieldLabel}>Date</Text>
          <TouchableOpacity
            style={s.dateRow}
            onPress={() => setAddContribShowCal(c => !c)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="calendar" size={18} color={ds.text.muted} />
            <Text style={s.dateText}>
              {toDateStr(addContribDate) === toDateStr(new Date()) ? 'Today' : formatDateLocal(toDateStr(addContribDate))}
            </Text>
            <MaterialCommunityIcons name={addContribShowCal ? 'chevron-up' : 'chevron-down'} size={18} color={ds.text.muted} />
          </TouchableOpacity>
          {addContribShowCal && (
            <InlineCalendar
              value={addContribDate}
              onSelect={(d) => { setAddContribDate(d); setAddContribShowCal(false); }}
            />
          )}

          <Text style={s.fieldLabel}>Note (optional)</Text>
          <TextInput
            style={[s.input, s.textArea]}
            value={addContribNote}
            onChangeText={setAddContribNote}
            placeholder="e.g. Monthly deposit"
            placeholderTextColor={ds.text.muted}
            multiline
            numberOfLines={2}
          />

          <TouchableOpacity
            style={[s.ctaBtn, addContribSaving && s.ctaBtnDisabled]}
            onPress={handleQuickAdd}
            disabled={addContribSaving}
            activeOpacity={0.85}
          >
            <Text style={s.ctaText}>{addContribSaving ? 'Saving…' : 'Add Contribution'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheet>

      {/* ── Create Goal Sheet ── */}
      <BottomSheet
        visible={showCreate}
        onClose={() => { setShowCreate(false); resetCreateForm(); }}
        title="New Savings Goal"
      >
        <ScrollView
            contentContainerStyle={s.sheetContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Name */}
            <Text style={s.fieldLabel}>Goal name *</Text>
            <TextInput
              style={s.input}
              value={goalName}
              onChangeText={setGoalName}
              placeholder="e.g. Emergency fund"
              placeholderTextColor={ds.text.muted}
              autoFocus
            />

            {/* Target amount */}
            <Text style={s.fieldLabel}>Target amount *</Text>
            <View style={s.inputRow}>
              <Text style={s.currencyPrefix}>{currencySymbol}</Text>
              <TextInput
                style={s.input}
                value={goalTarget}
                onChangeText={setGoalTarget}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={ds.text.muted}
              />
            </View>

            {/* Target date */}
            <Text style={s.fieldLabel}>Target date (optional)</Text>
            <TouchableOpacity
              style={s.dateRow}
              onPress={() => setShowDateCal(c => !c)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="calendar" size={18} color={ds.text.muted} />
              <Text style={s.dateText}>
                {goalDate ? formatDateLocal(toDateStr(goalDate)) : 'No date set'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {goalDate && (
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); setGoalDate(null); setShowDateCal(false); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons name="close-circle" size={16} color={ds.text.muted} />
                  </TouchableOpacity>
                )}
                <MaterialCommunityIcons name={showDateCal ? 'chevron-up' : 'chevron-down'} size={18} color={ds.text.muted} />
              </View>
            </TouchableOpacity>
            {showDateCal && (
              <InlineCalendar
                value={goalDate ?? new Date()}
                onSelect={(d) => { setGoalDate(d); setShowDateCal(false); }}
              />
            )}

            {/* Icon picker */}
            <Text style={s.fieldLabel}>Icon</Text>
            <View style={s.iconGrid}>
              {GOAL_ICONS.map(({ icon, label }) => {
                const selected = goalIcon === icon;
                return (
                  <TouchableOpacity
                    key={icon}
                    style={[s.iconCell, selected && { borderColor: goalColor, backgroundColor: hexToRgba(goalColor, 0.15) }]}
                    onPress={() => setGoalIcon(icon)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name={icon} size={22} color={selected ? goalColor : ds.text.secondary} />
                    <Text style={[s.iconLabel, selected && { color: goalColor }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Color picker */}
            <Text style={s.fieldLabel}>Color</Text>
            <View style={s.colorRow}>
              {GOAL_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[s.swatch, { backgroundColor: c }, goalColor === c && s.swatchSelected]}
                  onPress={() => setGoalColor(c)}
                  activeOpacity={0.8}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[s.ctaBtn, creating && s.ctaBtnDisabled]}
              onPress={handleCreate}
              disabled={creating}
              activeOpacity={0.85}
            >
              <Text style={s.ctaText}>{creating ? 'Creating…' : 'Create Goal'}</Text>
            </TouchableOpacity>
          </ScrollView>
      </BottomSheet>
    </View>
  );
}
