import { create } from 'zustand';
import {
  Trip, TripParticipant, TripExpense, TripExpenseSplit,
  CreateTripInput, UpdateTripInput,
  CreateParticipantInput, CreateTripExpenseInput, CreateSplitInput,
  Settlement,
} from '../types/db';
import {
  getAllTrips,
  getTripById,
  getTripParticipants,
  getTripExpenses,
  getTripTotal,
  getTripSettlement,
  createTrip as dbCreateTrip,
  updateTrip as dbUpdateTrip,
  deleteTrip as dbDeleteTrip,
  addParticipant as dbAddParticipant,
  deleteParticipant as dbDeleteParticipant,
  createTripExpense as dbCreateExpense,
  deleteTripExpense as dbDeleteExpense,
  createExpenseSplit,
  replaceSplits,
  getExpenseSplits,
} from '../db/queries';

export interface ActiveTripDetails {
  trip: Trip;
  participants: TripParticipant[];
  expenses: TripExpense[];
  total: number;
  settlement: Settlement[];
}

interface TripsState {
  // ── Data ───────────────────────────────────────────────────────────────────
  trips: Trip[];
  activeTrip: ActiveTripDetails | null;
  activeTripId: string | null;

  // ── Meta ───────────────────────────────────────────────────────────────────
  isLoading: boolean;
  error: string | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  loadFromDB: () => Promise<void>;
  selectTrip: (id: string | null) => Promise<void>;
  refreshActiveTrip: () => Promise<void>;

  addTrip: (input: CreateTripInput) => Promise<Trip>;
  updateTrip: (id: string, input: UpdateTripInput) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;

  addParticipant: (input: CreateParticipantInput) => Promise<TripParticipant>;
  deleteParticipant: (id: string) => Promise<void>;

  addExpense: (input: CreateTripExpenseInput, splits?: Omit<CreateSplitInput, 'trip_expense_id'>[]) => Promise<TripExpense>;
  deleteExpense: (id: string) => Promise<void>;
  updateExpenseSplits: (expenseId: string, splits: Omit<CreateSplitInput, 'trip_expense_id'>[]) => Promise<void>;
  getExpenseSplits: (expenseId: string) => Promise<TripExpenseSplit[]>;
}

async function loadActiveTripDetails(tripId: string): Promise<ActiveTripDetails | null> {
  const trip = await getTripById(tripId);
  if (!trip) return null;
  const [participants, expenses, total, settlement] = await Promise.all([
    getTripParticipants(tripId),
    getTripExpenses(tripId),
    getTripTotal(tripId),
    getTripSettlement(tripId),
  ]);
  return { trip, participants, expenses, total, settlement };
}

export const useTripsStore = create<TripsState>((set, get) => ({
  trips: [],
  activeTrip: null,
  activeTripId: null,

  isLoading: false,
  error: null,

  loadFromDB: async () => {
    set({ isLoading: true, error: null });
    try {
      const trips = await getAllTrips();
      set({ trips, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  selectTrip: async (id) => {
    set({ activeTripId: id });
    if (!id) { set({ activeTrip: null }); return; }
    set({ isLoading: true, error: null });
    try {
      const activeTrip = await loadActiveTripDetails(id);
      set({ activeTrip, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  refreshActiveTrip: async () => {
    const { activeTripId } = get();
    if (!activeTripId) return;
    set({ isLoading: true, error: null });
    try {
      const activeTrip = await loadActiveTripDetails(activeTripId);
      set({ activeTrip, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  addTrip: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const created = await dbCreateTrip(input);
      const trips = await getAllTrips();
      set({ trips, isLoading: false });
      return created;
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  updateTrip: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      await dbUpdateTrip(id, input);
      const trips = await getAllTrips();
      const { activeTripId } = get();
      const activeTrip = activeTripId === id
        ? await loadActiveTripDetails(id)
        : get().activeTrip;
      set({ trips, activeTrip, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  deleteTrip: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await dbDeleteTrip(id);
      set((s) => ({
        trips: s.trips.filter((t) => t.id !== id),
        activeTripId: s.activeTripId === id ? null : s.activeTripId,
        activeTrip: s.activeTripId === id ? null : s.activeTrip,
        isLoading: false,
      }));
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  addParticipant: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const participant = await dbAddParticipant(input);
      await get().refreshActiveTrip();
      return participant;
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  deleteParticipant: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await dbDeleteParticipant(id);
      await get().refreshActiveTrip();
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  addExpense: async (input, splits) => {
    set({ isLoading: true, error: null });
    try {
      const expense = await dbCreateExpense(input);
      if (splits && splits.length > 0) {
        await replaceSplits(expense.id, splits);
      }
      await get().refreshActiveTrip();
      return expense;
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  deleteExpense: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await dbDeleteExpense(id);
      await get().refreshActiveTrip();
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  updateExpenseSplits: async (expenseId, splits) => {
    set({ isLoading: true, error: null });
    try {
      await replaceSplits(expenseId, splits);
      await get().refreshActiveTrip();
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      throw err;
    }
  },

  getExpenseSplits: (expenseId) => getExpenseSplits(expenseId),
}));

export const useTrips = useTripsStore;
