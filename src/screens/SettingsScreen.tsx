import React, { useCallback, useState } from 'react';
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

import { DS } from '../constants';
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

// ── ManageCategoriesView ──────────────────────────────────────────────────────

interface ManageCatProps { onBack: () => void }

function ManageCategoriesView({ onBack }: ManageCatProps) {
  const insets   = useSafeAreaInsets();
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
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={DS.text.primary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Manage Categories</Text>
        <TouchableOpacity style={s.addIconBtn} onPress={openAdd} activeOpacity={0.8}>
          <MaterialCommunityIcons name="plus" size={22} color={DS.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['expense', 'income'] as CategoryType[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>
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
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>No {tab} categories</Text>
            <Text style={s.emptyHint}>Tap + to create one</Text>
          </View>
        }
        renderItem={renderCat}
        ItemSeparatorComponent={() => <View style={s.divider} />}
      />

      {/* Add/Edit category form */}
      <BottomSheet
        visible={showForm}
        onClose={() => setShowForm(false)}
        title={editCat ? (editCat.is_system ? 'View Category' : 'Edit Category') : 'New Category'}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={s.sheetContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Type (add only) */}
            {!editCat && (
              <>
                <Text style={s.fieldLabel}>Type</Text>
                <View style={s.typeRow}>
                  {(['expense', 'income'] as CategoryType[]).map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[s.typeChip, catType === t && { backgroundColor: t === 'income' ? DS.primary : DS.secondary, borderColor: 'transparent' }]}
                      onPress={() => setCatType(t)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.typeChipText, catType === t && { color: '#fff' }]}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Name */}
            <Text style={s.fieldLabel}>Name *</Text>
            <TextInput
              style={s.input}
              value={catName}
              onChangeText={setCatName}
              placeholder="Category name"
              placeholderTextColor={DS.text.muted}
              autoFocus={!editCat?.is_system}
              editable={!editCat?.is_system}
            />

            {/* Icon */}
            <Text style={s.fieldLabel}>Icon</Text>
            <View style={s.iconGrid}>
              {CAT_ICONS.map(icon => {
                const sel = catIcon === icon;
                return (
                  <TouchableOpacity
                    key={icon}
                    style={[s.iconCell, sel && { borderColor: catColor, backgroundColor: hexToRgba(catColor, 0.15) }]}
                    onPress={() => !editCat?.is_system && setCatIcon(icon)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name={icon} size={20} color={sel ? catColor : DS.text.secondary} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Color */}
            <Text style={s.fieldLabel}>Color</Text>
            <View style={s.colorRow}>
              {CAT_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[s.swatch, { backgroundColor: c }, catColor === c && s.swatchSelected]}
                  onPress={() => !editCat?.is_system && setCatColor(c)}
                  activeOpacity={0.8}
                />
              ))}
            </View>

            {!editCat?.is_system && (
              <TouchableOpacity
                style={[s.ctaBtn, saving && s.ctaBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Text style={s.ctaText}>{saving ? 'Saving…' : editCat ? 'Save Changes' : 'Create Category'}</Text>
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

  const renderRight = (progress: Animated.AnimatedInterpolation<number>) => {
    if (!onDelete) return null;
    const tx = progress.interpolate({ inputRange: [0, 1], outputRange: [68, 0] });
    return (
      <Animated.View style={{ transform: [{ translateX: tx }] }}>
        <TouchableOpacity
          style={[s.deleteAction, { height: CAT_ROW_H }]}
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
      <TouchableOpacity style={s.catRow} onPress={onEdit} activeOpacity={0.8}>
        <View style={[s.catIcon, { backgroundColor: hexToRgba(cat.color, 0.15) }]}>
          <MaterialCommunityIcons name={cat.icon as IconName} size={18} color={cat.color} />
        </View>
        <Text style={s.catName} numberOfLines={1}>{cat.name}</Text>
        {isSystem && (
          <View style={s.systemBadge}>
            <Text style={s.systemBadgeText}>System</Text>
          </View>
        )}
        <MaterialCommunityIcons name="chevron-right" size={18} color={DS.text.muted} />
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
      <View style={[pm.overlay, { paddingBottom: insets.bottom + 20 }]}>
        <View style={pm.container}>
          {/* Header */}
          <View style={pm.header}>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={24} color={DS.text.secondary} />
            </TouchableOpacity>
          </View>

          <Text style={pm.title}>
            {stage === 'enter' ? 'Set your PIN' : 'Confirm your PIN'}
          </Text>
          <Text style={pm.subtitle}>
            {stage === 'enter' ? 'Enter a 4-digit PIN to lock the app' : 'Enter the same PIN again to confirm'}
          </Text>

          {/* Dots */}
          <View style={pm.dots}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[pm.dot, i < current.length && pm.dotFilled]}
              />
            ))}
          </View>

          {/* Keypad */}
          <View style={pm.keypad}>
            {keys.map((key, i) => {
              if (key === null) return <View key={i} style={pm.keyCell} />;
              if (key === '⌫') {
                return (
                  <TouchableOpacity
                    key={i}
                    style={pm.keyCell}
                    onPress={handleBack}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="backspace-outline" size={24} color={DS.text.secondary} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={i}
                  style={pm.keyCell}
                  onPress={() => handleKey(key)}
                  activeOpacity={0.7}
                >
                  <Text style={pm.keyText}>{key}</Text>
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
  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !right}
    >
      <View style={[s.rowIcon, destructive && { backgroundColor: hexToRgba(DS.secondary, 0.12) }]}>
        <MaterialCommunityIcons name={icon} size={19} color={destructive ? DS.secondaryLight : DS.text.secondary} />
      </View>
      <Text style={[s.rowLabel, destructive && { color: DS.secondaryLight }]}>{label}</Text>
      {right != null ? right : value != null ? (
        <Text style={s.rowValue}>{value}</Text>
      ) : null}
      {onPress != null && right == null && (
        <MaterialCommunityIcons name="chevron-right" size={18} color={DS.text.muted} />
      )}
    </TouchableOpacity>
  );
}

// ── SettingsScreen ────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();

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
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── PREFERENCES ── */}
        <Text style={s.sectionLabel}>Preferences</Text>
        <AppCard padding={0} style={s.card}>
          <SettingsRow
            icon="currency-inr"
            label="Currency"
            value={`${currencyCode}  ${currencySymbol}`}
            onPress={() => setShowCurrency(true)}
          />
          <View style={s.rowDivider} />
          <SettingsRow
            icon="theme-light-dark"
            label="Theme"
            value={themeLabel}
            onPress={() => setShowTheme(true)}
          />
        </AppCard>

        {/* ── MANAGEMENT ── */}
        <Text style={s.sectionLabel}>Management</Text>
        <AppCard padding={0} style={s.card}>
          <SettingsRow
            icon="tag-multiple-outline"
            label="Manage Categories"
            onPress={() => setView('categories')}
          />
          <View style={s.rowDivider} />
          <SettingsRow
            icon="wallet-outline"
            label="Manage Accounts"
            onPress={() => navigation.navigate('Accounts')}
          />
        </AppCard>

        {/* ── ACCOUNT ── */}
        <Text style={s.sectionLabel}>Account</Text>
        <AppCard padding={0} style={s.card}>
          <SettingsRow
            icon="google-drive"
            label="Google Drive Sync"
            right={
              <Switch
                value={driveConnected === 1}
                onValueChange={() =>
                  Alert.alert('Coming in Phase 3', 'Google Drive sync will be available soon.')
                }
                trackColor={{ true: DS.primary, false: DS.surface.elevated }}
                thumbColor={driveConnected === 1 ? DS.primaryLight : DS.text.muted}
              />
            }
          />
          {driveConnected === 1 && (
            <>
              <View style={s.rowDivider} />
              <SettingsRow
                icon="backup-restore"
                label="Last Backup"
                value={formatBackupDate(lastBackupAt)}
              />
            </>
          )}
        </AppCard>

        {/* ── SECURITY ── */}
        <Text style={s.sectionLabel}>Security</Text>
        <AppCard padding={0} style={s.card}>
          <SettingsRow
            icon="lock-outline"
            label="App Lock (PIN)"
            right={
              <Switch
                value={isLockOn}
                onValueChange={handleLockToggle}
                trackColor={{ true: DS.primary, false: DS.surface.elevated }}
                thumbColor={isLockOn ? DS.primaryLight : DS.text.muted}
              />
            }
          />
          {isLockOn && (
            <>
              <View style={s.rowDivider} />
              <SettingsRow
                icon="pencil-outline"
                label="Change PIN"
                onPress={() => setShowPINModal(true)}
              />
            </>
          )}
        </AppCard>

        {/* ── DATA ── */}
        <Text style={s.sectionLabel}>Data</Text>
        <AppCard padding={0} style={s.card}>
          <SettingsRow
            icon="database-export-outline"
            label="Export Data"
            onPress={() => navigation.navigate('ExportScreen')}
          />
          <View style={s.rowDivider} />
          <SettingsRow
            icon="delete-forever-outline"
            label={clearing ? 'Clearing…' : 'Clear All Data'}
            onPress={clearing ? undefined : handleClearData}
            destructive
          />
        </AppCard>

        {/* ── INFO ── */}
        <Text style={s.sectionLabel}>Info</Text>
        <AppCard padding={0} style={s.card}>
          <SettingsRow icon="information-outline" label="Version" value="1.0.0" />
          <View style={s.rowDivider} />
          <SettingsRow
            icon="help-circle-outline"
            label="Help & Feedback"
            onPress={() => Alert.alert('Help', 'Please email support@finio.app for help.')}
          />
        </AppCard>

      </ScrollView>

      {/* ── Currency picker ── */}
      <BottomSheet visible={showCurrency} onClose={() => setShowCurrency(false)} title="Select Currency">
        <ScrollView style={s.currencyList} showsVerticalScrollIndicator={false}>
          {CURRENCIES.map(cur => {
            const selected = cur.code === currencyCode;
            return (
              <TouchableOpacity
                key={cur.code}
                style={[s.currencyRow, selected && s.currencyRowActive]}
                onPress={() => handleCurrencySelect(cur.code, cur.symbol)}
                activeOpacity={0.8}
              >
                <Text style={[s.currencySymbol, { color: selected ? DS.primary : DS.text.muted }]}>
                  {cur.symbol}
                </Text>
                <View style={s.currencyInfo}>
                  <Text style={[s.currencyCode, selected && { color: DS.primary }]}>{cur.code}</Text>
                  <Text style={s.currencyName}>{cur.name}</Text>
                </View>
                {selected && (
                  <MaterialCommunityIcons name="check-circle" size={20} color={DS.primary} />
                )}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      </BottomSheet>

      {/* ── Theme picker ── */}
      <BottomSheet visible={showTheme} onClose={() => setShowTheme(false)} title="App Theme">
        <View style={s.themeOptions}>
          {THEME_OPTIONS.map(opt => {
            const active = theme === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[s.themeOption, active && s.themeOptionActive]}
                onPress={() => handleThemeSelect(opt.value)}
                activeOpacity={0.8}
              >
                <View style={[s.themeIconWrap, active && { backgroundColor: hexToRgba(DS.primary, 0.15) }]}>
                  <MaterialCommunityIcons name={opt.icon} size={24} color={active ? DS.primary : DS.text.secondary} />
                </View>
                <Text style={[s.themeOptionText, active && { color: DS.primary }]}>{opt.label}</Text>
                {active && <MaterialCommunityIcons name="check-circle" size={18} color={DS.primary} />}
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

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.surface.screen },

  header: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: DS.border.subtle,
  },
  headerTitle: {
    fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 32,
    letterSpacing: -0.48, color: DS.text.primary,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: DS.surface.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
  addIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: hexToRgba(DS.primary, 0.12),
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 8 },

  sectionLabel: {
    fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 15,
    letterSpacing: 0.8, textTransform: 'uppercase',
    color: DS.text.muted, marginBottom: 4, marginLeft: 4, marginTop: 8,
  },

  card: { overflow: 'hidden' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  rowIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: DS.surface.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: {
    flex: 1, fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 20, color: DS.text.primary,
  },
  rowValue: {
    fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: DS.text.muted,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth, backgroundColor: DS.border.subtle, marginLeft: 62,
  },

  deleteAction: {
    width: 68, backgroundColor: DS.secondary,
    alignItems: 'center', justifyContent: 'center',
  },

  // Currency picker
  currencyList: { maxHeight: 400, paddingHorizontal: 4 },
  currencyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
    borderRadius: DS.radius.md,
  },
  currencyRowActive: { backgroundColor: hexToRgba(DS.primary, 0.08) },
  currencySymbol: {
    fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 24, width: 32, textAlign: 'center',
  },
  currencyInfo: { flex: 1, gap: 2 },
  currencyCode: {
    fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 20, color: DS.text.primary,
  },
  currencyName: {
    fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: DS.text.muted,
  },

  // Theme options
  themeOptions: { padding: 20, gap: 10 },
  themeOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: DS.radius.lg,
    borderWidth: 1.5, borderColor: DS.border.subtle,
  },
  themeOptionActive: { borderColor: DS.primary, backgroundColor: hexToRgba(DS.primary, 0.06) },
  themeIconWrap: {
    width: 40, height: 40, borderRadius: DS.radius.lg,
    backgroundColor: DS.surface.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
  themeOptionText: {
    flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: DS.text.primary,
  },

  // Categories view
  tabRow: {
    flexDirection: 'row', padding: 12, gap: 8,
    borderBottomWidth: 1, borderBottomColor: DS.border.subtle,
  },
  tabBtn: {
    flex: 1, paddingVertical: 8, borderRadius: DS.radius.md,
    backgroundColor: DS.surface.elevated,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: DS.primary },
  tabBtnText: {
    fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18, color: DS.text.muted,
  },
  tabBtnTextActive: { color: '#fff' },

  catRow: {
    flexDirection: 'row', alignItems: 'center',
    height: 62, paddingHorizontal: 16, gap: 12,
    backgroundColor: DS.surface.screen,
  },
  catIcon: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  catName: {
    flex: 1, fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 20, color: DS.text.primary,
  },
  systemBadge: {
    backgroundColor: DS.surface.elevated, borderRadius: DS.radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  systemBadgeText: {
    fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 14, color: DS.text.muted,
  },

  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: DS.border.subtle,
  },

  // Sheet / form
  sheetContent: { padding: 20, gap: 6, paddingBottom: 8 },
  fieldLabel: {
    fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 14,
    letterSpacing: 0.5, textTransform: 'uppercase', color: DS.text.muted, marginTop: 10,
  },
  input: {
    height: 44, backgroundColor: DS.surface.elevated,
    borderRadius: DS.radius.md, borderWidth: 1, borderColor: DS.border.subtle,
    paddingHorizontal: 14,
    fontFamily: 'Inter_400Regular', fontSize: 15, color: DS.text.primary,
  },
  typeRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  typeChip: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: DS.radius.md, borderWidth: 1.5, borderColor: DS.border.medium,
  },
  typeChipText: {
    fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18, color: DS.text.secondary,
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  iconCell: {
    width: 42, height: 42, borderRadius: DS.radius.md,
    borderWidth: 1.5, borderColor: DS.border.subtle,
    alignItems: 'center', justifyContent: 'center',
  },
  colorRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  swatchSelected: { borderWidth: 3, borderColor: '#fff' },
  ctaBtn: {
    marginTop: 16, height: 52, borderRadius: DS.radius.lg,
    backgroundColor: DS.primary, alignItems: 'center', justifyContent: 'center',
  },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#fff' },

  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: {
    fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: DS.text.secondary,
  },
  emptyHint: {
    fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: DS.text.muted,
  },
});

// ── PIN Modal styles ──────────────────────────────────────────────────────────

const pm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: DS.surface.card,
    borderTopLeftRadius: DS.radius.xl,
    borderTopRightRadius: DS.radius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: DS.border.subtle,
    paddingTop: 12, paddingHorizontal: 24, paddingBottom: 24,
    ...DS.shadow.modal,
  },
  header: {
    alignItems: 'flex-end', marginBottom: 8,
  },
  title: {
    fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 28,
    letterSpacing: -0.4, color: DS.text.primary,
    textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20,
    color: DS.text.muted, textAlign: 'center', marginBottom: 28,
  },
  dots: {
    flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 36,
  },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: DS.border.medium,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: DS.primary, borderColor: DS.primary,
  },
  keypad: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 0,
  },
  keyCell: {
    width: '33.33%', aspectRatio: 1.6,
    alignItems: 'center', justifyContent: 'center',
  },
  keyText: {
    fontFamily: 'Inter_400Regular', fontSize: 26, lineHeight: 32, color: DS.text.primary,
  },
});
