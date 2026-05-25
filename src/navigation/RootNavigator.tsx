import React from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
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
import { AutoCreatedEntry } from '../db/queries/smsTransactionQueries';
import { useDS } from '../hooks/useDS';
import { Transaction } from '../types/db';

const Stack = createStackNavigator<RootStackParamList>();
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Auto-created review modal ─────────────────────────────────────────────────

function toTransaction(e: AutoCreatedEntry): Transaction {
  return {
    id: e.tx_id,
    type: e.tx_type as Transaction['type'],
    amount: e.tx_amount,
    account_id: e.tx_account_id,
    to_account_id: null,
    category_id: e.tx_category_id,
    description: e.tx_description,
    notes: e.tx_notes,
    transaction_date: e.tx_transaction_date,
    transaction_time: e.tx_transaction_time,
    receipt_photo_uri: null,
    is_recurring: 0,
    recurrence_rule: null,
    trip_id: null,
    is_deleted: 0,
    created_at: e.tx_created_at,
    updated_at: e.tx_updated_at,
  };
}

function AutoCreatedReviewModal() {
  const ds           = useDS();
  const navigation   = useNavigation<any>();
  const autoCreated  = useSmsTransactionsStore(s => s.autoCreated);
  const acceptAll    = useSmsTransactionsStore(s => s.acceptAllAutoCreated);
  const deleteEntry  = useSmsTransactionsStore(s => s.deleteAutoCreated);

  if (autoCreated.length === 0) return null;

  const amtStr = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

  const handleEdit = (entry: AutoCreatedEntry) => {
    navigation.navigate('AddTransaction', { editTx: toTransaction(entry) });
  };

  const handleAccept = async () => { await acceptAll(); };

  const styles = makeModalStyles(ds);

  const renderItem = ({ item }: { item: AutoCreatedEntry }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={[
          styles.typeTag,
          { backgroundColor: item.sms_type === 'expense' ? 'rgba(255,107,107,0.15)' : 'rgba(0,230,118,0.15)' },
        ]}>
          <MaterialCommunityIcons
            name={item.sms_type === 'expense' ? 'arrow-up' : 'arrow-down'}
            size={14}
            color={item.sms_type === 'expense' ? '#FF6B6B' : '#00E676'}
          />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardAmt, { color: item.sms_type === 'expense' ? '#FF6B6B' : '#00E676' }]}>
            {item.sms_type === 'expense' ? '− ' : '+ '}{amtStr(item.sms_amount)}
          </Text>
          <Text style={[styles.cardDesc, { color: ds.text.secondary }]} numberOfLines={1}>
            {item.sms_description ?? 'No description'}
          </Text>
          <Text style={[styles.cardMeta, { color: ds.text.muted }]}>
            {item.account_name} · {item.sms_message_date}
          </Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: ds.surface.elevated }]}
          onPress={() => handleEdit(item)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="pencil-outline" size={16} color={ds.text.secondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: 'rgba(255,107,107,0.12)' }]}
          onPress={() => deleteEntry(item.sms_id)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={16} color="#FF6B6B" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible
      animationType="slide"
      transparent
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: ds.surface.card }]}>
          {/* Handle bar */}
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
                From your bank messages. Edit or delete if needed.
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
          />

          {/* Footer */}
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
    </Modal>
  );
}

function makeModalStyles(ds: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: SCREEN_HEIGHT * 0.85,
      paddingBottom: 32,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 6,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 16,
    },
    headerIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    headerText: { flex: 1 },
    headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
    headerSub:   { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
    list:        { flexGrow: 0 },
    listContent: { paddingHorizontal: 16, paddingBottom: 8 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.07)',
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    cardLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    typeTag: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    cardInfo:    { flex: 1, gap: 2 },
    cardAmt:     { fontFamily: 'Inter_700Bold', fontSize: 15 },
    cardDesc:    { fontFamily: 'Inter_500Medium', fontSize: 13 },
    cardMeta:    { fontFamily: 'Inter_400Regular', fontSize: 11 },
    cardActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
    actionBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    acceptBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 20,
      marginTop: 8,
      height: 50,
      borderRadius: 14,
    },
    acceptBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 16,
      color: '#fff',
    },
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
