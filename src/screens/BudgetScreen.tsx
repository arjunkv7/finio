import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DS } from '../constants';
import { useSettingsStore } from '../store/settingsStore';
import { useBudgetStore } from '../store/budgetStore';
import { BottomSheet, ProgressBar, EmptyState } from '../components';
import { Category, BudgetProgress } from '../types/db';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BudgetRow {
  category: Category;
  progress: BudgetProgress | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function barColor(pct: number): string {
  if (pct >= 100) return DS.secondary;
  if (pct >= 80)  return DS.tertiary;
  return DS.primary;
}

function fmtAmt(n: number, sym: string): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 100_000) return `${sign}${sym}${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000)   return `${sign}${sym}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${sym}${abs.toLocaleString()}`;
}

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function prevMonth(y: number, m: number): [number, number] {
  return m === 1 ? [y - 1, 12] : [y, m - 1];
}
function nextMonth(y: number, m: number): [number, number] {
  return m === 12 ? [y + 1, 1] : [y, m + 1];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BudgetScreen() {
  const insets = useSafeAreaInsets();
  const sym = useSettingsStore(s => s.currencySymbol);
  const { budgets, progress, allExpenseCategories, isLoading, loadFromDB, upsertBudget } = useBudgetStore();

  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  // ── Bottom sheet state ────────────────────────────────────────────────────
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetCategory, setSheetCategory] = useState<Category | null>(null);
  const [limitInput, setLimitInput] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      loadFromDB(year, month);
    }, [year, month, loadFromDB])
  );

  // ── Derived rows ──────────────────────────────────────────────────────────

  const progressMap = useMemo(
    () => new Map(progress.map(p => [p.budget.category_id, p])),
    [progress]
  );

  const budgetedRows = useMemo<BudgetRow[]>(() => {
    const rows = allExpenseCategories
      .filter(c => budgets.some(b => b.category_id === c.id))
      .map(c => ({ category: c, progress: progressMap.get(c.id) ?? null }));

    // Over-budget first, then by percent desc
    return rows.sort((a, b) => {
      const pa = a.progress?.percent ?? 0;
      const pb = b.progress?.percent ?? 0;
      return pb - pa;
    });
  }, [allExpenseCategories, budgets, progressMap]);

  const unbudgetedCategories = useMemo(
    () => allExpenseCategories.filter(c => !budgets.some(b => b.category_id === c.id)),
    [allExpenseCategories, budgets]
  );

  const totalBudgeted = useMemo(
    () => budgets.reduce((s, b) => s + b.monthly_limit, 0),
    [budgets]
  );
  const totalSpent = useMemo(
    () => progress.reduce((s, p) => s + p.spent, 0),
    [progress]
  );
  const overallPct = totalBudgeted > 0 ? Math.min(100, Math.round((totalSpent / totalBudgeted) * 100)) : 0;

  // ── Sheet open / save ────────────────────────────────────────────────────

  const openSheet = (cat: Category) => {
    const existing = budgets.find(b => b.category_id === cat.id);
    setSheetCategory(cat);
    setLimitInput(existing ? String(existing.monthly_limit) : '');
    setSheetVisible(true);
  };

  const handleSave = async () => {
    if (!sheetCategory) return;
    const val = parseInt(limitInput.replace(/[^0-9]/g, ''), 10);
    if (!val || val <= 0) return;
    setSaving(true);
    try {
      await upsertBudget(sheetCategory.id, val);
      await loadFromDB(year, month);
      setSheetVisible(false);
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading && budgets.length === 0 && allExpenseCategories.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={DS.primary} size="large" />
      </View>
    );
  }

  const hasBudgets = budgets.length > 0;

  return (
    <View style={styles.root}>
      {/* Month navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => { const [y, m] = prevMonth(year, month); setYear(y); setMonth(m); }}
        >
          <MaterialCommunityIcons name="chevron-left" size={20} color={DS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTH_ABBR[month - 1]} {year}</Text>
        <TouchableOpacity
          style={[styles.navBtn, isCurrentMonth && styles.navBtnDisabled]}
          onPress={() => {
            if (!isCurrentMonth) { const [y, m] = nextMonth(year, month); setYear(y); setMonth(m); }
          }}
        >
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={isCurrentMonth ? DS.text.muted : DS.text.primary}
          />
        </TouchableOpacity>
      </View>

      {!hasBudgets ? (
        <EmptyState
          icon="speedometer-medium"
          title="No budgets yet"
          message="Set monthly limits for your spending categories to track where your money goes."
          action={{ label: 'Set your first budget', onPress: () => unbudgetedCategories[0] && openSheet(unbudgetedCategories[0]) }}
        />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Overview card */}
          <View style={styles.overviewCard}>
            <View style={styles.overviewTopRow}>
              <View>
                <Text style={styles.overviewLabel}>Total Budgeted</Text>
                <Text style={styles.overviewValue}>{fmtAmt(totalBudgeted, sym)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.overviewLabel}>Total Spent</Text>
                <Text style={[styles.overviewValue, { color: barColor(overallPct) }]}>
                  {fmtAmt(totalSpent, sym)}
                </Text>
              </View>
            </View>
            <ProgressBar value={totalSpent} max={totalBudgeted} color={barColor(overallPct)} height={8} />
            <View style={styles.overviewFooter}>
              <Text style={styles.overviewRemaining}>
                {totalSpent <= totalBudgeted
                  ? `${fmtAmt(totalBudgeted - totalSpent, sym)} remaining`
                  : `${fmtAmt(totalSpent - totalBudgeted, sym)} over budget`}
              </Text>
              <Text style={[styles.overviewPct, { color: barColor(overallPct) }]}>{overallPct}%</Text>
            </View>
          </View>

          {/* Budgeted categories */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categories</Text>
            {budgetedRows.map(row => (
              <BudgetCategoryRow
                key={row.category.id}
                row={row}
                sym={sym}
                onPress={() => openSheet(row.category)}
              />
            ))}
          </View>

          {/* Unbudgeted categories */}
          {unbudgetedCategories.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Set Budget</Text>
              {unbudgetedCategories.map(cat => (
                <UnbudgetedRow key={cat.id} cat={cat} onPress={() => openSheet(cat)} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Unbudgeted list even in empty state so user can add */}
      {!hasBudgets && unbudgetedCategories.length > 0 && (
        <ScrollView
          style={styles.emptyUnbudgetedScroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Set Budget</Text>
          {unbudgetedCategories.map(cat => (
            <UnbudgetedRow key={cat.id} cat={cat} onPress={() => openSheet(cat)} />
          ))}
        </ScrollView>
      )}

      {/* Edit bottom sheet */}
      <BottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title={sheetCategory ? `${sheetCategory.name} Budget` : 'Set Budget'}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetBody}
        >
          <Text style={styles.sheetLabel}>Monthly limit ({sym})</Text>
          <TextInput
            style={styles.sheetInput}
            value={limitInput}
            onChangeText={setLimitInput}
            placeholder="e.g. 5000"
            placeholderTextColor={DS.text.muted}
            keyboardType="numeric"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          <TouchableOpacity
            style={[styles.sheetSaveBtn, (!limitInput || saving) && styles.sheetSaveBtnDisabled]}
            onPress={handleSave}
            disabled={!limitInput || saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sheetSaveBtnTxt}>Save Budget</Text>
            }
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </BottomSheet>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BudgetCategoryRow({
  row,
  sym,
  onPress,
}: {
  row: BudgetRow;
  sym: string;
  onPress: () => void;
}) {
  const { category, progress } = row;
  const spent = progress?.spent ?? 0;
  const limit = progress?.limit ?? (row.category as any).__limit ?? 0;
  const pct   = progress?.percent ?? 0;
  const color = barColor(pct);
  const isOver = pct >= 100;

  return (
    <TouchableOpacity
      style={[styles.catRow, isOver && styles.catRowOver]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.catIcon, { backgroundColor: `${category.color}22` }]}>
        <MaterialCommunityIcons name={category.icon as any} size={18} color={category.color} />
      </View>

      <View style={styles.catInfo}>
        <View style={styles.catTopRow}>
          <View style={styles.catNameRow}>
            <Text style={styles.catName}>{category.name}</Text>
            {isOver && (
              <View style={styles.overBadge}>
                <Text style={styles.overBadgeTxt}>OVER</Text>
              </View>
            )}
          </View>
          <Text style={[styles.catAmt, { color }]}>
            {fmtAmt(spent, sym)}
            <Text style={styles.catLimit}> / {fmtAmt(limit, sym)}</Text>
          </Text>
        </View>

        <ProgressBar value={spent} max={limit} color={color} height={6} />

        <View style={styles.catBottomRow}>
          <Text style={[styles.catPct, { color }]}>{pct}% used</Text>
          <MaterialCommunityIcons name="pencil-outline" size={13} color={DS.text.muted} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function UnbudgetedRow({ cat, onPress }: { cat: Category; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.unbudgetedRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.catIcon, { backgroundColor: `${cat.color}18` }]}>
        <MaterialCommunityIcons name={cat.icon as any} size={18} color={`${cat.color}88`} />
      </View>
      <Text style={styles.unbudgetedName}>{cat.name}</Text>
      <View style={styles.setBudgetBtn}>
        <Text style={styles.setBudgetTxt}>Set Budget</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: DS.surface.screen },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },

  // Month nav
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: DS.border.subtle,
  },
  navBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: DS.surface.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  monthLabel: {
    fontFamily: 'Inter_600SemiBold', fontSize: 14, color: DS.text.primary,
    minWidth: 90, textAlign: 'center',
  },

  // Overview card
  overviewCard: {
    backgroundColor: DS.surface.card,
    borderRadius: DS.radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: DS.border.subtle,
    gap: 12,
  },
  overviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  overviewLabel: {
    fontFamily: 'Inter_400Regular', fontSize: 11, color: DS.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3,
  },
  overviewValue: {
    fontFamily: 'Inter_700Bold', fontSize: 22, color: DS.text.primary,
  },
  overviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewRemaining: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: DS.text.muted,
  },
  overviewPct: {
    fontFamily: 'Inter_700Bold', fontSize: 14,
  },

  // Section
  section: { gap: 10 },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold', fontSize: 13, color: DS.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  // Category row (budgeted)
  catRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: DS.surface.card,
    borderRadius: DS.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: DS.border.subtle,
  },
  catRowOver: {
    borderColor: `${DS.secondary}44`,
    backgroundColor: `${DS.secondary}0A`,
  },
  catIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  catInfo:   { flex: 1, gap: 6 },
  catTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  catNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  catName:   { fontFamily: 'Inter_500Medium', fontSize: 14, color: DS.text.primary },
  catAmt:    { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  catLimit:  { fontFamily: 'Inter_400Regular', fontSize: 12, color: DS.text.muted },
  catBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catPct:    { fontFamily: 'Inter_500Medium', fontSize: 11 },

  // Over-budget badge
  overBadge: {
    backgroundColor: `${DS.secondary}22`,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  overBadgeTxt: {
    fontFamily: 'Inter_700Bold', fontSize: 9, color: DS.secondary, letterSpacing: 0.5,
  },

  // Unbudgeted row
  unbudgetedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: DS.surface.card,
    borderRadius: DS.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: DS.border.subtle,
    opacity: 0.7,
  },
  unbudgetedName: {
    flex: 1,
    fontFamily: 'Inter_400Regular', fontSize: 14, color: DS.text.muted,
  },
  setBudgetBtn: {
    backgroundColor: DS.surface.elevated,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: DS.border.medium,
  },
  setBudgetTxt: {
    fontFamily: 'Inter_600SemiBold', fontSize: 12, color: DS.text.secondary,
  },

  // Empty state unbudgeted scroll
  emptyUnbudgetedScroll: {
    flex: 1,
  },

  // Bottom sheet
  sheetBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  sheetLabel: {
    fontFamily: 'Inter_500Medium', fontSize: 13, color: DS.text.secondary,
  },
  sheetInput: {
    backgroundColor: DS.surface.elevated,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: DS.border.medium,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 20,
    color: DS.text.primary,
    textAlign: 'center',
  },
  sheetSaveBtn: {
    backgroundColor: DS.primary,
    borderRadius: DS.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  sheetSaveBtnDisabled: { opacity: 0.45 },
  sheetSaveBtnTxt: {
    fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff',
  },
});
