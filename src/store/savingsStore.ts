import { create } from 'zustand';
import { SavingsGoal, SavingsContribution, CreateSavingsGoalInput, UpdateSavingsGoalInput, CreateContributionInput } from '../types/db';
import {
  getAllSavingsGoals,
  getSavingsGoalProgress,
  createSavingsGoal as dbCreateGoal,
  updateSavingsGoal as dbUpdateGoal,
  deleteSavingsGoal as dbDeleteGoal,
  addContribution as dbAddContribution,
  getContributionsByGoal,
  deleteContribution as dbDeleteContribution,
} from '../db/queries';

export interface GoalWithProgress extends SavingsGoal {
  contributed: number;
  remaining: number;
  percent: number;
  daysRemaining: number | null;
}

interface SavingsState {
  // ── Data ───────────────────────────────────────────────────────────────────
  goals: GoalWithProgress[];
  activeGoalContributions: SavingsContribution[];
  activeGoalId: string | null;

  // ── Meta ───────────────────────────────────────────────────────────────────
  isLoading: boolean;
  error: string | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  loadFromDB: () => Promise<void>;
  selectGoal: (id: string | null) => Promise<void>;

  addGoal: (input: CreateSavingsGoalInput) => Promise<SavingsGoal>;
  updateGoal: (id: string, input: UpdateSavingsGoalInput) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;

  addContribution: (input: CreateContributionInput) => Promise<SavingsContribution>;
  deleteContribution: (id: string, goalId: string) => Promise<void>;
}

async function loadGoalsWithProgress(): Promise<GoalWithProgress[]> {
  const goals = await getAllSavingsGoals();
  return Promise.all(
    goals.map(async (g) => {
      const progress = await getSavingsGoalProgress(g.id);
      return progress
        ? { ...g, contributed: progress.contributed, remaining: progress.remaining, percent: progress.percent, daysRemaining: progress.daysRemaining }
        : { ...g, contributed: 0, remaining: g.target_amount, percent: 0, daysRemaining: null };
    })
  );
}

export const useSavingsStore = create<SavingsState>((set, get) => ({
  goals: [],
  activeGoalContributions: [],
  activeGoalId: null,

  isLoading: false,
  error: null,

  loadFromDB: async () => {
    set({ isLoading: true, error: null });
    try {
      const goals = await loadGoalsWithProgress();
      set({ goals, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  selectGoal: async (id) => {
    set({ activeGoalId: id });
    if (!id) { set({ activeGoalContributions: [] }); return; }
    set({ isLoading: true, error: null });
    try {
      const contributions = await getContributionsByGoal(id);
      set({ activeGoalContributions: contributions, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  addGoal: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const created = await dbCreateGoal(input);
      const goals = await loadGoalsWithProgress();
      set({ goals, isLoading: false });
      return created;
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  updateGoal: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      await dbUpdateGoal(id, input);
      const goals = await loadGoalsWithProgress();
      set({ goals, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  deleteGoal: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await dbDeleteGoal(id);
      set((s) => ({
        goals: s.goals.filter((g) => g.id !== id),
        activeGoalId: s.activeGoalId === id ? null : s.activeGoalId,
        activeGoalContributions: s.activeGoalId === id ? [] : s.activeGoalContributions,
        isLoading: false,
      }));
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  addContribution: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const contribution = await dbAddContribution(input);
      const goals = await loadGoalsWithProgress();
      const { activeGoalId } = get();
      const contributions = activeGoalId === input.goal_id
        ? await getContributionsByGoal(input.goal_id)
        : get().activeGoalContributions;
      set({ goals, activeGoalContributions: contributions, isLoading: false });
      return contribution;
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  deleteContribution: async (id, goalId) => {
    set({ isLoading: true, error: null });
    try {
      await dbDeleteContribution(id);
      const goals = await loadGoalsWithProgress();
      const { activeGoalId } = get();
      const contributions = activeGoalId === goalId
        ? await getContributionsByGoal(goalId)
        : get().activeGoalContributions;
      set({ goals, activeGoalContributions: contributions, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },
}));

export const useSavings = useSavingsStore;
