import { create } from 'zustand';
import {
  AssetType,
  CreateInvestmentInput,
  UpdateInvestmentInput,
  InvestmentContribution,
  CreateInvestmentContributionInput,
} from '../types/db';
import { InvestmentWithTotal } from '../db/queries/investmentQueries';
import {
  getAllInvestments,
  getTotalInvested,
  getInvestmentSummaryByType,
  createInvestment as dbCreateInvestment,
  updateInvestment as dbUpdateInvestment,
  deleteInvestment as dbDeleteInvestment,
} from '../db/queries';
import {
  addInvestmentContribution as dbAddContribution,
  getContributionsByInvestment,
  deleteInvestmentContribution as dbDeleteContribution,
} from '../db/queries/investmentContributionQueries';

export type { InvestmentWithTotal };

export interface InvestmentSummary {
  asset_type: AssetType;
  total: number;
}

interface InvestmentsState {
  investments: InvestmentWithTotal[];
  totalInvested: number;
  summaryByType: InvestmentSummary[];
  activeInvestmentId: string | null;
  activeContributions: InvestmentContribution[];
  isLoading: boolean;
  error: string | null;

  loadFromDB: () => Promise<void>;
  selectInvestment: (id: string | null) => Promise<void>;
  addInvestment: (input: CreateInvestmentInput) => Promise<InvestmentWithTotal>;
  updateInvestment: (id: string, input: UpdateInvestmentInput) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
  addContribution: (input: CreateInvestmentContributionInput) => Promise<InvestmentContribution>;
  deleteContribution: (id: string, investmentId: string) => Promise<void>;
}

async function reloadSummary() {
  const [investments, totalInvested, summaryByType] = await Promise.all([
    getAllInvestments(),
    getTotalInvested(),
    getInvestmentSummaryByType(),
  ]);
  return { investments, totalInvested, summaryByType };
}

export const useInvestmentsStore = create<InvestmentsState>((set, get) => ({
  investments: [],
  totalInvested: 0,
  summaryByType: [],
  activeInvestmentId: null,
  activeContributions: [],
  isLoading: false,
  error: null,

  loadFromDB: async () => {
    set({ isLoading: true, error: null });
    try {
      set({ ...(await reloadSummary()), isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  selectInvestment: async (id) => {
    set({ activeInvestmentId: id });
    if (!id) { set({ activeContributions: [] }); return; }
    set({ isLoading: true });
    try {
      const activeContributions = await getContributionsByInvestment(id);
      set({ activeContributions, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  addInvestment: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const created = await dbCreateInvestment(input);
      set({ ...(await reloadSummary()), isLoading: false });
      return created as InvestmentWithTotal;
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  updateInvestment: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      await dbUpdateInvestment(id, input);
      set({ ...(await reloadSummary()), isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  deleteInvestment: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await dbDeleteInvestment(id);
      set({ ...(await reloadSummary()), isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  addContribution: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const contribution = await dbAddContribution(input);
      const { activeInvestmentId } = get();
      const activeContributions = activeInvestmentId === input.investment_id
        ? await getContributionsByInvestment(input.investment_id)
        : get().activeContributions;
      set({ ...(await reloadSummary()), activeContributions, isLoading: false });
      return contribution;
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  deleteContribution: async (id, investmentId) => {
    set({ isLoading: true, error: null });
    try {
      await dbDeleteContribution(id);
      const { activeInvestmentId } = get();
      const activeContributions = activeInvestmentId === investmentId
        ? await getContributionsByInvestment(investmentId)
        : get().activeContributions;
      set({ ...(await reloadSummary()), activeContributions, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },
}));

export const useInvestments = useInvestmentsStore;
