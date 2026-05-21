import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { DS } from '../constants';
import { hexToRgba } from '../utils/color';
import { useCategoriesStore } from '../store/categoriesStore';
import { useAccountsStore } from '../store/accountsStore';
import { useTransactionsStore } from '../store/transactionsStore';
import { useSettingsStore } from '../store/settingsStore';
import { Category, RootStackParamList } from '../types';
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

// ── Category grid cell ────────────────────────────────────────────────────────

interface CategoryCellProps {
  category: Category;
  selected: boolean;
  onPress: () => void;
}

function CategoryCell({ category, selected, onPress }: CategoryCellProps) {
  return (
    <TouchableOpacity
      style={[
        s.categoryCell,
        selected && { borderColor: category.color, backgroundColor: hexToRgba(category.color, 0.12) },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          s.categoryIcon,
          {
            backgroundColor: selected
              ? hexToRgba(category.color, 0.25)
              : hexToRgba(category.color, 0.1),
          },
        ]}
      >
        <MaterialCommunityIcons
          name={category.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
          size={22}
          color={selected ? category.color : DS.text.muted}
        />
      </View>
      <Text
        style={[s.categoryLabel, selected && { color: category.color }]}
        numberOfLines={1}
      >
        {category.name}
      </Text>
    </TouchableOpacity>
  );
}

// ── Date picker sheet ─────────────────────────────────────────────────────────

interface DateSheetProps {
  visible: boolean;
  onClose: () => void;
  date: Date;
  onChange: (d: Date) => void;
}

function DateSheet({ visible, onClose, date, onChange }: DateSheetProps) {
  const [local, setLocal] = useState(date);

  useEffect(() => { if (visible) setLocal(date); }, [visible, date]);

  const shift = (days: number) => {
    const d = new Date(local);
    d.setDate(d.getDate() + days);
    setLocal(d);
  };

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const confirm = () => { onChange(local); onClose(); };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select Date">
      <View style={s.dateSheetBody}>
        {/* Quick chips */}
        <View style={s.dateChips}>
          {[
            { label: 'Yesterday', d: yesterday },
            { label: 'Today', d: today },
          ].map(({ label, d }) => {
            const active = isSameDay(local, d);
            return (
              <TouchableOpacity
                key={label}
                style={[s.dateChip, active && s.dateChipActive]}
                onPress={() => setLocal(new Date(d))}
                activeOpacity={0.8}
              >
                <Text style={[s.dateChipText, active && s.dateChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Day navigator */}
        <View style={s.dayNav}>
          <TouchableOpacity style={s.dayNavBtn} onPress={() => shift(-1)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={DS.text.secondary} />
          </TouchableOpacity>
          <Text style={s.dayNavLabel}>
            {local.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity
            style={s.dayNavBtn}
            onPress={() => shift(1)}
            disabled={isSameDay(local, today)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={isSameDay(local, today) ? DS.text.muted : DS.text.secondary}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.dateConfirmBtn} onPress={confirm} activeOpacity={0.85}>
          <Text style={s.dateConfirmText}>Confirm</Text>
        </TouchableOpacity>
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
  const { accounts } = useAccountsStore();
  const { currencySymbol } = useSettingsStore();
  const active = accounts.filter((a) => !a.is_archived);

  const ACCOUNT_ICONS: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
    bank: 'bank', cash: 'cash', wallet: 'wallet', credit: 'credit-card', other: 'shape-outline',
  };
  const ACCOUNT_COLORS: Record<string, string> = {
    bank: DS.primary, cash: DS.primaryLight, wallet: DS.tertiary, credit: DS.secondary, other: DS.purple,
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select Account">
      <View style={s.accountSheetBody}>
        {active.map((a) => {
          const icon = ACCOUNT_ICONS[a.type] ?? 'bank';
          const color = ACCOUNT_COLORS[a.type] ?? DS.primary;
          const isSelected = a.id === selectedId;
          const bal = (Math.abs(a.balance) / 100).toLocaleString('en-IN', {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
          });
          return (
            <TouchableOpacity
              key={a.id}
              style={[s.accountRow, isSelected && s.accountRowSelected]}
              onPress={() => { onSelect(a.id); onClose(); }}
              activeOpacity={0.75}
            >
              <View style={[s.accountRowIcon, { backgroundColor: hexToRgba(color, 0.15) }]}>
                <MaterialCommunityIcons name={icon} size={20} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.accountRowName}>{a.name}</Text>
                <Text style={s.accountRowBal}>{currencySymbol}{bal}</Text>
              </View>
              {isSelected && (
                <MaterialCommunityIcons name="check-circle" size={20} color={DS.primary} />
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
    <Animated.View style={[s.successOverlay, { opacity }]}>
      <Animated.View style={[s.successCircle, { transform: [{ scale }] }]}>
        <MaterialCommunityIcons name="check" size={48} color="#fff" />
      </Animated.View>
      <Text style={s.successText}>Saved!</Text>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

const CATEGORIES_COLLAPSED = 8;

export default function AddTransactionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();

  const { incomeCategories, expenseCategories, loadFromDB: loadCats } = useCategoriesStore();
  const { accounts, loadFromDB: loadAccounts } = useAccountsStore();
  const { addTransaction, updateTransaction } = useTransactionsStore();
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
      return new Date(y, m - 1, d);
    }
    return new Date();
  });
  const [description, setDescription] = useState(() => editTx?.description ?? '');
  const [notes, setNotes]             = useState(() => editTx?.notes ?? '');

  const [showAllCats, setShowAllCats] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen]       = useState(false);
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
    setShowAllCats(false);
    setCategoryError('');
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────

  const typeColor = txType === 'income' ? DS.primary : DS.secondary;
  const typeColorLight = txType === 'income' ? DS.primaryLight : DS.secondaryLight;
  const categories = txType === 'income' ? incomeCategories : expenseCategories;
  const visibleCats = showAllCats ? categories : categories.slice(0, CATEGORIES_COLLAPSED);
  const hiddenCount = categories.length - CATEGORIES_COLLAPSED;

  const selectedAccount = accounts.find((a) => a.id === accountId);

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
      const payload = {
        type: txType,
        amount: amountPaise,
        account_id: accountId!,
        category_id: categoryId,
        transaction_date: toISODate(date),
        description: description.trim() || null,
        notes: notes.trim() || null,
      };
      if (isEditing) {
        await updateTransaction(editTx!.id, payload);
      } else {
        await addTransaction(payload);
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
    <View style={s.root}>
      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={s.closeBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="close" size={24} color={DS.text.secondary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEditing ? 'Edit Transaction' : 'Add Transaction'}</Text>
        <View style={s.closeBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.scrollContent, { paddingBottom: 16 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Type tabs ── */}
          <View style={s.typeTabs}>
            {(['expense', 'income'] as const).map((t) => {
              const active = txType === t;
              const tColor = t === 'income' ? DS.primary : DS.secondary;
              const tColorLight = t === 'income' ? DS.primaryLight : DS.secondaryLight;
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    s.typeTab,
                    active
                      ? { backgroundColor: hexToRgba(tColor, 0.18), borderColor: tColor }
                      : { borderColor: DS.border.subtle },
                  ]}
                  onPress={() => handleTypeSwitch(t)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={t === 'income' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                    size={18}
                    color={active ? tColorLight : DS.text.muted}
                  />
                  <Text style={[s.typeTabText, active && { color: tColorLight }]}>
                    {t === 'income' ? 'Income' : 'Expense'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Amount ── */}
          <TouchableOpacity
            style={s.amountSection}
            activeOpacity={1}
            onPress={() => amountRef.current?.focus()}
          >
            <Text style={[s.currencySymbol, { color: typeColor }]}>{currencySymbol}</Text>
            <TextInput
              ref={amountRef}
              style={[s.amountInput, { color: amount ? typeColorLight : DS.text.muted }]}
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              autoFocus
              placeholder="0"
              placeholderTextColor={DS.text.muted}
              selectionColor={typeColor}
              returnKeyType="done"
            />
          </TouchableOpacity>
          {amountError ? (
            <Text style={[s.errorText, { textAlign: 'center' }]}>{amountError}</Text>
          ) : null}

          {/* ── Category ── */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Category</Text>
              {categoryError ? <Text style={s.errorText}>{categoryError}</Text> : null}
            </View>
            {categories.length === 0 ? (
              <Text style={s.emptyHint}>No categories found.</Text>
            ) : (
              <>
                <View style={s.categoryGrid}>
                  {visibleCats.map((cat) => (
                    <CategoryCell
                      key={cat.id}
                      category={cat}
                      selected={categoryId === cat.id}
                      onPress={() => { setCategoryId(cat.id); setCategoryError(''); }}
                    />
                  ))}
                </View>
                {hiddenCount > 0 && (
                  <TouchableOpacity
                    style={s.showMoreBtn}
                    onPress={() => setShowAllCats((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.showMoreText}>
                      {showAllCats ? 'Show less' : `Show ${hiddenCount} more`}
                    </Text>
                    <MaterialCommunityIcons
                      name={showAllCats ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={DS.text.muted}
                    />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* ── Details rows ── */}
          <View style={s.detailsCard}>
            {/* Account */}
            <TouchableOpacity
              style={s.detailRow}
              onPress={() => setAccountSheetOpen(true)}
              activeOpacity={0.75}
            >
              <View style={[s.detailIcon, { backgroundColor: hexToRgba(DS.primary, 0.12) }]}>
                <MaterialCommunityIcons name="bank-outline" size={18} color={DS.primary} />
              </View>
              <View style={s.detailContent}>
                <Text style={s.detailLabel}>Account</Text>
                <Text style={[s.detailValue, !selectedAccount && s.detailPlaceholder]}>
                  {selectedAccount?.name ?? 'Select account'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={DS.text.muted} />
            </TouchableOpacity>
            {accountError ? <Text style={[s.errorText, { marginLeft: 52, marginBottom: 8 }]}>{accountError}</Text> : null}

            <View style={s.divider} />

            {/* Date */}
            <TouchableOpacity
              style={s.detailRow}
              onPress={() => setDateSheetOpen(true)}
              activeOpacity={0.75}
            >
              <View style={[s.detailIcon, { backgroundColor: hexToRgba(DS.tertiary, 0.12) }]}>
                <MaterialCommunityIcons name="calendar-outline" size={18} color={DS.tertiary} />
              </View>
              <View style={s.detailContent}>
                <Text style={s.detailLabel}>Date</Text>
                <Text style={s.detailValue}>
                  {formatDateLabel(date)}
                  {!isSameDay(date, new Date()) && ` · ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={DS.text.muted} />
            </TouchableOpacity>
          </View>

          {/* ── Description ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Description</Text>
            <View style={s.inputWrap}>
              <TextInput
                style={s.textInput}
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. Swiggy order, EMI payment…"
                placeholderTextColor={DS.text.muted}
                selectionColor={DS.primary}
                returnKeyType="next"
                maxLength={120}
              />
            </View>
          </View>

          {/* ── Notes ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Notes <Text style={s.optionalTag}>(optional)</Text></Text>
            <View style={[s.inputWrap, s.notesWrap]}>
              <TextInput
                style={[s.textInput, s.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any extra details…"
                placeholderTextColor={DS.text.muted}
                selectionColor={DS.primary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={500}
              />
            </View>
          </View>
        </ScrollView>

        {/* ── CTA ── */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[
              s.saveBtn,
              { backgroundColor: typeColor },
              saving && { opacity: 0.6 },
            ]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#fff" />
            <Text style={s.saveBtnText}>
              {saving ? 'Saving…' : isEditing ? `Update ${txType === 'income' ? 'Income' : 'Expense'}` : `Add ${txType === 'income' ? 'Income' : 'Expense'}`}
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
      />

      {/* ── Success overlay ── */}
      <SuccessOverlay visible={showSuccess} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const CELL_COLS = 4;
const CELL_SIZE = Math.floor((SCREEN_W - 32 - (CELL_COLS - 1) * 8) / CELL_COLS);

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DS.surface.screen,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: DS.border.subtle,
    backgroundColor: DS.surface.screen,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    lineHeight: 24,
    color: DS.text.primary,
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
    borderRadius: DS.radius.lg,
    borderWidth: 1.5,
    backgroundColor: DS.surface.elevated,
  },
  typeTabText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: DS.text.muted,
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
    maxWidth: SCREEN_W - 80,
    padding: 0,
    includeFontPadding: false,
  },

  // Error
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: DS.secondaryLight,
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
    color: DS.text.muted,
  },
  optionalTag: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: DS.text.muted,
    textTransform: 'none',
    letterSpacing: 0,
  },
  emptyHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: DS.text.muted,
    paddingVertical: 8,
  },

  // Category grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: DS.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: DS.surface.elevated,
    borderWidth: 1.5,
    borderColor: DS.border.subtle,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 14,
    color: DS.text.muted,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  showMoreText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: DS.text.muted,
  },

  // Details card
  detailsCard: {
    backgroundColor: DS.surface.card,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.border.subtle,
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
    color: DS.text.muted,
    marginBottom: 2,
  },
  detailValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    lineHeight: 20,
    color: DS.text.primary,
  },
  detailPlaceholder: { color: DS.text.muted },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DS.border.subtle,
    marginLeft: 64,
  },

  // Text inputs
  inputWrap: {
    backgroundColor: DS.surface.elevated,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: DS.border.subtle,
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
    color: DS.text.primary,
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
    borderTopColor: DS.border.subtle,
    backgroundColor: DS.surface.screen,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: DS.radius.md,
  },
  saveBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    lineHeight: 22,
    color: '#fff',
  },

  // Date sheet
  dateSheetBody: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  dateChips: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  dateChip: {
    flex: 1,
    height: 44,
    borderRadius: DS.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DS.surface.elevated,
    borderWidth: 1,
    borderColor: DS.border.subtle,
  },
  dateChipActive: { backgroundColor: hexToRgba(DS.primary, 0.18), borderColor: DS.primary },
  dateChipText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: DS.text.muted,
  },
  dateChipTextActive: { color: DS.primaryLight },
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.surface.elevated,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.border.subtle,
    marginBottom: 20,
    overflow: 'hidden',
  },
  dayNavBtn: {
    width: 48,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNavLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: DS.text.primary,
  },
  dateConfirmBtn: {
    height: 52,
    borderRadius: DS.radius.md,
    backgroundColor: DS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateConfirmText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: '#fff',
  },

  // Account sheet
  accountSheetBody: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 6 },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: DS.radius.lg,
    backgroundColor: DS.surface.elevated,
    borderWidth: 1,
    borderColor: DS.border.subtle,
  },
  accountRowSelected: {
    borderColor: DS.primary,
    backgroundColor: hexToRgba(DS.primary, 0.08),
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
    color: DS.text.primary,
  },
  accountRowBal: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: DS.text.muted,
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
    backgroundColor: DS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: DS.primary,
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
