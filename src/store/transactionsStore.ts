import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionFilter,
  MonthlySummary,
} from '../types/db';
import {
  getTransactions,
  getRecentTransactions,
  getMonthlySummary,
  createTransaction as dbCreateTransaction,
  updateTransaction as dbUpdateTransaction,
  deleteTransaction as dbDeleteTransaction,
  getBudgetProgress,
  createNotification,
} from '../db/queries';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface ActiveMonth {
  year: number;
  month: number; // 1–12
}

function currentMonth(): ActiveMonth {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const EMPTY_SUMMARY: MonthlySummary = { income: 0, expenses: 0, net: 0 };

interface TransactionsState {
  // ── Data ───────────────────────────────────────────────────────────────────
  transactions: Transaction[];       // displayed list (up to 50 by default)
  monthlySummary: MonthlySummary;
  activeMonth: ActiveMonth;
  filter: TransactionFilter;

  // ── Meta ───────────────────────────────────────────────────────────────────
  isLoading: boolean;
  error: string | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  loadFromDB: () => Promise<void>;
  setActiveMonth: (year: number, month: number) => Promise<void>;
  setFilter: (filter: TransactionFilter) => Promise<void>;
  clearFilter: () => Promise<void>;

  addTransaction: (input: CreateTransactionInput) => Promise<Transaction>;
  updateTransaction: (id: string, input: UpdateTransactionInput) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactions: [],
  monthlySummary: EMPTY_SUMMARY,
  activeMonth: currentMonth(),
  filter: {},

  isLoading: false,
  error: null,

  loadFromDB: async () => {
    set({ isLoading: true, error: null });
    try {
      const { filter, activeMonth } = get();
      const hasFilter = Object.keys(filter).length > 0;

      const [transactions, monthlySummary] = await Promise.all([
        hasFilter ? getTransactions(filter) : getRecentTransactions(50),
        getMonthlySummary(activeMonth.year, activeMonth.month),
      ]);

      set({ transactions: transactions.slice(0, 50), monthlySummary, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  setActiveMonth: async (year, month) => {
    set({ activeMonth: { year, month }, isLoading: true, error: null });
    try {
      const monthlySummary = await getMonthlySummary(year, month);
      set({ monthlySummary, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  setFilter: async (filter) => {
    set({ filter, isLoading: true, error: null });
    try {
      const transactions = await getTransactions(filter);
      set({ transactions: transactions.slice(0, 50), isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  clearFilter: async () => {
    set({ filter: {}, isLoading: true, error: null });
    try {
      const transactions = await getRecentTransactions(50);
      set({ transactions, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  addTransaction: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const created = await dbCreateTransaction(input);
      const { activeMonth } = get();
      const monthlySummary = await getMonthlySummary(activeMonth.year, activeMonth.month);
      set((s) => ({
        transactions: [created, ...s.transactions].slice(0, 50),
        monthlySummary,
        isLoading: false,
      }));

      // Budget alert: check thresholds after an expense is recorded
      if (input.type === 'expense' && input.category_id) {
        const d = new Date(input.transaction_date);
        const bp = await getBudgetProgress(input.category_id, d.getFullYear(), d.getMonth() + 1);
        if (bp) {
          let alertType: 'budget_warning' | 'budget_exceeded' | null = null;
          if (bp.percent >= 100) alertType = 'budget_exceeded';
          else if (bp.percent >= 80) alertType = 'budget_warning';

          if (alertType) {
            const title = alertType === 'budget_exceeded'
              ? `${bp.category_name} budget exceeded`
              : `${bp.category_name} budget at ${bp.percent}%`;
            const body = alertType === 'budget_exceeded'
              ? `You've spent ${bp.spent} of your ${bp.limit} limit.`
              : `You've used ${bp.percent}% of your monthly ${bp.category_name} budget.`;

            await Promise.all([
              Notifications.scheduleNotificationAsync({
                content: { title, body },
                trigger: null,
              }),
              createNotification({ type: alertType, title, body, data: { category_id: input.category_id, percent: bp.percent } }),
            ]);
          }
        }
      }

      return created;
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  updateTransaction: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await dbUpdateTransaction(id, input);
      if (!updated) { set({ isLoading: false }); return; }

      const { activeMonth } = get();
      const monthlySummary = await getMonthlySummary(activeMonth.year, activeMonth.month);
      set((s) => ({
        transactions: s.transactions.map((t) => (t.id === id ? updated : t)),
        monthlySummary,
        isLoading: false,
      }));
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  deleteTransaction: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await dbDeleteTransaction(id);
      const { activeMonth } = get();
      const monthlySummary = await getMonthlySummary(activeMonth.year, activeMonth.month);
      set((s) => ({
        transactions: s.transactions.filter((t) => t.id !== id),
        monthlySummary,
        isLoading: false,
      }));
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },
}));

export const useTransactions = useTransactionsStore;
