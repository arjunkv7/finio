import { v4 as uuidv4 } from 'uuid';
import { SQLiteBindValue } from 'expo-sqlite';
import { getDb } from '../database';
import {
  Trip,
  TripParticipant,
  TripExpense,
  TripExpenseSplit,
  CreateTripInput,
  UpdateTripInput,
  CreateParticipantInput,
  CreateTripExpenseInput,
  CreateSplitInput,
  Settlement,
} from '../../types/db';

const now = () => new Date().toISOString();

// ─── Trips ───────────────────────────────────────────────────────────────────

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const db = await getDb();
  const id = uuidv4();
  const ts = now();
  await db.runAsync(
    `INSERT INTO trips (id, name, description, start_date, end_date, is_settled, is_deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    [id, input.name, input.description ?? null, input.start_date ?? null, input.end_date ?? null, ts, ts]
  );
  return getTripById(id) as Promise<Trip>;
}

export async function getTripById(id: string): Promise<Trip | null> {
  const db = await getDb();
  return db.getFirstAsync<Trip>(
    'SELECT * FROM trips WHERE id = ? AND is_deleted = 0',
    [id]
  );
}

export async function getAllTrips(): Promise<Trip[]> {
  const db = await getDb();
  return db.getAllAsync<Trip>(
    'SELECT * FROM trips WHERE is_deleted = 0 ORDER BY created_at DESC'
  );
}

export async function updateTrip(id: string, input: UpdateTripInput): Promise<Trip | null> {
  const db = await getDb();
  const fields = { ...input } as Record<string, SQLiteBindValue>;
  const keys = Object.keys(fields);
  if (keys.length === 0) return getTripById(id);
  const ts = now();
  const setClause = [...keys.map(k => `${k} = ?`), 'updated_at = ?'].join(', ');
  await db.runAsync(
    `UPDATE trips SET ${setClause} WHERE id = ? AND is_deleted = 0`,
    [...Object.values(fields), ts, id]
  );
  return getTripById(id);
}

export async function deleteTrip(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE trips SET is_deleted = 1, updated_at = ? WHERE id = ?',
    [now(), id]
  );
}

// ─── Participants ─────────────────────────────────────────────────────────────

export async function addParticipant(input: CreateParticipantInput): Promise<TripParticipant> {
  const db = await getDb();
  const id = uuidv4();
  const ts = now();
  await db.runAsync(
    'INSERT INTO trip_participants (id, trip_id, name, is_self, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, input.trip_id, input.name, input.is_self ?? 0, ts]
  );
  return getParticipantById(id) as Promise<TripParticipant>;
}

export async function getParticipantById(id: string): Promise<TripParticipant | null> {
  const db = await getDb();
  return db.getFirstAsync<TripParticipant>(
    'SELECT * FROM trip_participants WHERE id = ?',
    [id]
  );
}

export async function getTripParticipants(tripId: string): Promise<TripParticipant[]> {
  const db = await getDb();
  return db.getAllAsync<TripParticipant>(
    'SELECT * FROM trip_participants WHERE trip_id = ? ORDER BY is_self DESC, created_at ASC',
    [tripId]
  );
}

export async function deleteParticipant(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM trip_participants WHERE id = ?', [id]);
}

// ─── Trip Expenses ────────────────────────────────────────────────────────────

export async function createTripExpense(input: CreateTripExpenseInput): Promise<TripExpense> {
  const db = await getDb();
  const id = uuidv4();
  const ts = now();
  await db.runAsync(
    `INSERT INTO trip_expenses
       (id, trip_id, paid_by_participant_id, category_id, amount, description,
        split_type, expense_date, linked_transaction_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.trip_id,
      input.paid_by_participant_id,
      input.category_id ?? null,
      input.amount,
      input.description ?? null,
      input.split_type ?? 'equal',
      input.expense_date,
      input.linked_transaction_id ?? null,
      ts,
    ]
  );
  return getTripExpenseById(id) as Promise<TripExpense>;
}

export async function getTripExpenseById(id: string): Promise<TripExpense | null> {
  const db = await getDb();
  return db.getFirstAsync<TripExpense>('SELECT * FROM trip_expenses WHERE id = ?', [id]);
}

export async function getTripExpenses(tripId: string): Promise<TripExpense[]> {
  const db = await getDb();
  return db.getAllAsync<TripExpense>(
    'SELECT * FROM trip_expenses WHERE trip_id = ? ORDER BY expense_date DESC, created_at DESC',
    [tripId]
  );
}

export async function deleteTripExpense(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM trip_expenses WHERE id = ?', [id]);
}

// ─── Splits ───────────────────────────────────────────────────────────────────

export async function createExpenseSplit(input: CreateSplitInput): Promise<TripExpenseSplit> {
  const db = await getDb();
  const id = uuidv4();
  await db.runAsync(
    `INSERT INTO trip_expense_splits (id, trip_expense_id, participant_id, share_amount, is_excluded)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.trip_expense_id, input.participant_id, input.share_amount, input.is_excluded ?? 0]
  );
  return getSplitById(id) as Promise<TripExpenseSplit>;
}

export async function getSplitById(id: string): Promise<TripExpenseSplit | null> {
  const db = await getDb();
  return db.getFirstAsync<TripExpenseSplit>(
    'SELECT * FROM trip_expense_splits WHERE id = ?',
    [id]
  );
}

export async function getExpenseSplits(tripExpenseId: string): Promise<TripExpenseSplit[]> {
  const db = await getDb();
  return db.getAllAsync<TripExpenseSplit>(
    'SELECT * FROM trip_expense_splits WHERE trip_expense_id = ?',
    [tripExpenseId]
  );
}

// Replace all splits for an expense (used when editing)
export async function replaceSplits(tripExpenseId: string, splits: Omit<CreateSplitInput, 'trip_expense_id'>[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM trip_expense_splits WHERE trip_expense_id = ?', [tripExpenseId]);
    for (const s of splits) {
      const id = uuidv4();
      await db.runAsync(
        `INSERT INTO trip_expense_splits (id, trip_expense_id, participant_id, share_amount, is_excluded)
         VALUES (?, ?, ?, ?, ?)`,
        [id, tripExpenseId, s.participant_id, s.share_amount, s.is_excluded ?? 0]
      );
    }
  });
}

// ─── Settlement calculation ───────────────────────────────────────────────────

export async function getTripSettlement(tripId: string): Promise<Settlement[]> {
  const db = await getDb();

  const participants = await getTripParticipants(tripId);
  const expenses = await getTripExpenses(tripId);

  // net[participantId] = total paid - total owed
  const net: Record<string, number> = {};
  participants.forEach(p => { net[p.id] = 0; });

  for (const expense of expenses) {
    net[expense.paid_by_participant_id] = (net[expense.paid_by_participant_id] ?? 0) + expense.amount;

    const splits = await db.getAllAsync<TripExpenseSplit>(
      'SELECT * FROM trip_expense_splits WHERE trip_expense_id = ? AND is_excluded = 0',
      [expense.id]
    );
    for (const split of splits) {
      net[split.participant_id] = (net[split.participant_id] ?? 0) - split.share_amount;
    }
  }

  const nameMap: Record<string, string> = {};
  participants.forEach(p => { nameMap[p.id] = p.name; });

  // Greedy debt-simplification
  type Entry = { id: string; balance: number };
  const creditors: Entry[] = participants.filter(p => (net[p.id] ?? 0) > 0).map(p => ({ id: p.id, balance: net[p.id] }));
  const debtors: Entry[] = participants.filter(p => (net[p.id] ?? 0) < 0).map(p => ({ id: p.id, balance: -net[p.id] }));

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].balance, creditors[j].balance);
    if (amount > 0) {
      settlements.push({
        from_id: debtors[i].id,
        from_name: nameMap[debtors[i].id] ?? '',
        to_id: creditors[j].id,
        to_name: nameMap[creditors[j].id] ?? '',
        amount,
      });
    }
    debtors[i].balance -= amount;
    creditors[j].balance -= amount;
    if (debtors[i].balance <= 0) i++;
    if (creditors[j].balance <= 0) j++;
  }

  return settlements;
}

export async function getTripTotal(tripId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(amount) AS total FROM trip_expenses WHERE trip_id = ?',
    [tripId]
  );
  return row?.total ?? 0;
}
