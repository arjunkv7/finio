import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BrandHeader from '../components/BrandHeader';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';
import { hexToRgba } from '../utils/color';
import { useAccountsStore, AccountWithBalance } from '../store/accountsStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTransactionsStore } from '../store/transactionsStore';
import { AccountsStackParamList, AccountType } from '../types';
import AppCard from '../components/AppCard';
import EmptyState from '../components/EmptyState';
import BottomSheet from '../components/BottomSheet';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';

type Nav = StackNavigationProp<AccountsStackParamList, 'AccountsList'>;

// ── Account type metadata ─────────────────────────────────────────────────────

function getAccountMeta(ds: DSType): Record<AccountType, { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; color: string; label: string }> {
  return {
    bank:   { icon: 'bank',           color: ds.primary,      label: 'Bank' },
    cash:   { icon: 'cash',           color: ds.primaryLight, label: 'Cash' },
    wallet: { icon: 'wallet',         color: ds.tertiary,     label: 'Wallet' },
    credit: { icon: 'credit-card',    color: ds.secondary,    label: 'Credit Card' },
    other:  { icon: 'shape-outline',  color: ds.purple,       label: 'Other' },
  };
}

// ── Account card (swipeable) ──────────────────────────────────────────────────

interface AccountCardProps {
  account: AccountWithBalance;
  currencySymbol: string;
  onEdit: () => void;
  onArchive: () => void;
  ds: DSType;
  styles: ReturnType<typeof makeStyles>;
}

function AccountCard({ account, currencySymbol, onEdit, onArchive, ds, styles }: AccountCardProps) {
  const swipeRef = useRef<Swipeable>(null);
  const ACCOUNT_META = getAccountMeta(ds);
  const meta = ACCOUNT_META[account.type] ?? ACCOUNT_META.other;

  const formatted = (Math.abs(account.balance) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const isNegative = account.balance < 0;

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => {
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [136, 0] });
    return (
      <Animated.View style={[styles.actions, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.editBtn]}
          onPress={() => { swipeRef.current?.close(); onEdit(); }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="pencil-outline" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.archiveBtn]}
          onPress={() => { swipeRef.current?.close(); onArchive(); }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="archive-arrow-down-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false} friction={2}>
      <AppCard style={styles.card} padding={16}>
        <View style={styles.cardRow}>
          {/* Icon */}
          <View style={[styles.iconWrap, { backgroundColor: hexToRgba(meta.color, 0.15) }]}>
            <MaterialCommunityIcons name={meta.icon} size={22} color={meta.color} />
          </View>

          {/* Name + type */}
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>{account.name}</Text>
            <Text style={styles.cardType}>{meta.label}</Text>
          </View>

          {/* Balance */}
          <View style={styles.balanceCol}>
            <Text style={[styles.balanceAmount, { color: isNegative ? ds.secondaryLight : ds.text.primary }]}>
              {isNegative ? '−' : ''}{currencySymbol}{formatted}
            </Text>
          </View>
        </View>
      </AppCard>
    </Swipeable>
  );
}

// ── Transfer bottom sheet ─────────────────────────────────────────────────────

interface TransferSheetProps {
  visible: boolean;
  onClose: () => void;
  accounts: AccountWithBalance[];
  currencySymbol: string;
  onTransfer: (fromId: string, toId: string, amountPaise: number) => Promise<void>;
  ds: DSType;
  styles: ReturnType<typeof makeStyles>;
}

function TransferSheet({ visible, onClose, accounts, currencySymbol, onTransfer, ds, styles }: TransferSheetProps) {
  const activeAccounts = accounts.filter((a) => !a.is_archived);
  const [fromId, setFromId] = useState<string>(activeAccounts[0]?.id ?? '');
  const [toId, setToId]     = useState<string>(activeAccounts[1]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [busy, setBusy]     = useState(false);

  const ACCOUNT_META = getAccountMeta(ds);

  const reset = useCallback(() => {
    setFromId(activeAccounts[0]?.id ?? '');
    setToId(activeAccounts[1]?.id ?? '');
    setAmount('');
  }, [activeAccounts]);

  useEffect(() => { if (!visible) reset(); }, [visible, reset]);

  const handleTransfer = async () => {
    const paise = Math.round(parseFloat(amount) * 100);
    if (!fromId || !toId || isNaN(paise) || paise <= 0) return;
    if (fromId === toId) {
      Alert.alert('Invalid', 'From and To accounts must be different.');
      return;
    }
    setBusy(true);
    try {
      await onTransfer(fromId, toId, paise);
      onClose();
    } catch {
      Alert.alert('Error', 'Transfer failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Transfer Funds">
      <View style={styles.sheetBody}>
        {/* From */}
        <Text style={styles.fieldLabel}>From</Text>
        <View style={styles.pickerRow}>
          {activeAccounts.map((a) => {
            const meta = ACCOUNT_META[a.type] ?? ACCOUNT_META.other;
            const selected = a.id === fromId;
            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.pickerChip, selected && styles.pickerChipActive]}
                onPress={() => setFromId(a.id)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name={meta.icon} size={16} color={selected ? '#fff' : ds.text.muted} />
                <Text style={[styles.pickerChipText, selected && styles.pickerChipTextActive]} numberOfLines={1}>
                  {a.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* To */}
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>To</Text>
        <View style={styles.pickerRow}>
          {activeAccounts.map((a) => {
            const meta = ACCOUNT_META[a.type] ?? ACCOUNT_META.other;
            const selected = a.id === toId;
            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.pickerChip, selected && styles.pickerChipActive]}
                onPress={() => setToId(a.id)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name={meta.icon} size={16} color={selected ? '#fff' : ds.text.muted} />
                <Text style={[styles.pickerChipText, selected && styles.pickerChipTextActive]} numberOfLines={1}>
                  {a.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Amount */}
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Amount</Text>
        <View style={styles.amountInputRow}>
          <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={ds.text.muted}
            selectionColor={ds.primary}
          />
        </View>

        <PrimaryButton
          label="Transfer"
          onPress={handleTransfer}
          loading={busy}
          style={{ marginTop: 24 }}
        />
      </View>
    </BottomSheet>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AccountsScreen() {
  const ds     = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { accounts, totalBalance, isLoading, loadFromDB, archiveAccount } = useAccountsStore();
  const { currencySymbol } = useSettingsStore();
  const { addTransaction } = useTransactionsStore();
  const [transferVisible, setTransferVisible] = useState(false);

  useEffect(() => { loadFromDB(); }, [loadFromDB]);

  const activeAccounts = accounts.filter((a) => !a.is_archived);

  const handleArchive = (account: AccountWithBalance) => {
    Alert.alert(
      'Archive Account',
      `Archive "${account.name}"? It will be hidden from your list but data will be kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: () => archiveAccount(account.id) },
      ]
    );
  };

  const handleTransfer = async (fromId: string, toId: string, amountPaise: number) => {
    const today = new Date().toISOString().slice(0, 10);
    await addTransaction({
      type: 'transfer',
      amount: amountPaise,
      account_id: fromId,
      to_account_id: toId,
      transaction_date: today,
      description: 'Transfer',
    });
    await loadFromDB();
  };

  const formattedTotal = (Math.abs(totalBalance) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <View style={styles.root}>
      <BrandHeader
        right={
          <TouchableOpacity style={styles.addAccountBtn} onPress={() => navigation.navigate('AddAccount')} activeOpacity={0.8}>
            <MaterialCommunityIcons name="plus" size={16} color="#fff" />
            <Text style={styles.addAccountBtnText}>Add Account</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Net Worth Hero ── */}
        <AppCard style={styles.heroCard} padding={24}>
          <Text style={styles.heroLabel}>Total Net Worth</Text>
          <Text style={[styles.heroAmount, totalBalance < 0 && { color: ds.secondaryLight }]}>
            {totalBalance < 0 ? '−' : ''}{currencySymbol}{formattedTotal}
          </Text>
          <View style={styles.heroMeta}>
            <MaterialCommunityIcons name="bank-outline" size={14} color={ds.text.muted} />
            <Text style={styles.heroMetaText}>{activeAccounts.length} account{activeAccounts.length !== 1 ? 's' : ''}</Text>
          </View>
        </AppCard>

        {/* ── Transfer button ── */}
        {activeAccounts.length >= 2 && (
          <TouchableOpacity
            style={styles.transferBtn}
            onPress={() => setTransferVisible(true)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="swap-horizontal" size={18} color={ds.primary} />
            <Text style={styles.transferBtnText}>Transfer Between Accounts</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={ds.text.muted} />
          </TouchableOpacity>
        )}

        {/* ── Account list / empty state ── */}
        {isLoading && activeAccounts.length === 0 ? null : activeAccounts.length === 0 ? (
          <EmptyState
            icon="bank-outline"
            title="No accounts yet"
            subtitle="Add a bank, cash, or wallet account to start tracking your finances."
            ctaLabel="Add Account"
            onCtaPress={() => navigation.navigate('AddAccount')}
          />
        ) : (
          <View style={styles.list}>
            <Text style={styles.sectionLabel}>Accounts</Text>
            {activeAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                currencySymbol={currencySymbol}
                onEdit={() => navigation.navigate('AddAccount')}
                onArchive={() => handleArchive(account)}
                ds={ds}
                styles={styles}
              />
            ))}
          </View>
        )}

        {/* Archived accounts */}
        {accounts.some((a) => a.is_archived) && (
          <View style={[styles.list, { marginTop: 8 }]}>
            <Text style={styles.sectionLabel}>Archived</Text>
            {accounts.filter((a) => a.is_archived).map((account) => (
              <AppCard key={account.id} style={[styles.card, styles.archivedCard]} padding={16}>
                <View style={styles.cardRow}>
                  <View style={[styles.iconWrap, { backgroundColor: hexToRgba(ds.text.muted, 0.12) }]}>
                    <MaterialCommunityIcons name="archive-outline" size={22} color={ds.text.muted} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardName, { color: ds.text.muted }]} numberOfLines={1}>{account.name}</Text>
                    <Text style={styles.cardType}>Archived</Text>
                  </View>
                </View>
              </AppCard>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Transfer Sheet ── */}
      <TransferSheet
        visible={transferVisible}
        onClose={() => setTransferVisible(false)}
        accounts={accounts}
        currencySymbol={currencySymbol}
        onTransfer={handleTransfer}
        ds={ds}
        styles={styles}
      />
    </View>
  );
}

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: ds.surface.screen,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: ds.border.subtle,
    },
    headerTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 24,
      lineHeight: 32,
      letterSpacing: -0.48,
      color: ds.text.primary,
    },
    activeBadge: {
      backgroundColor: hexToRgba(ds.primary, 0.15),
      borderRadius: ds.radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    activeBadgeText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      lineHeight: 16,
      color: ds.primaryLight,
    },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, gap: 12 },

    // Hero card
    heroCard: {
      marginBottom: 4,
    },
    heroLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    heroAmount: {
      fontFamily: 'Inter_700Bold',
      fontSize: 40,
      lineHeight: 48,
      letterSpacing: -1.6,
      color: ds.text.primary,
      marginBottom: 8,
    },
    heroMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    heroMetaText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
    },

    // Transfer button
    transferBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.lg,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    transferBtnText: {
      flex: 1,
      fontFamily: 'Inter_500Medium',
      fontSize: 15,
      lineHeight: 20,
      color: ds.text.secondary,
    },

    // Section label
    sectionLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      lineHeight: 16,
      color: ds.text.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
      marginLeft: 4,
    },
    list: { gap: 8 },

    // Account card
    card: { marginBottom: 0 },
    archivedCard: { opacity: 0.55 },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardInfo: { flex: 1, gap: 3 },
    cardName: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 16,
      lineHeight: 22,
      color: ds.text.primary,
    },
    cardType: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
    },
    balanceCol: { alignItems: 'flex-end' },
    balanceAmount: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 18,
      lineHeight: 24,
      color: ds.text.primary,
    },

    // Swipe actions
    actions: { flexDirection: 'row' },
    actionBtn: {
      width: 68,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    editBtn:    { backgroundColor: ds.tertiary },
    archiveBtn: { backgroundColor: '#6B7280' },

    addAccountBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: ds.radius.full,
      backgroundColor: ds.primary,
    },
    addAccountBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      lineHeight: 20,
      color: '#fff',
    },

    // Transfer sheet
    sheetBody: { paddingHorizontal: 20, paddingTop: 8 },
    fieldLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pickerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: ds.radius.full,
      backgroundColor: ds.surface.elevated,
      borderWidth: 1,
      borderColor: ds.border.subtle,
    },
    pickerChipActive: {
      backgroundColor: ds.primary,
      borderColor: ds.primary,
    },
    pickerChipText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      lineHeight: 18,
      color: ds.text.muted,
    },
    pickerChipTextActive: { color: '#fff' },
    amountInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.md,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      paddingHorizontal: 14,
      height: 52,
    },
    currencyPrefix: {
      fontFamily: 'Inter_500Medium',
      fontSize: 16,
      color: ds.text.muted,
      marginRight: 6,
    },
    amountInput: {
      flex: 1,
      fontFamily: 'Inter_500Medium',
      fontSize: 18,
      color: ds.text.primary,
    },
  });
}
