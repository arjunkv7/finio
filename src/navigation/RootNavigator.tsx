import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import TabNavigator from './TabNavigator';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import ExportScreen from '../screens/ExportScreen';
import AccountsStack from './AccountsStack';
import TripsStack from './TripsStack';
import SavingsScreen from '../screens/SavingsScreen';
import InvestmentsScreen from '../screens/InvestmentsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RecurringScreen from '../screens/RecurringScreen';
import SmsTransactionsScreen from '../screens/SmsTransactionsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import { useSmsTransactionsStore } from '../store/smsTransactionsStore';
import { useTransactionsStore } from '../store/transactionsStore';
import { useAccountsStore } from '../store/accountsStore';
import { useCategoriesStore } from '../store/categoriesStore';
import { AutoCreatedEntry, approveSingleAutoCreatedSmsTransaction } from '../db/queries/smsTransactionQueries';
import { getDb } from '../db/database';
import { useDS } from '../hooks/useDS';

const Stack = createStackNavigator<RootStackParamList>();
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Auto-created review modal ─────────────────────────────────────────────────

interface CardEdit {
  accountId: string;
  categoryId: string | null;
  description: string;
  notes: string;
}

function AutoCreatedReviewModal() {
  const ds               = useDS();
  const autoCreated      = useSmsTransactionsStore(s => s.autoCreated);
  const acceptAll        = useSmsTransactionsStore(s => s.acceptAllAutoCreated);
  const deleteEntry      = useSmsTransactionsStore(s => s.deleteAutoCreated);
  const deleteAll        = useSmsTransactionsStore(s => s.deleteAllAutoCreated);
  const loadAutoCreated  = useSmsTransactionsStore(s => s.loadAutoCreated);
  const loadTransactions = useTransactionsStore(s => s.loadFromDB);
  const { accounts }     = useAccountsStore();
  const { incomeCategories, expenseCategories } = useCategoriesStore();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [edits, setEdits]           = useState<Record<string, CardEdit>>({});
  const [saving, setSaving]         = useState(false);

  if (autoCreated.length === 0) return null;

  const activeAccounts = accounts.filter(a => a.is_archived === 0);

  const amtStr = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

  const getEdit = (item: AutoCreatedEntry): CardEdit =>
    edits[item.sms_id] ?? {
      accountId:   item.tx_account_id,
      categoryId:  item.tx_category_id,
      description: item.tx_description ?? '',
      notes:       item.tx_notes ?? '',
    };

  const patchEdit = (smsId: string, patch: Partial<CardEdit>) =>
    setEdits(s => ({ ...s, [smsId]: { ...s[smsId], ...patch } }));

  const handleCardPress = (smsId: string, item: AutoCreatedEntry) => {
    if (expandedId === smsId) {
      setExpandedId(null);
    } else {
      setExpandedId(smsId);
      if (!edits[smsId]) {
        setEdits(s => ({
          ...s,
          [smsId]: {
            accountId:   item.tx_account_id,
            categoryId:  item.tx_category_id,
            description: item.tx_description ?? '',
            notes:       item.tx_notes ?? '',
          },
        }));
      }
    }
  };

  const handleSave = async (item: AutoCreatedEntry) => {
    const edit = edits[item.sms_id];
    if (!edit) { setExpandedId(null); return; }
    setSaving(true);
    try {
      const db  = await getDb();
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE transactions
            SET account_id  = ?,
                category_id = ?,
                description = ?,
                notes       = ?,
                updated_at  = ?
          WHERE id = ?`,
        [edit.accountId, edit.categoryId, edit.description || null, edit.notes || null, now, item.tx_id]
      );
      await approveSingleAutoCreatedSmsTransaction(item.sms_id);
      setExpandedId(null);
      setEdits(s => { const next = { ...s }; delete next[item.sms_id]; return next; });
      await Promise.all([loadAutoCreated(), loadTransactions()]);
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async () => {
    await acceptAll();
    await loadTransactions();
  };

  const handleDismissAll = async () => {
    await deleteAll();
    await loadTransactions();
  };

  const styles = makeModalStyles();

  const renderItem = ({ item }: { item: AutoCreatedEntry }) => {
    const isExpanded = expandedId === item.sms_id;
    const edit       = getEdit(item);
    const isExpense  = item.sms_type === 'expense';
    const amtColor   = isExpense ? '#FF6B6B' : '#00E676';
    const categories = isExpense ? expenseCategories : incomeCategories;

    return (
      <View style={[styles.card, isExpanded && styles.cardExpanded]}>
        {/* ── Row header (always visible) ── */}
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => handleCardPress(item.sms_id, item)}
          activeOpacity={0.75}
        >
          <View style={[styles.typeTag, { backgroundColor: isExpense ? 'rgba(255,107,107,0.15)' : 'rgba(0,230,118,0.15)' }]}>
            <MaterialCommunityIcons name={isExpense ? 'arrow-up' : 'arrow-down'} size={14} color={amtColor} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardAmt, { color: amtColor }]}>
              {isExpense ? '− ' : '+ '}{amtStr(item.sms_amount)}
            </Text>
            <Text style={[styles.cardDesc, { color: ds.text.secondary }]} numberOfLines={1}>
              {item.sms_description ?? 'No description'}
            </Text>
            <Text style={[styles.cardMeta, { color: ds.text.muted }]}>
              {item.account_name} · {item.sms_message_date}
            </Text>
          </View>
          <MaterialCommunityIcons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={ds.text.muted}
            style={{ marginRight: 4 }}
          />
          <TouchableOpacity
            style={[styles.deleteBtn, { backgroundColor: 'rgba(255,107,107,0.12)' }]}
            onPress={() => deleteEntry(item.sms_id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={15} color="#FF6B6B" />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* ── Expanded editor ── */}
        {isExpanded && (
          <View style={styles.editor}>
            <View style={[styles.divider, { backgroundColor: ds.border.subtle }]} />

            {/* Category */}
            <Text style={[styles.fieldLabel, { color: ds.text.muted }]}>Category</Text>
            <View style={styles.chipWrap}>
              {categories.map(cat => {
                const active = edit.categoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.chip,
                      { borderColor: active ? cat.color : ds.border.subtle },
                      active && { backgroundColor: `${cat.color}22` },
                    ]}
                    onPress={() => patchEdit(item.sms_id, { categoryId: active ? null : cat.id })}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons
                      name={cat.icon as any}
                      size={12}
                      color={active ? cat.color : ds.text.muted}
                    />
                    <Text style={[styles.chipText, { color: active ? cat.color : ds.text.secondary }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Account */}
            <Text style={[styles.fieldLabel, { color: ds.text.muted }]}>Account</Text>
            <View style={styles.chipWrap}>
              {activeAccounts.map(acc => {
                const active = edit.accountId === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[
                      styles.chip,
                      { borderColor: active ? ds.primary : ds.border.subtle },
                      active && { backgroundColor: `${ds.primary}22` },
                    ]}
                    onPress={() => patchEdit(item.sms_id, { accountId: acc.id })}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons
                      name="wallet-outline"
                      size={12}
                      color={active ? ds.primary : ds.text.muted}
                    />
                    <Text style={[styles.chipText, { color: active ? ds.primaryLight : ds.text.secondary }]}>
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Description */}
            <Text style={[styles.fieldLabel, { color: ds.text.muted }]}>Description</Text>
            <TextInput
              style={[styles.input, { color: ds.text.primary, borderColor: ds.border.subtle, backgroundColor: ds.surface.elevated }]}
              placeholder="e.g. Swiggy, Amazon…"
              placeholderTextColor={ds.text.muted}
              value={edit.description}
              onChangeText={v => patchEdit(item.sms_id, { description: v })}
            />

            {/* Notes */}
            <Text style={[styles.fieldLabel, { color: ds.text.muted }]}>Notes</Text>
            <TextInput
              style={[styles.input, { color: ds.text.primary, borderColor: ds.border.subtle, backgroundColor: ds.surface.elevated }]}
              placeholder="Optional note…"
              placeholderTextColor={ds.text.muted}
              value={edit.notes}
              onChangeText={v => patchEdit(item.sms_id, { notes: v })}
            />

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={() => handleSave(item)}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.saveBtnText}>Save</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.sheet, { backgroundColor: ds.surface.card }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: ds.border.strong }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
              <MaterialCommunityIcons name="message-check-outline" size={22} color={ds.primary} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: ds.text.primary }]}>
                {autoCreated.length === 1
                  ? '1 Transaction Auto-Added'
                  : `${autoCreated.length} Transactions Auto-Added`}
              </Text>
              <Text style={[styles.headerSub, { color: ds.text.secondary }]}>
                Tap a transaction to edit details.
              </Text>
            </View>
          </View>

          {/* List */}
          <FlatList
            data={autoCreated}
            keyExtractor={i => i.sms_id}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.dismissAllBtn, { borderColor: '#FF6B6B' }]}
              onPress={handleDismissAll}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="close" size={16} color="#FF6B6B" />
              <Text style={styles.dismissAllBtnText}>Don't Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptBtn, { backgroundColor: ds.primary }]}
              onPress={handleAccept}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="check" size={18} color="#fff" />
              <Text style={styles.acceptBtnText}>Looks Good</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeModalStyles() {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: SCREEN_HEIGHT * 0.9,
      paddingBottom: 32,
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      alignSelf: 'center', marginTop: 10, marginBottom: 6,
    },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16,
    },
    headerIcon: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    headerText:  { flex: 1 },
    headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
    headerSub:   { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
    list:        { maxHeight: SCREEN_HEIGHT * 0.6 },
    listContent: { paddingHorizontal: 16, paddingBottom: 8 },

    // Card
    card: {
      borderRadius: 12, marginBottom: 8,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
      backgroundColor: 'rgba(255,255,255,0.04)',
      overflow: 'hidden',
    },
    cardExpanded: { borderColor: 'rgba(139,92,246,0.3)' },
    cardHeader: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 12, paddingHorizontal: 14, gap: 10,
    },
    typeTag: {
      width: 32, height: 32, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    cardInfo:  { flex: 1, gap: 2 },
    cardAmt:   { fontFamily: 'Inter_700Bold', fontSize: 15 },
    cardDesc:  { fontFamily: 'Inter_500Medium', fontSize: 13 },
    cardMeta:  { fontFamily: 'Inter_400Regular', fontSize: 11 },
    deleteBtn: {
      width: 30, height: 30, borderRadius: 15,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },

    // Editor (expanded)
    editor:    { paddingHorizontal: 14, paddingBottom: 14 },
    divider:   { height: 1, marginBottom: 12 },
    fieldLabel: {
      fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.5,
      textTransform: 'uppercase', marginBottom: 6, marginTop: 4,
    },
    chipWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 20, borderWidth: 1,
    },
    chipText:  { fontFamily: 'Inter_500Medium', fontSize: 12 },
    input: {
      height: 40, borderWidth: 1, borderRadius: 10,
      paddingHorizontal: 12, fontFamily: 'Inter_400Regular', fontSize: 14,
      marginBottom: 4,
    },
    saveBtn: {
      height: 42, borderRadius: 10, marginTop: 12,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: 'rgba(139,92,246,0.6)',
    },
    saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: 'rgba(139,92,246,1)' },

    // Footer
    footer: {
      flexDirection: 'row', gap: 10,
      marginHorizontal: 20, marginTop: 8,
    },
    dismissAllBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, height: 50, borderRadius: 14, borderWidth: 1.5,
    },
    dismissAllBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FF6B6B' },
    acceptBtn: {
      flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, height: 50, borderRadius: 14,
    },
    acceptBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#fff' },
  });
}

// ── Root navigator ─────────────────────────────────────────────────────────────

export default function RootNavigator() {
  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={TabNavigator} />
        <Stack.Screen
          name="AddTransaction"
          component={AddTransactionScreen}
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen name="ExportScreen"      component={ExportScreen} />
        <Stack.Screen name="Accounts"          component={AccountsStack} />
        <Stack.Screen name="Trips"             component={TripsStack} />
        <Stack.Screen name="Savings"           component={SavingsScreen} />
        <Stack.Screen name="Investments"       component={InvestmentsScreen} />
        <Stack.Screen name="Settings"          component={SettingsScreen} />
        <Stack.Screen name="Recurring"         component={RecurringScreen} />
        <Stack.Screen name="SmsTransactions"   component={SmsTransactionsScreen} />
        <Stack.Screen name="Notifications"     component={NotificationsScreen} />
      </Stack.Navigator>
      <AutoCreatedReviewModal />
    </>
  );
}
