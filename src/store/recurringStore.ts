import { create } from 'zustand';
import {
  RecurringTransaction,
  CreateRecurringTransactionInput,
  UpdateRecurringTransactionInput,
} from '../types/db';
import {
  createRecurringTransaction,
  getRecurringTransactions,
  updateRecurringTransaction,
  deleteRecurringTransaction,
  getDueRecurringTransactions,
  advanceNextRunDate,
  getNextRunDate,
} from '../db/queries/recurringQueries';
import { createTransaction } from '../db/queries/transactionQueries';
import { addContribution } from '../db/queries/savingsQueries';
import { addInvestmentContribution } from '../db/queries/investmentContributionQueries';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface RecurringState {
  items: RecurringTransaction[];
  isLoading: boolean;
  loadFromDB: () => Promise<void>;
  addRecurring: (input: CreateRecurringTransactionInput) => Promise<RecurringTransaction>;
  updateRecurring: (id: string, input: UpdateRecurringTransactionInput) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  processDue: () => Promise<number>;
}

export const useRecurringStore = create<RecurringState>((set, get) => ({
  items: [],
  isLoading: false,

  loadFromDB: async () => {
    set({ isLoading: true });
    try {
      const items = await getRecurringTransactions();
      set({ items });
    } finally {
      set({ isLoading: false });
    }
  },

  addRecurring: async (input) => {
    const item = await createRecurringTransaction(input);
    set(s => ({ items: [item, ...s.items] }));
    return item;
  },

  updateRecurring: async (id, input) => {
    const updated = await updateRecurringTransaction(id, input);
    set(s => ({ items: s.items.map(i => (i.id === id ? updated : i)) }));
  },

  deleteRecurring: async (id) => {
    await deleteRecurringTransaction(id);
    set(s => ({ items: s.items.filter(i => i.id !== id) }));
  },

  processDue: async () => {
    const today = todayStr();
    const due = await getDueRecurringTransactions(today);
    let count = 0;

    for (const recurring of due) {
      let runDate = recurring.next_run_date;

      while (runDate <= today) {
        if (recurring.savings_goal_id) {
          await addContribution({
            goal_id: recurring.savings_goal_id,
            amount: recurring.amount,
            contribution_date: runDate,
            account_id: recurring.account_id,
          });
        } else if (recurring.investment_id) {
          await addInvestmentContribution({
            investment_id: recurring.investment_id,
            amount: recurring.amount,
            contribution_date: runDate,
            account_id: recurring.account_id,
          });
        } else {
          await createTransaction({
            type: recurring.type,
            amount: recurring.amount,
            account_id: recurring.account_id,
            category_id: recurring.category_id,
            description: recurring.description,
            notes: recurring.notes,
            transaction_date: runDate,
            transaction_time: recurring.time_of_day,
            is_recurring: 1,
          });
        }
        count++;
        runDate = getNextRunDate(runDate, recurring.frequency);
      }

      await advanceNextRunDate(recurring.id, runDate);
    }

    if (count > 0) {
      await get().loadFromDB();
    }

    return count;
  },
}));
