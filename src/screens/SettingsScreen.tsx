import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Switch,
  StyleSheet,
  Alert,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';
import { hexToRgba } from '../utils/color';
import { useSettingsStore } from '../store/settingsStore';
import { useCategoriesStore } from '../store/categoriesStore';
import { useAccountsStore } from '../store/accountsStore';
import { useTransactionsStore } from '../store/transactionsStore';
import { useSavingsStore } from '../store/savingsStore';
import { useInvestmentsStore } from '../store/investmentsStore';
import { clearAllUserData, updateSettings } from '../db/database';
import { Category, CategoryType } from '../types/db';
import AppCard from '../components/AppCard';
import BottomSheet from '../components/BottomSheet';

// ── Types ────────────────────────────────────────────────────────────────────

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type ScreenView = 'main' | 'categories';

// ── Constants ────────────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: 'INR', symbol: '₹',    name: 'Indian Rupee' },
  { code: 'USD', symbol: '$',    name: 'US Dollar' },
  { code: 'EUR', symbol: '€',    name: 'Euro' },
  { code: 'GBP', symbol: '£',    name: 'British Pound' },
  { code: 'JPY', symbol: '¥',    name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥',    name: 'Chinese Yuan' },
  { code: 'AUD', symbol: 'A$',   name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$',   name: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'Fr',   name: 'Swiss Franc' },
  { code: 'SGD', symbol: 'S$',   name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ',  name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼',    name: 'Saudi Riyal' },
  { code: 'HKD', symbol: 'HK$',  name: 'Hong Kong Dollar' },
  { code: 'NZD', symbol: 'NZ$',  name: 'New Zealand Dollar' },
  { code: 'SEK', symbol: 'kr',   name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr',   name: 'Norwegian Krone' },
  { code: 'MYR', symbol: 'RM',   name: 'Malaysian Ringgit' },
  { code: 'THB', symbol: '฿',    name: 'Thai Baht' },
  { code: 'BRL', symbol: 'R$',   name: 'Brazilian Real' },
  { code: 'ZAR', symbol: 'R',    name: 'South African Rand' },
] as const;

const THEME_OPTIONS: { value: 'dark' | 'light' | 'system'; label: string; icon: IconName }[] = [
  { value: 'dark',   label: 'Dark',   icon: 'weather-night' },
  { value: 'light',  label: 'Light',  icon: 'white-balance-sunny' },
  { value: 'system', label: 'System', icon: 'theme-light-dark' },
];

const CAT_ICONS: IconName[] = [
  'food-fork-drink', 'car',          'home',        'shopping',
  'medical-bag',     'school',       'airplane',    'cash',
  'briefcase',       'gift',         'coffee',      'heart',
  'dumbbell',        'music-note',   'television',  'book-open-variant',
  'gamepad-variant', 'baby-carriage','phone',       'cart',
];

const CAT_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#F43F5E', '#06B6D4', '#EC4899', '#EF4444'];

const PIN_LENGTH = 4;

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatBackupDate = (iso: string | null): string => {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

// ── Styles factory ────────────────────────────────────────────────────────────

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
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: ds.surface.elevated,
      alignItems: 'center', justifyContent: 'center',
    },
    addIconBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: hexToRgba(ds.primary, 0.12),
      alignItems: 'center', justifyContent: 'center',
    },

    scroll: { flex: 1 },
    scrollContent: { padding: 16, gap: 8 },

    sectionLabel: {
      fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 15,
      letterSpacing: 0.8, textTransform: 'uppercase',
      color: ds.text.muted, marginBottom: 4, marginLeft: 4, marginTop: 8,
    },

    card: { overflow: 'hidden' },

    row: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    },
    rowIcon: {
      width: 34, height: 34, borderRadius: 10,
      backgroundColor: ds.surface.elevated,
      alignItems: 'center', justifyContent: 'center',
    },
    rowLabel: {
      flex: 1, fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 20, color: ds.text.primary,
    },
    rowValue: {
      fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: ds.text.muted,
    },
    rowDivider: {
      height: StyleSheet.hairlineWidth, backgroundColor: ds.border.subtle, marginLeft: 62,
    },

    deleteAction: {
      width: 68, backgroundColor: ds.secondary,
      alignItems: 'center', justifyContent: 'center',
    },

    // Currency picker
    currencyList: { maxHeight: 400, paddingHorizontal: 4 },
    currencyRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14, gap: 14,
      borderRadius: ds.radius.md,
    },
    currencyRowActive: { backgroundColor: hexToRgba(ds.primary, 0.08) },
    currencySymbol: {
      fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 24, width: 32, textAlign: 'center',
    },
    currencyInfo: { flex: 1, gap: 2 },
    currencyCode: {
      fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 20, color: ds.text.primary,
    },
    currencyName: {
      fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: ds.text.muted,
    },

    // Theme options
    themeOptions: { padding: 20, gap: 10 },
    themeOption: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      padding: 16, borderRadius: ds.radius.lg,
      borderWidth: 1.5, borderColor: ds.border.subtle,
    },
    themeOptionActive: { borderColor: ds.primary, backgroundColor: hexToRgba(ds.primary, 0.06) },
    themeIconWrap: {
      width: 40, height: 40, borderRadius: ds.radius.lg,
      backgroundColor: ds.surface.elevated,
      alignItems: 'center', justifyContent: 'center',
    },
    themeOptionText: {
      flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: ds.text.primary,
    },

    // Categories view
    tabRow: {
      flexDirection: 'row', padding: 12, gap: 8,
      borderBottomWidth: 1, borderBottomColor: ds.border.subtle,
    },
    tabBtn: {
      flex: 1, paddingVertical: 8, borderRadius: ds.radius.md,
      backgroundColor: ds.surface.elevated,
      alignItems: 'center',
    },
    tabBtnActive: { backgroundColor: ds.primary },
    tabBtnText: {
      fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18, color: ds.text.muted,
    },
    tabBtnTextActive: { color: '#fff' },

    catRow: {
      flexDirection: 'row', alignItems: 'center',
      height: 62, paddingHorizontal: 16, gap: 12,
      backgroundColor: ds.surface.screen,
    },
    catIcon: {
      width: 38, height: 38, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    catName: {
      flex: 1, fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 20, color: ds.text.primary,
    },
    systemBadge: {
      backgroundColor: ds.surface.elevated, borderRadius: ds.radius.full,
      paddingHorizontal: 8, paddingVertical: 3,
    },
    systemBadgeText: {
      fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 14, color: ds.text.muted,
    },

    divider: {
      height: StyleSheet.hairlineWidth, backgroundColor: ds.border.subtle,
    },

    // Sheet / form
    sheetContent: { padding: 20, gap: 6, paddingBottom: 8 },
    fieldLabel: {
      fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 14,
      letterSpacing: 0.5, textTransform: 'uppercase', color: ds.text.muted, marginTop: 10,
    },
    input: {
      height: 44, backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.md, borderWidth: 1, borderColor: ds.border.subtle,
      paddingHorizontal: 14,
      fontFamily: 'Inter_400Regular', fontSize: 15, color: ds.text.primary,
    },
    typeRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    typeChip: {
      flex: 1, alignItems: 'center', paddingVertical: 8,
      borderRadius: ds.radius.md, borderWidth: 1.5, borderColor: ds.border.medium,
    },
    typeChipText: {
      fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18, color: ds.text.secondary,
    },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    iconCell: {
      width: 42, height: 42, borderRadius: ds.radius.md,
      borderWidth: 1.5, borderColor: ds.border.subtle,
      alignItems: 'center', justifyContent: 'center',
    },
    colorRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    swatch: { width: 30, height: 30, borderRadius: 15 },
    swatchSelected: { borderWidth: 3, borderColor: '#fff' },
    ctaBtn: {
      marginTop: 16, height: 52, borderRadius: ds.radius.lg,
      backgroundColor: ds.primary, alignItems: 'center', justifyContent: 'center',
    },
    ctaBtnDisabled: { opacity: 0.5 },
    ctaText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#fff' },

    emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 40 },
    emptyTitle: {
      fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: ds.text.secondary,
    },
    emptyHint: {
      fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: ds.text.muted,
    },

    // PIN Modal styles
    pmOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.85)',
      justifyContent: 'flex-end',
    },
    pmContainer: {
      backgroundColor: ds.surface.card,
      borderTopLeftRadius: ds.radius.xl,
      borderTopRightRadius: ds.radius.xl,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: ds.border.subtle,
      paddingTop: 12, paddingHorizontal: 24, paddingBottom: 24,
      ...ds.shadow.modal,
    },
    pmHeader: {
      alignItems: 'flex-end', marginBottom: 8,
    },
    pmTitle: {
      fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 28,
      letterSpacing: -0.4, color: ds.text.primary,
      textAlign: 'center', marginBottom: 8,
    },
    pmSubtitle: {
      fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20,
      color: ds.text.muted, textAlign: 'center', marginBottom: 28,
    },
    pmDots: {
      flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 36,
    },
    pmDot: {
      width: 16, height: 16, borderRadius: 8,
      borderWidth: 2, borderColor: ds.border.medium,
      backgroundColor: 'transparent',
    },
    pmDotFilled: {
      backgroundColor: ds.primary, borderColor: ds.primary,
    },
    pmKeypad: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 0,
    },
    pmKeyCell: {
      width: '33.33%', aspectRatio: 1.6,
      alignItems: 'center', justifyContent: 'center',
    },
    pmKeyText: {
      fontFamily: 'Inter_400Regular', fontSize: 26, lineHeight: 32, color: ds.text.primary,
    },
  });
}

// ── ManageCategoriesView ──────────────────────────────────────────────────────

interface ManageCatProps { onBack: () => void }

function ManageCategoriesView({ onBack }: ManageCatProps) {
  const insets   = useSafeAreaInsets();
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);
  const { incomeCategories, expenseCategories, addCategory, updateCategory, deleteCategory, loadFromDB } = useCategoriesStore();

  const [tab,        setTab]        = useState<CategoryType>('expense');
  const [showForm,   setShowForm]   = useState(false);
  const [editCat,    setEditCat]    = useState<Category | null>(null);
  const [catName,    setCatName]    = useState('');
  const [catIcon,    setCatIcon]    = useState<IconName>('cash');
  const [catColor,   setCatColor]   = useState(CAT_COLORS[0]);
  const [catType,    setCatType]    = useState<CategoryType>('expense');
  const [saving,     setSaving]     = useState(false);

  useFocusEffect(useCallback(() => { loadFromDB(); }, [loadFromDB]));

  const cats = tab === 'income' ? incomeCategories : expenseCategories;

  const openAdd = () => {
    setEditCat(null);
    setCatName(''); setCatIcon('cash'); setCatColor(CAT_COLORS[0]); setCatType(tab);
    setShowForm(true);
  };

  const openEdit = (cat: Category) => {
    setEditCat(cat);
    setCatName(cat.name);
    setCatIcon(cat.icon as IconName);
    setCatColor(cat.color);
    setCatType(cat.type);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!catName.trim()) { Alert.alert('Name required'); return; }
    setSaving(true);
    try {
      if (editCat) {
        await updateCategory(editCat.id, {
          name: catName.trim(),
          icon: catIcon,
          color: catColor,
        });
      } else {
        await addCategory({
          name: catName.trim(),
          type: catType,
          icon: catIcon,
          color: catColor,
        });
      }
      setShowForm(false);
    } catch {
      Alert.alert('Error', 'Could not save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (cat: Category) => {
    if (cat.is_system) { Alert.alert('System categories cannot be deleted'); return; }
    Alert.alert(
      'Delete category?',
      `Remove "${cat.name}"? Transactions using it will remain but lose their category.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteCategory(cat.id) },
      ]
    );
  };

  const renderCat = ({ item }: { item: Category }) => {
    const isSystem = item.is_system === 1;
    return (
      <CatRow
        cat={item}
        onEdit={() => openEdit(item)}
        onDelete={isSystem ? undefined : () => handleDelete(item)}
      />
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={ds.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Categories</Text>
        <TouchableOpacity style={styles.addIconBtn} onPress={openAdd} activeOpacity={0.8}>
          <MaterialCommunityIcons name="plus" size={22} color={ds.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['expense', 'income'] as CategoryType[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={cats}
        keyExtractor={c => c.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No {tab} categories</Text>
            <Text style={styles.emptyHint}>Tap + to create one</Text>
          </View>
        }
        renderItem={renderCat}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
      />

      {/* Add/Edit category form */}
      <BottomSheet
        visible={showForm}
        onClose={() => setShowForm(false)}
        title={editCat ? (editCat.is_system ? 'View Category' : 'Edit Category') : 'New Category'}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Type (add only) */}
            {!editCat && (
              <>
                <Text style={styles.fieldLabel}>Type</Text>
                <View style={styles.typeRow}>
                  {(['expense', 'income'] as CategoryType[]).map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeChip, catType === t && { backgroundColor: t === 'income' ? ds.primary : ds.secondary, borderColor: 'transparent' }]}
                      onPress={() => setCatType(t)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.typeChipText, catType === t && { color: '#fff' }]}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Name */}
            <Text style={styles.fieldLabel}>Name *</Text>
            <TextInput
              style={styles.input}
              value={catName}
              onChangeText={setCatName}
              placeholder="Category name"
              placeholderTextColor={ds.text.muted}
              autoFocus={!editCat?.is_system}
              editable={!editCat?.is_system}
            />

            {/* Icon */}
            <Text style={styles.fieldLabel}>Icon</Text>
            <View style={styles.iconGrid}>
              {CAT_ICONS.map(icon => {
                const sel = catIcon === icon;
                return (
                  <TouchableOpacity
                    key={icon}
                    style={[styles.iconCell, sel && { borderColor: catColor, backgroundColor: hexToRgba(catColor, 0.15) }]}
                    onPress={() => !editCat?.is_system && setCatIcon(icon)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name={icon} size={20} color={sel ? catColor : ds.text.secondary} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Color */}
            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.colorRow}>
              {CAT_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.swatch, { backgroundColor: c }, catColor === c && styles.swatchSelected]}
                  onPress={() => !editCat?.is_system && setCatColor(c)}
                  activeOpacity={0.8}
                />
              ))}
            </View>

            {!editCat?.is_system && (
              <TouchableOpacity
                style={[styles.ctaBtn, saving && styles.ctaBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaText}>{saving ? 'Saving…' : editCat ? 'Save Changes' : 'Create Category'}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheet>
    </View>
  );
}

// ── CatRow ────────────────────────────────────────────────────────────────────

const CAT_ROW_H = 62;

function CatRow({ cat, onEdit, onDelete }: { cat: Category; onEdit: () => void; onDelete?: () => void }) {
  const swipeRef = React.useRef<Swipeable>(null);
  const isSystem = cat.is_system === 1;
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);

  const renderRight = (progress: Animated.AnimatedInterpolation<number>) => {
    if (!onDelete) return null;
    const tx = progress.interpolate({ inputRange: [0, 1], outputRange: [68, 0] });
    return (
      <Animated.View style={{ transform: [{ translateX: tx }] }}>
        <TouchableOpacity
          style={[styles.deleteAction, { height: CAT_ROW_H }]}
          onPress={() => { swipeRef.current?.close(); onDelete(); }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={onDelete ? renderRight : undefined}
      overshootRight={false}
      friction={2}
    >
      <TouchableOpacity style={styles.catRow} onPress={onEdit} activeOpacity={0.8}>
        <View style={[styles.catIcon, { backgroundColor: hexToRgba(cat.color, 0.15) }]}>
          <MaterialCommunityIcons name={cat.icon as IconName} size={18} color={cat.color} />
        </View>
        <Text style={styles.catName} numberOfLines={1}>{cat.name}</Text>
        {isSystem && (
          <View style={styles.systemBadge}>
            <Text style={styles.systemBadgeText}>System</Text>
          </View>
        )}
        <MaterialCommunityIcons name="chevron-right" size={18} color={ds.text.muted} />
      </TouchableOpacity>
    </Swipeable>
  );
}

// ── PINModal ──────────────────────────────────────────────────────────────────

interface PINModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (pin: string) => void;
}

function PINModal({ visible, onClose, onSuccess }: PINModalProps) {
  const insets      = useSafeAreaInsets();
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);
  const [stage, setStage] = useState<'enter' | 'confirm'>('enter');
  const [first, setFirst] = useState('');
  const [current, setCurrent] = useState('');

  const reset = () => { setStage('enter'); setFirst(''); setCurrent(''); };

  const handleKey = (key: string) => {
    if (current.length >= PIN_LENGTH) return;
    const next = current + key;
    setCurrent(next);

    if (next.length === PIN_LENGTH) {
      if (stage === 'enter') {
        setTimeout(() => { setFirst(next); setCurrent(''); setStage('confirm'); }, 200);
      } else {
        if (next === first) {
          setTimeout(() => { onSuccess(next); reset(); }, 200);
        } else {
          setTimeout(() => {
            Alert.alert('PINs do not match', 'Please try again.');
            reset();
          }, 200);
        }
      }
    }
  };

  const handleBack = () => {
    setCurrent(c => c.slice(0, -1));
  };

  const keys: (string | null)[] = ['1','2','3','4','5','6','7','8','9',null,'0','⌫'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <View style={[styles.pmOverlay, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.pmContainer}>
          {/* Header */}
          <View style={styles.pmHeader}>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={24} color={ds.text.secondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.pmTitle}>
            {stage === 'enter' ? 'Set your PIN' : 'Confirm your PIN'}
          </Text>
          <Text style={styles.pmSubtitle}>
            {stage === 'enter' ? 'Enter a 4-digit PIN to lock the app' : 'Enter the same PIN again to confirm'}
          </Text>

          {/* Dots */}
          <View style={styles.pmDots}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[styles.pmDot, i < current.length && styles.pmDotFilled]}
              />
            ))}
          </View>

          {/* Keypad */}
          <View style={styles.pmKeypad}>
            {keys.map((key, i) => {
              if (key === null) return <View key={i} style={styles.pmKeyCell} />;
              if (key === '⌫') {
                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.pmKeyCell}
                    onPress={handleBack}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="backspace-outline" size={24} color={ds.text.secondary} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.pmKeyCell}
                  onPress={() => handleKey(key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pmKeyText}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── SettingsRow ───────────────────────────────────────────────────────────────

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  destructive,
  right,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  right?: React.ReactNode;
}) {
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !right}
    >
      <View style={[styles.rowIcon, destructive && { backgroundColor: hexToRgba(ds.secondary, 0.12) }]}>
        <MaterialCommunityIcons name={icon} size={19} color={destructive ? ds.secondaryLight : ds.text.secondary} />
      </View>
      <Text style={[styles.rowLabel, destructive && { color: ds.secondaryLight }]}>{label}</Text>
      {right != null ? right : value != null ? (
        <Text style={styles.rowValue}>{value}</Text>
      ) : null}
      {onPress != null && right == null && (
        <MaterialCommunityIcons name="chevron-right" size={18} color={ds.text.muted} />
      )}
    </TouchableOpacity>
  );
}

// ── SettingsScreen ────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);

  const { currencyCode, currencySymbol, theme, pinEnabled, driveConnected, lastBackupAt, saveToDb, loadFromDB } = useSettingsStore();
  const { loadFromDB: loadCategories } = useCategoriesStore();
  const loadAccounts     = useAccountsStore(s => s.loadFromDB);
  const loadTransactions = useTransactionsStore(s => s.loadFromDB);
  const loadSavings      = useSavingsStore(s => s.loadFromDB);
  const loadInvestments  = useInvestmentsStore(s => s.loadFromDB);

  const [view,            setView]            = useState<ScreenView>('main');
  const [showCurrency,    setShowCurrency]    = useState(false);
  const [showTheme,       setShowTheme]       = useState(false);
  const [showPINModal,    setShowPINModal]    = useState(false);
  const [clearing,        setClearing]        = useState(false);

  useFocusEffect(useCallback(() => { loadFromDB(); loadCategories(); }, [loadFromDB, loadCategories]));

  if (view === 'categories') {
    return <ManageCategoriesView onBack={() => setView('main')} />;
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCurrencySelect = async (code: string, symbol: string) => {
    await saveToDb({ currencyCode: code, currencySymbol: symbol });
    setShowCurrency(false);
  };

  const handleThemeSelect = async (t: 'dark' | 'light' | 'system') => {
    await saveToDb({ theme: t });
    setShowTheme(false);
  };

  const handleLockToggle = async (value: boolean) => {
    if (value) {
      setShowPINModal(true);
    } else {
      Alert.alert('Disable App Lock?', 'Your PIN will be removed.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            await saveToDb({ pinEnabled: 0 });
            await updateSettings({ pin_hash: null });
          },
        },
      ]);
    }
  };

  const handlePINSuccess = async (pin: string) => {
    setShowPINModal(false);
    await saveToDb({ pinEnabled: 1 });
    await updateSettings({ pin_hash: pin });
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data?',
      'This will permanently delete ALL transactions, accounts, goals, investments, and trips. Settings will be kept.\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, clear everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'Type "DELETE" mentally — once done, data is gone forever.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete All Data',
                  style: 'destructive',
                  onPress: async () => {
                    setClearing(true);
                    try {
                      await clearAllUserData();
                      await Promise.all([
                        loadAccounts(), loadTransactions(),
                        loadSavings(), loadInvestments(), loadCategories(),
                      ]);
                      await saveToDb({ pinEnabled: 0 });
                      Alert.alert('Done', 'All data has been cleared.');
                    } catch {
                      Alert.alert('Error', 'Failed to clear data');
                    } finally {
                      setClearing(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const themeLabel = THEME_OPTIONS.find(t => t.value === theme)?.label ?? 'Dark';
  const isLockOn   = pinEnabled === 1;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── PREFERENCES ── */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <AppCard padding={0} style={styles.card}>
          <SettingsRow
            icon="currency-inr"
            label="Currency"
            value={`${currencyCode}  ${currencySymbol}`}
            onPress={() => setShowCurrency(true)}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="theme-light-dark"
            label="Theme"
            value={themeLabel}
            onPress={() => setShowTheme(true)}
          />
        </AppCard>

        {/* ── MANAGEMENT ── */}
        <Text style={styles.sectionLabel}>Management</Text>
        <AppCard padding={0} style={styles.card}>
          <SettingsRow
            icon="tag-multiple-outline"
            label="Manage Categories"
            onPress={() => setView('categories')}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="wallet-outline"
            label="Manage Accounts"
            onPress={() => navigation.navigate('Accounts')}
          />
        </AppCard>

        {/* ── ACCOUNT ── */}
        <Text style={styles.sectionLabel}>Account</Text>
        <AppCard padding={0} style={styles.card}>
          <SettingsRow
            icon="google-drive"
            label="Google Drive Sync"
            right={
              <Switch
                value={driveConnected === 1}
                onValueChange={() =>
                  Alert.alert('Coming in Phase 3', 'Google Drive sync will be available soon.')
                }
                trackColor={{ true: ds.primary, false: ds.surface.elevated }}
                thumbColor={driveConnected === 1 ? ds.primaryLight : ds.text.muted}
              />
            }
          />
          {driveConnected === 1 && (
            <>
              <View style={styles.rowDivider} />
              <SettingsRow
                icon="backup-restore"
                label="Last Backup"
                value={formatBackupDate(lastBackupAt)}
              />
            </>
          )}
        </AppCard>

        {/* ── SECURITY ── */}
        <Text style={styles.sectionLabel}>Security</Text>
        <AppCard padding={0} style={styles.card}>
          <SettingsRow
            icon="lock-outline"
            label="App Lock (PIN)"
            right={
              <Switch
                value={isLockOn}
                onValueChange={handleLockToggle}
                trackColor={{ true: ds.primary, false: ds.surface.elevated }}
                thumbColor={isLockOn ? ds.primaryLight : ds.text.muted}
              />
            }
          />
          {isLockOn && (
            <>
              <View style={styles.rowDivider} />
              <SettingsRow
                icon="pencil-outline"
                label="Change PIN"
                onPress={() => setShowPINModal(true)}
              />
            </>
          )}
        </AppCard>

        {/* ── DATA ── */}
        <Text style={styles.sectionLabel}>Data</Text>
        <AppCard padding={0} style={styles.card}>
          <SettingsRow
            icon="database-export-outline"
            label="Export Data"
            onPress={() => navigation.navigate('ExportScreen')}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="delete-forever-outline"
            label={clearing ? 'Clearing…' : 'Clear All Data'}
            onPress={clearing ? undefined : handleClearData}
            destructive
          />
        </AppCard>

        {/* ── INFO ── */}
        <Text style={styles.sectionLabel}>Info</Text>
        <AppCard padding={0} style={styles.card}>
          <SettingsRow icon="information-outline" label="Version" value="1.0.0" />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="help-circle-outline"
            label="Help & Feedback"
            onPress={() => Alert.alert('Help', 'Please email support@finio.app for help.')}
          />
        </AppCard>

      </ScrollView>

      {/* ── Currency picker ── */}
      <BottomSheet visible={showCurrency} onClose={() => setShowCurrency(false)} title="Select Currency">
        <ScrollView style={styles.currencyList} showsVerticalScrollIndicator={false}>
          {CURRENCIES.map(cur => {
            const selected = cur.code === currencyCode;
            return (
              <TouchableOpacity
                key={cur.code}
                style={[styles.currencyRow, selected && styles.currencyRowActive]}
                onPress={() => handleCurrencySelect(cur.code, cur.symbol)}
                activeOpacity={0.8}
              >
                <Text style={[styles.currencySymbol, { color: selected ? ds.primary : ds.text.muted }]}>
                  {cur.symbol}
                </Text>
                <View style={styles.currencyInfo}>
                  <Text style={[styles.currencyCode, selected && { color: ds.primary }]}>{cur.code}</Text>
                  <Text style={styles.currencyName}>{cur.name}</Text>
                </View>
                {selected && (
                  <MaterialCommunityIcons name="check-circle" size={20} color={ds.primary} />
                )}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      </BottomSheet>

      {/* ── Theme picker ── */}
      <BottomSheet visible={showTheme} onClose={() => setShowTheme(false)} title="App Theme">
        <View style={styles.themeOptions}>
          {THEME_OPTIONS.map(opt => {
            const active = theme === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.themeOption, active && styles.themeOptionActive]}
                onPress={() => handleThemeSelect(opt.value)}
                activeOpacity={0.8}
              >
                <View style={[styles.themeIconWrap, active && { backgroundColor: hexToRgba(ds.primary, 0.15) }]}>
                  <MaterialCommunityIcons name={opt.icon} size={24} color={active ? ds.primary : ds.text.secondary} />
                </View>
                <Text style={[styles.themeOptionText, active && { color: ds.primary }]}>{opt.label}</Text>
                {active && <MaterialCommunityIcons name="check-circle" size={18} color={ds.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

      {/* ── PIN setup modal ── */}
      <PINModal
        visible={showPINModal}
        onClose={() => setShowPINModal(false)}
        onSuccess={handlePINSuccess}
      />
    </View>
  );
}
