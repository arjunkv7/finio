import { create } from 'zustand';
import { Account, CreateAccountInput, UpdateAccountInput } from '../types/db';
import {
  getAllAccounts,
  getAccountBalance,
  createAccount,
  updateAccount as dbUpdateAccount,
  archiveAccount as dbArchiveAccount,
  deleteAccount as dbDeleteAccount,
} from '../db/queries';

export interface AccountWithBalance extends Account {
  balance: number;
}

interface AccountsState {
  // ── Data ───────────────────────────────────────────────────────────────────
  accounts: AccountWithBalance[];
  selectedAccountId: string | null;
  totalBalance: number; // sum of active account balances

  // ── Meta ───────────────────────────────────────────────────────────────────
  isLoading: boolean;
  error: string | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  loadFromDB: () => Promise<void>;
  selectAccount: (id: string | null) => void;
  addAccount: (input: CreateAccountInput) => Promise<void>;
  updateAccount: (id: string, input: UpdateAccountInput) => Promise<void>;
  archiveAccount: (id: string) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
}

async function loadAccountsWithBalances(): Promise<{
  accounts: AccountWithBalance[];
  totalBalance: number;
}> {
  const accounts = await getAllAccounts();
  const accountsWithBalances = await Promise.all(
    accounts.map(async (a) => ({
      ...a,
      balance: await getAccountBalance(a.id),
    }))
  );
  const totalBalance = accountsWithBalances
    .filter((a) => !a.is_archived)
    .reduce((sum, a) => sum + a.balance, 0);
  return { accounts: accountsWithBalances, totalBalance };
}

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],
  selectedAccountId: null,
  totalBalance: 0,

  isLoading: false,
  error: null,

  loadFromDB: async () => {
    set({ isLoading: true, error: null });
    try {
      const { accounts, totalBalance } = await loadAccountsWithBalances();
      set({ accounts, totalBalance, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  selectAccount: (id) => set({ selectedAccountId: id }),

  addAccount: async (input) => {
    set({ isLoading: true, error: null });
    try {
      await createAccount(input);
      const { accounts, totalBalance } = await loadAccountsWithBalances();
      set({ accounts, totalBalance, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  updateAccount: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      await dbUpdateAccount(id, input);
      const { accounts, totalBalance } = await loadAccountsWithBalances();
      set({ accounts, totalBalance, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  archiveAccount: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await dbArchiveAccount(id);
      const { accounts, totalBalance } = await loadAccountsWithBalances();
      set({ accounts, totalBalance, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  deleteAccount: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await dbDeleteAccount(id);
      set((state) => ({
        accounts: state.accounts.filter((a) => a.id !== id),
        totalBalance: state.accounts
          .filter((a) => a.id !== id && !a.is_archived)
          .reduce((sum, a) => sum + a.balance, 0),
        isLoading: false,
      }));
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },
}));

export const useAccounts = useAccountsStore;
