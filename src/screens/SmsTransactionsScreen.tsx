import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';
import { hexToRgba } from '../utils/color';
import { formatCurrency } from '../utils/formatters';
import { SmsTransaction } from '../types/db';
import { useSmsTransactionsStore } from '../store/smsTransactionsStore';
import { useAccountsStore } from '../store/accountsStore';
import { useCategoriesStore } from '../store/categoriesStore';
import { useTransactionsStore } from '../store/transactionsStore';
import { useSettingsStore } from '../store/settingsStore';
import { requestSmsPermission, checkSmsPermission, initialInboxScan } from '../services/smsService';
import { createSmsTransaction } from '../db/queries/smsTransactionQueries';
import AppCard from '../components/AppCard';
import PageHeader from '../components/PageHeader';
import BottomSheet from '../components/BottomSheet';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: ds.surface.screen },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 12 },

    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
    emptyIcon: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: ds.surface.elevated,
      alignItems: 'center', justifyContent: 'center',
    },
    emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: ds.text.primary, textAlign: 'center' },
    emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 14, color: ds.text.muted, textAlign: 'center', lineHeight: 20 },

    headerActions: {
      flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8,
      borderBottomWidth: 1, borderBottomColor: ds.border.subtle,
    },
    actionBtn: {
      flex: 1, height: 38, borderRadius: ds.radius.md,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: ds.surface.elevated,
    },
    actionBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: ds.text.secondary },
    dismissAllBtn: { backgroundColor: hexToRgba(ds.secondary, 0.12) },
    dismissAllText: { color: ds.secondaryLight },

    card: { overflow: 'hidden' },
    cardBody: { padding: 16, gap: 12 },

    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    typeTag: {
      paddingHorizontal: 10, paddingVertical: 3, borderRadius: ds.radius.full,
    },
    typeTagText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 16 },
    amount: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.5 },
    dateText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: ds.text.muted },

    infoRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    infoLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: ds.text.muted },
    infoValue: { fontFamily: 'Inter_500Medium', fontSize: 12, color: ds.text.secondary, flex: 1 },

    smsToggle: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 4,
    },
    smsToggleText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: ds.text.muted },
    smsBody: {
      backgroundColor: ds.surface.elevated, borderRadius: ds.radius.md,
      padding: 10, marginTop: 4,
    },
    smsBodyText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: ds.text.secondary, lineHeight: 18 },

    cardActions: { flexDirection: 'row', gap: 8, paddingTop: 4 },
    addBtn: {
      flex: 2, height: 40, borderRadius: ds.radius.md,
      backgroundColor: ds.primary, alignItems: 'center', justifyContent: 'center',
    },
    addBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' },
    dismissBtn: {
      flex: 1, height: 40, borderRadius: ds.radius.md,
      backgroundColor: hexToRgba(ds.secondary, 0.12),
      alignItems: 'center', justifyContent: 'center',
    },
    dismissBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: ds.secondaryLight },

    // Approval sheet
    sheetContent: { padding: 20, gap: 6 },
    sheetAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    sheetAmount: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.5 },
    sheetDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, color: ds.text.muted, flex: 1 },

    fieldLabel: {
      fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 14,
      letterSpacing: 0.5, textTransform: 'uppercase', color: ds.text.muted, marginTop: 10,
    },
    pickerList: { gap: 6, marginTop: 4 },
    pickerItem: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 12, paddingVertical: 10,
      borderRadius: ds.radius.md, borderWidth: 1.5, borderColor: ds.border.subtle,
    },
    pickerItemActive: { borderColor: ds.primary, backgroundColor: hexToRgba(ds.primary, 0.06) },
    pickerItemText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, color: ds.text.primary },
    pickerItemSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: ds.text.muted },

    ctaBtn: {
      marginTop: 20, height: 52, borderRadius: ds.radius.lg,
      backgroundColor: ds.primary, alignItems: 'center', justifyContent: 'center',
    },
    ctaBtnDisabled: { opacity: 0.5 },
    ctaText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#fff' },

    permBanner: {
      margin: 16, padding: 16, borderRadius: ds.radius.lg,
      backgroundColor: hexToRgba(ds.primary, 0.08),
      borderWidth: 1, borderColor: hexToRgba(ds.primary, 0.2),
      gap: 8,
    },
    permTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: ds.text.primary },
    permBody: { fontFamily: 'Inter_400Regular', fontSize: 13, color: ds.text.secondary, lineHeight: 18 },
    permBtn: {
      alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: ds.radius.md, backgroundColor: ds.primary, marginTop: 4,
    },
    permBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#fff' },
  });
}

// ── SmsCard ───────────────────────────────────────────────────────────────────

function SmsCard({
  item,
  currencyCode,
  onApprove,
  onDismiss,
}: {
  item: SmsTransaction;
  currencyCode: string;
  onApprove: (item: SmsTransaction) => void;
  onDismiss: (id: string) => void;
}) {
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);
  const [showSms, setShowSms] = useState(false);

  const isExpense = item.type === 'expense';
  const typeColor = isExpense ? ds.secondary : ds.primary;
  const amountColor = isExpense ? ds.secondaryLight : ds.primaryLight;

  return (
    <AppCard padding={0} style={styles.card}>
      <View style={styles.cardBody}>
        {/* Amount + type */}
        <View style={styles.cardHeader}>
          <View style={[styles.typeTag, { backgroundColor: hexToRgba(typeColor, 0.12) }]}>
            <Text style={[styles.typeTagText, { color: typeColor }]}>
              {isExpense ? 'Expense' : 'Income'}
            </Text>
          </View>
          <Text style={[styles.amount, { color: amountColor }]}>
            {formatCurrency(item.amount, currencyCode)}
          </Text>
        </View>

        {/* Sender */}
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="sim-outline" size={13} color={ds.text.muted} />
          <Text style={styles.infoLabel}>From</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{item.sender}</Text>
        </View>

        {/* Description */}
        {item.description ? (
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="tag-outline" size={13} color={ds.text.muted} />
            <Text style={styles.infoLabel}>For</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{item.description}</Text>
          </View>
        ) : null}

        {/* Date/time */}
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="clock-outline" size={13} color={ds.text.muted} />
          <Text style={styles.infoLabel}>When</Text>
          <Text style={styles.infoValue}>
            {item.message_date}  {item.message_time}
          </Text>
        </View>

        {/* Toggle SMS body */}
        <TouchableOpacity
          style={styles.smsToggle}
          onPress={() => setShowSms(v => !v)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={showSms ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={ds.text.muted}
          />
          <Text style={styles.smsToggleText}>
            {showSms ? 'Hide message' : 'Show message'}
          </Text>
        </TouchableOpacity>
        {showSms && (
          <View style={styles.smsBody}>
            <Text style={styles.smsBodyText}>{item.raw_body}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => onApprove(item)}
            activeOpacity={0.85}
          >
            <Text style={styles.addBtnText}>Add Transaction</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={() => onDismiss(item.id)}
            activeOpacity={0.85}
          >
            <Text style={styles.dismissBtnText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AppCard>
  );
}

// ── ApproveSheet ──────────────────────────────────────────────────────────────

function ApproveSheet({
  item,
  visible,
  onClose,
  onConfirm,
}: {
  item: SmsTransaction | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: (smsId: string, accountId: string, categoryId: string | null) => void;
}) {
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);
  const { accounts } = useAccountsStore();
  const { incomeCategories, expenseCategories } = useCategoriesStore();
  const { currencyCode } = useSettingsStore();

  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categories = item?.type === 'income' ? incomeCategories : expenseCategories;
  const activeAccounts = accounts.filter(a => a.is_archived === 0);

  const handleConfirm = async () => {
    if (!item || !selectedAccount) return;
    setSaving(true);
    try {
      await onConfirm(item.id, selectedAccount, selectedCategory);
      setSelectedAccount(null);
      setSelectedCategory(null);
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Add Transaction"
    >
      <ScrollView
        contentContainerStyle={[styles.sheetContent, { paddingBottom: 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Amount summary */}
        <View style={styles.sheetAmountRow}>
          <View style={[styles.typeTag, { backgroundColor: hexToRgba(item.type === 'expense' ? ds.secondary : ds.primary, 0.12) }]}>
            <Text style={[styles.typeTagText, { color: item.type === 'expense' ? ds.secondary : ds.primary }]}>
              {item.type === 'expense' ? 'Expense' : 'Income'}
            </Text>
          </View>
          <Text style={[styles.sheetAmount, { color: item.type === 'expense' ? ds.secondaryLight : ds.primaryLight }]}>
            {formatCurrency(item.amount, currencyCode)}
          </Text>
          {item.description ? (
            <Text style={styles.sheetDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
        </View>

        {/* Account picker */}
        <Text style={styles.fieldLabel}>Account *</Text>
        <View style={styles.pickerList}>
          {activeAccounts.map(acc => {
            const active = selectedAccount === acc.id;
            return (
              <TouchableOpacity
                key={acc.id}
                style={[styles.pickerItem, active && styles.pickerItemActive]}
                onPress={() => setSelectedAccount(acc.id)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="wallet-outline"
                  size={18}
                  color={active ? ds.primary : ds.text.secondary}
                />
                <Text style={[styles.pickerItemText, active && { color: ds.primary }]}>{acc.name}</Text>
                <Text style={styles.pickerItemSub}>{acc.type}</Text>
                {active && <MaterialCommunityIcons name="check-circle" size={16} color={ds.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Category picker */}
        <Text style={styles.fieldLabel}>Category (optional)</Text>
        <View style={styles.pickerList}>
          {categories.map(cat => {
            const active = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.pickerItem, active && styles.pickerItemActive]}
                onPress={() => setSelectedCategory(active ? null : cat.id)}
                activeOpacity={0.8}
              >
                <View style={{
                  width: 28, height: 28, borderRadius: 8,
                  backgroundColor: hexToRgba(cat.color, 0.15),
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <MaterialCommunityIcons name={cat.icon as IconName} size={14} color={cat.color} />
                </View>
                <Text style={[styles.pickerItemText, active && { color: ds.primary }]}>{cat.name}</Text>
                {active && <MaterialCommunityIcons name="check-circle" size={16} color={ds.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.ctaBtn, (!selectedAccount || saving) && styles.ctaBtnDisabled]}
          onPress={handleConfirm}
          disabled={!selectedAccount || saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.ctaText}>Add to Finio</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </BottomSheet>
  );
}

// ── SmsTransactionsScreen ─────────────────────────────────────────────────────

export default function SmsTransactionsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);

  const { pending, isLoading, loadPending, approve, dismiss, dismissAll } = useSmsTransactionsStore();
  const { currencyCode } = useSettingsStore();
  const loadTransactions = useTransactionsStore(s => s.loadFromDB);
  const loadAccounts = useAccountsStore(s => s.loadFromDB);
  const loadCategories = useCategoriesStore(s => s.loadFromDB);

  const [approveTarget, setApproveTarget] = useState<SmsTransaction | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useFocusEffect(useCallback(() => {
    loadPending();
    loadAccounts();
    loadCategories();
    if (Platform.OS === 'android') {
      checkSmsPermission().then(setHasPermission);
    } else {
      setHasPermission(false);
    }
  }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRequestPermission = async () => {
    const granted = await requestSmsPermission();
    setHasPermission(granted);
    // Permission just granted — run the initial inbox scan immediately so the
    // user sees results right away without closing and reopening the app.
    if (granted) {
      await initialInboxScan();
      await loadPending();
    }
  };

  const handleInjectTestRecord = async () => {
    const now = new Date();
    await createSmsTransaction({
      smsId: `test_${Date.now()}`,
      sender: 'HDFC-BK',
      rawBody: 'Rs.1,234.00 debited from your HDFC Bank A/c XXXX5678 on 25-May-26. Available Bal: Rs.8,765.00.',
      amount: 123400,
      type: 'expense',
      accountType: 'bank',
      description: 'HDFC Bank',
      messageDate: now.toISOString().split('T')[0],
      messageTime: now.toTimeString().slice(0, 5),
    });
    await loadPending();
  };

  const handleApprove = (item: SmsTransaction) => {
    setApproveTarget(item);
  };

  const handleConfirmApprove = async (smsId: string, accountId: string, categoryId: string | null) => {
    const item = pending.find(p => p.id === smsId);
    if (!item) return;
    await approve(smsId, {
      type: item.type,
      amount: item.amount,
      account_id: accountId,
      category_id: categoryId ?? null,
      description: item.description,
      transaction_date: item.message_date,
      transaction_time: item.message_time,
    });
    await loadTransactions();
    setApproveTarget(null);
  };

  const handleDismiss = (id: string) => {
    dismiss(id);
  };

  const handleDismissAll = () => {
    Alert.alert(
      'Dismiss all?',
      `Dismiss all ${pending.length} detected transactions?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Dismiss All', style: 'destructive', onPress: () => dismissAll() },
      ]
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <PageHeader onBack={() => navigation.goBack()} title="SMS Transactions" />

      {/* Permission banner */}
      {hasPermission === false && Platform.OS === 'android' && (
        <View style={styles.permBanner}>
          <Text style={styles.permTitle}>SMS permission needed</Text>
          <Text style={styles.permBody}>
            Allow Finio to read SMS so it can automatically detect bank transactions.
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={handleRequestPermission} activeOpacity={0.85}>
            <Text style={styles.permBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bulk actions */}
      {pending.length > 1 && (
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.dismissAllBtn]}
            onPress={handleDismissAll}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionBtnText, styles.dismissAllText]}>Dismiss All</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={ds.primary} size="large" />
        </View>
      ) : pending.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons name="message-check-outline" size={32} color={ds.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptyBody}>
            No pending transactions detected from your SMS messages.{'\n'}
            New detections will appear here automatically.
          </Text>
          {__DEV__ && (
            <TouchableOpacity
              onPress={handleInjectTestRecord}
              activeOpacity={0.8}
              style={{
                marginTop: 8, paddingHorizontal: 16, paddingVertical: 8,
                borderRadius: ds.radius.md, borderWidth: 1, borderColor: ds.border.medium,
              }}
            >
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: ds.text.muted }}>
                [DEV] Inject test record
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <SmsCard
              item={item}
              currencyCode={currencyCode}
              onApprove={handleApprove}
              onDismiss={handleDismiss}
            />
          )}
        />
      )}

      <ApproveSheet
        item={approveTarget}
        visible={approveTarget !== null}
        onClose={() => setApproveTarget(null)}
        onConfirm={handleConfirmApprove}
      />
    </View>
  );
}
