import { create } from 'zustand';
import { Budget, BudgetProgress, CreateBudgetInput, UpdateBudgetInput, Category } from '../types/db';
import {
  getAllBudgets,
  getAllBudgetProgress,
  createBudget as dbCreateBudget,
  updateBudget as dbUpdateBudget,
  deleteBudget as dbDeleteBudget,
  getAllCategories,
} from '../db/queries';

export interface BudgetCategoryRow {
  category: Category;
  budget: Budget | null;
  progress: BudgetProgress | null;
}

interface BudgetState {
  budgets: Budget[];
  progress: BudgetProgress[];
  allExpenseCategories: Category[];
  isLoading: boolean;
  error: string | null;

  loadFromDB: (year: number, month: number) => Promise<void>;
  upsertBudget: (categoryId: string, monthlyLimit: number) => Promise<void>;
  removeBudget: (budgetId: string) => Promise<void>;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budgets: [],
  progress: [],
  allExpenseCategories: [],
  isLoading: false,
  error: null,

  loadFromDB: async (year, month) => {
    set({ isLoading: true, error: null });
    try {
      const [budgets, progress, allCats] = await Promise.all([
        getAllBudgets(),
        getAllBudgetProgress(year, month),
        getAllCategories(),
      ]);
      set({
        budgets,
        progress,
        allExpenseCategories: allCats.filter(c => c.type === 'expense' && !c.is_deleted),
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  upsertBudget: async (categoryId, monthlyLimit) => {
    const existing = get().budgets.find(b => b.category_id === categoryId);
    if (existing) {
      await dbUpdateBudget(existing.id, { monthly_limit: monthlyLimit });
    } else {
      await dbCreateBudget({ category_id: categoryId, monthly_limit: monthlyLimit });
    }
  },

  removeBudget: async (budgetId) => {
    await dbDeleteBudget(budgetId);
    set(s => ({ budgets: s.budgets.filter(b => b.id !== budgetId) }));
  },
}));
