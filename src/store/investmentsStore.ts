import { create } from 'zustand';
import { Investment, AssetType, CreateInvestmentInput, UpdateInvestmentInput } from '../types/db';
import {
  getAllInvestments,
  getTotalInvested,
  getInvestmentSummaryByType,
  createInvestment as dbCreateInvestment,
  updateInvestment as dbUpdateInvestment,
  deleteInvestment as dbDeleteInvestment,
} from '../db/queries';

export interface InvestmentSummary {
  asset_type: AssetType;
  total: number;
}

interface InvestmentsState {
  // ── Data ───────────────────────────────────────────────────────────────────
  investments: Investment[];
  totalInvested: number;
  summaryByType: InvestmentSummary[];

  // ── Meta ───────────────────────────────────────────────────────────────────
  isLoading: boolean;
  error: string | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  loadFromDB: () => Promise<void>;
  addInvestment: (input: CreateInvestmentInput) => Promise<Investment>;
  updateInvestment: (id: string, input: UpdateInvestmentInput) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
}

export const useInvestmentsStore = create<InvestmentsState>((set) => ({
  investments: [],
  totalInvested: 0,
  summaryByType: [],

  isLoading: false,
  error: null,

  loadFromDB: async () => {
    set({ isLoading: true, error: null });
    try {
      const [investments, totalInvested, summaryByType] = await Promise.all([
        getAllInvestments(),
        getTotalInvested(),
        getInvestmentSummaryByType(),
      ]);
      set({ investments, totalInvested, summaryByType, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  addInvestment: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const created = await dbCreateInvestment(input);
      const [investments, totalInvested, summaryByType] = await Promise.all([
        getAllInvestments(),
        getTotalInvested(),
        getInvestmentSummaryByType(),
      ]);
      set({ investments, totalInvested, summaryByType, isLoading: false });
      return created;
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  updateInvestment: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      await dbUpdateInvestment(id, input);
      const [investments, totalInvested, summaryByType] = await Promise.all([
        getAllInvestments(),
        getTotalInvested(),
        getInvestmentSummaryByType(),
      ]);
      set({ investments, totalInvested, summaryByType, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  deleteInvestment: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await dbDeleteInvestment(id);
      const [investments, totalInvested, summaryByType] = await Promise.all([
        getAllInvestments(),
        getTotalInvested(),
        getInvestmentSummaryByType(),
      ]);
      set({ investments, totalInvested, summaryByType, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },
}));

export const useInvestments = useInvestmentsStore;
