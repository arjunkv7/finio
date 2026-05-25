import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import { SmsTransaction } from '../types/db';
import {
  getPendingSmsTransactions,
  getPendingSmsCount,
  approveSmsTransaction,
  dismissSmsTransaction,
  dismissAllPendingSmsTransactions,
  getAutoCreatedEntries,
  markAllAutoCreatedAsApproved,
  deleteAutoCreatedSmsTransaction,
  AutoCreatedEntry,
} from '../db/queries/smsTransactionQueries';
import { createNotification } from '../db/queries/notificationQueries';
import { createTransaction as dbCreateTransaction } from '../db/queries/transactionQueries';
import { CreateTransactionInput } from '../types/db';

interface SmsTransactionsState {
  pending: SmsTransaction[];
  pendingCount: number;
  isLoading: boolean;
  autoCreated: AutoCreatedEntry[];

  loadPending: () => Promise<void>;
  approve: (id: string, input: CreateTransactionInput) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  dismissAll: () => Promise<void>;

  loadAutoCreated: () => Promise<void>;
  acceptAllAutoCreated: () => Promise<void>;
  deleteAutoCreated: (smsId: string) => Promise<void>;
}

export const useSmsTransactionsStore = create<SmsTransactionsState>((set, get) => ({
  pending: [],
  pendingCount: 0,
  isLoading: false,
  autoCreated: [],

  loadPending: async () => {
    set({ isLoading: true });
    try {
      const [pending, pendingCount] = await Promise.all([
        getPendingSmsTransactions(),
        getPendingSmsCount(),
      ]);
      set({ pending, pendingCount, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  approve: async (id, input) => {
    try {
      const created = await dbCreateTransaction(input);
      await approveSmsTransaction(id, created.id);
      set(s => ({
        pending: s.pending.filter(p => p.id !== id),
        pendingCount: Math.max(0, s.pendingCount - 1),
      }));
    } catch (err) {
      throw err;
    }
  },

  dismiss: async (id) => {
    await dismissSmsTransaction(id);
    set(s => ({
      pending: s.pending.filter(p => p.id !== id),
      pendingCount: Math.max(0, s.pendingCount - 1),
    }));
  },

  dismissAll: async () => {
    await dismissAllPendingSmsTransactions();
    set({ pending: [], pendingCount: 0 });
  },

  loadAutoCreated: async () => {
    try {
      const entries = await getAutoCreatedEntries();
      set({ autoCreated: entries });
    } catch {
      set({ autoCreated: [] });
    }
  },

  acceptAllAutoCreated: async () => {
    await markAllAutoCreatedAsApproved();
    set({ autoCreated: [] });
  },

  deleteAutoCreated: async (smsId) => {
    await deleteAutoCreatedSmsTransaction(smsId);
    set(s => ({ autoCreated: s.autoCreated.filter(e => e.sms_id !== smsId) }));
  },
}));

export async function notifyNewSmsTransactions(count: number): Promise<void> {
  if (count <= 0) return;
  const title = count === 1 ? '1 transaction auto-added' : `${count} transactions auto-added`;
  const body = 'Open Finio to review the transactions added from your messages.';
  await Promise.all([
    Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    }),
    createNotification({ type: 'sms_detected', title, body }),
  ]);
}
