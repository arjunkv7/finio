import { create } from 'zustand';
import { Category, CreateCategoryInput, UpdateCategoryInput } from '../types/db';
import {
  getAllCategories,
  createCategory as dbCreateCategory,
  updateCategory as dbUpdateCategory,
  deleteCategory as dbDeleteCategory,
} from '../db/queries';

interface CategoriesState {
  // ── Data ───────────────────────────────────────────────────────────────────
  incomeCategories: Category[];
  expenseCategories: Category[];

  // ── Meta ───────────────────────────────────────────────────────────────────
  isLoading: boolean;
  error: string | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  loadFromDB: () => Promise<void>;
  addCategory: (input: CreateCategoryInput) => Promise<Category>;
  updateCategory: (id: string, input: UpdateCategoryInput) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // Helper: look up a category by id across both lists
  getCategoryById: (id: string) => Category | undefined;
}

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  incomeCategories: [],
  expenseCategories: [],

  isLoading: false,
  error: null,

  loadFromDB: async () => {
    set({ isLoading: true, error: null });
    try {
      const all = await getAllCategories();
      set({
        incomeCategories: all.filter((c) => c.type === 'income'),
        expenseCategories: all.filter((c) => c.type === 'expense'),
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  addCategory: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const created = await dbCreateCategory(input);
      if (created.type === 'income') {
        set((s) => ({ incomeCategories: [...s.incomeCategories, created], isLoading: false }));
      } else {
        set((s) => ({ expenseCategories: [...s.expenseCategories, created], isLoading: false }));
      }
      return created;
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  updateCategory: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await dbUpdateCategory(id, input);
      if (!updated) { set({ isLoading: false }); return; }

      const patch = (list: Category[]) =>
        list.map((c) => (c.id === id ? { ...c, ...updated } : c));

      set((s) => ({
        incomeCategories: patch(s.incomeCategories),
        expenseCategories: patch(s.expenseCategories),
        isLoading: false,
      }));
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  deleteCategory: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await dbDeleteCategory(id);
      const drop = (list: Category[]) => list.filter((c) => c.id !== id);
      set((s) => ({
        incomeCategories: drop(s.incomeCategories),
        expenseCategories: drop(s.expenseCategories),
        isLoading: false,
      }));
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  getCategoryById: (id) => {
    const { incomeCategories, expenseCategories } = get();
    return [...incomeCategories, ...expenseCategories].find((c) => c.id === id);
  },
}));

export const useCategories = useCategoriesStore;
