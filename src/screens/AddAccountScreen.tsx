import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { DSType } from '../constants/colors';
import { useDS } from '../hooks/useDS';
import { hexToRgba } from '../utils/color';
import { useAccountsStore } from '../store/accountsStore';
import { useSettingsStore } from '../store/settingsStore';
import { AccountType, AccountsStackParamList } from '../types';
import AppHeader from '../components/AppHeader';

type Nav = StackNavigationProp<AccountsStackParamList, 'AddAccount'>;

// ── Preset brand colors ───────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#F59E0B', // Amber
  '#F43F5E', // Rose
  '#06B6D4', // Cyan
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionLabel({ label, styles }: { label: string; styles: ReturnType<typeof makeStyles> }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: ds.surface.screen,
    },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, gap: 8, paddingBottom: 32 },

    sectionLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 8,
      marginBottom: 8,
    },
    fieldHint: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
      marginBottom: 8,
      marginTop: -4,
    },

    // Text input
    inputWrap: {
      backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.md,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      paddingHorizontal: 14,
      height: 52,
      justifyContent: 'center',
      marginBottom: 4,
    },
    inputError: { borderColor: ds.secondary },
    textInput: {
      fontFamily: 'Inter_400Regular',
      fontSize: 16,
      lineHeight: 22,
      color: ds.text.primary,
    },
    errorText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 16,
      color: ds.secondaryLight,
      marginBottom: 4,
    },

    // Type chips
    typeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 4,
    },
    typeChip: {
      alignItems: 'center',
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: ds.radius.lg,
      backgroundColor: ds.surface.elevated,
      borderWidth: 1.5,
      borderColor: ds.border.subtle,
      minWidth: 80,
    },
    typeChipIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeChipLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      lineHeight: 16,
      color: ds.text.muted,
      textAlign: 'center',
    },

    // Color swatches
    colorRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 4,
    },
    colorSwatch: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorSwatchSelected: {
      borderWidth: 3,
      borderColor: '#fff',
    },

    // Balance input
    balanceInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: ds.surface.elevated,
      borderRadius: ds.radius.md,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      overflow: 'hidden',
      height: 56,
      marginBottom: 4,
    },
    currencyPill: {
      paddingHorizontal: 16,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ds.surface.highest,
      borderRightWidth: 1,
      borderRightColor: ds.border.subtle,
    },
    currencyText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 18,
      color: ds.text.secondary,
    },
    balanceInput: {
      flex: 1,
      paddingHorizontal: 16,
      fontFamily: 'Inter_500Medium',
      fontSize: 20,
      lineHeight: 26,
      color: ds.text.primary,
    },

    // Preview card
    previewCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: ds.surface.card,
      borderRadius: ds.radius.xl,
      borderWidth: 1,
      borderColor: ds.border.subtle,
      padding: 16,
      marginTop: 12,
    },
    previewIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewName: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 16,
      lineHeight: 22,
      color: ds.text.primary,
    },
    previewType: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: ds.text.muted,
    },
    previewBalance: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 18,
      lineHeight: 24,
      color: ds.text.primary,
    },

    // Footer / save button
    footer: {
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
      borderTopWidth: 1,
      borderTopColor: ds.border.subtle,
      backgroundColor: ds.surface.screen,
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: ds.primary,
      borderRadius: ds.radius.md,
      height: 52,
    },
    saveBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 16,
      lineHeight: 22,
      color: '#fff',
    },
  });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AddAccountScreen() {
  const ds = useDS();
  const s = useMemo(() => makeStyles(ds), [ds]);

  const navigation = useNavigation<Nav>();
  const { addAccount } = useAccountsStore();
  const { currencySymbol } = useSettingsStore();

  // ── Account type options (depends on ds) ─────────────────────────────────
  const ACCOUNT_TYPES: { type: AccountType; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; color: string }[] = [
    { type: 'bank',   icon: 'bank',           label: 'Bank',        color: ds.primary },
    { type: 'cash',   icon: 'cash',           label: 'Cash',        color: ds.primaryLight },
    { type: 'wallet', icon: 'wallet',         label: 'Wallet',      color: ds.tertiary },
    { type: 'credit', icon: 'credit-card',    label: 'Credit Card', color: ds.secondary },
    { type: 'other',  icon: 'shape-outline',  label: 'Other',       color: ds.purple },
  ];

  const [name, setName]             = useState('');
  const [type, setType]             = useState<AccountType>('bank');
  const [color, setColor]           = useState(PRESET_COLORS[0]);
  const [balance, setBalance]       = useState('');
  const [nameError, setNameError]   = useState('');
  const [balanceError, setBalanceError] = useState('');
  const [saving, setSaving]         = useState(false);

  const validate = (): boolean => {
    let valid = true;
    if (name.trim().length === 0) {
      setNameError('Account name is required.');
      valid = false;
    } else {
      setNameError('');
    }
    const raw = balance.trim();
    if (raw !== '' && (isNaN(Number(raw)) || Number(raw) < 0)) {
      setBalanceError('Enter a valid amount (e.g. 5000 or 5000.50).');
      valid = false;
    } else {
      setBalanceError('');
    }
    return valid;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const openingPaise = balance.trim() ? Math.round(parseFloat(balance) * 100) : 0;
      await addAccount({
        name: name.trim(),
        type,
        color,
        opening_balance: openingPaise,
      });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save account. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title="New Account" onBack={() => navigation.goBack()} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Account Name ── */}
        <SectionLabel label="Account Name" styles={s} />
        <View style={[s.inputWrap, nameError ? s.inputError : null]}>
          <TextInput
            style={s.textInput}
            value={name}
            onChangeText={(v) => { setName(v); if (nameError) setNameError(''); }}
            placeholder="e.g. HDFC Savings, Cash Wallet"
            placeholderTextColor={ds.text.muted}
            selectionColor={ds.primary}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>
        {nameError ? <Text style={s.errorText}>{nameError}</Text> : null}

        {/* ── Account Type ── */}
        <SectionLabel label="Account Type" styles={s} />
        <View style={s.typeRow}>
          {ACCOUNT_TYPES.map(({ type: t, icon, label, color: tColor }) => {
            const selected = type === t;
            return (
              <TouchableOpacity
                key={t}
                style={[
                  s.typeChip,
                  selected && { backgroundColor: hexToRgba(tColor, 0.2), borderColor: tColor },
                ]}
                onPress={() => setType(t)}
                activeOpacity={0.75}
              >
                <View style={[s.typeChipIcon, { backgroundColor: hexToRgba(tColor, selected ? 0.25 : 0.1) }]}>
                  <MaterialCommunityIcons name={icon} size={20} color={selected ? tColor : ds.text.muted} />
                </View>
                <Text style={[s.typeChipLabel, selected && { color: tColor }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Brand Color ── */}
        <SectionLabel label="Brand Color" styles={s} />
        <View style={s.colorRow}>
          {PRESET_COLORS.map((c) => {
            const selected = color === c;
            return (
              <TouchableOpacity
                key={c}
                style={[s.colorSwatch, { backgroundColor: c }, selected && s.colorSwatchSelected]}
                onPress={() => setColor(c)}
                activeOpacity={0.8}
              >
                {selected && (
                  <MaterialCommunityIcons name="check" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Opening Balance ── */}
        <SectionLabel label="Opening Balance" styles={s} />
        <Text style={s.fieldHint}>Enter the current balance of this account. Leave blank for 0.</Text>
        <View style={[s.balanceInputRow, balanceError ? s.inputError : null]}>
          <View style={s.currencyPill}>
            <Text style={s.currencyText}>{currencySymbol}</Text>
          </View>
          <TextInput
            style={s.balanceInput}
            value={balance}
            onChangeText={(v) => { setBalance(v); if (balanceError) setBalanceError(''); }}
            placeholder="0.00"
            placeholderTextColor={ds.text.muted}
            keyboardType="decimal-pad"
            selectionColor={ds.primary}
            returnKeyType="done"
          />
        </View>
        {balanceError ? <Text style={s.errorText}>{balanceError}</Text> : null}

        {/* ── Preview card ── */}
        <View style={s.previewCard}>
          <View style={[s.previewIcon, { backgroundColor: hexToRgba(color, 0.2) }]}>
            <MaterialCommunityIcons
              name={ACCOUNT_TYPES.find((t) => t.type === type)?.icon ?? 'bank'}
              size={22}
              color={color}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.previewName}>{name.trim() || 'Account Name'}</Text>
            <Text style={s.previewType}>{ACCOUNT_TYPES.find((t) => t.type === type)?.label}</Text>
          </View>
          <Text style={s.previewBalance}>
            {currencySymbol}{balance ? parseFloat(balance || '0').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </Text>
        </View>
      </ScrollView>

      {/* ── Save button ── */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <Text style={s.saveBtnText}>Saving…</Text>
          ) : (
            <>
              <MaterialCommunityIcons name="check-circle-outline" size={20} color="#fff" />
              <Text style={s.saveBtnText}>Create Account</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
