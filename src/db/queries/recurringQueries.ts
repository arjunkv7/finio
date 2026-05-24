import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import {
  RecurringTransaction,
  CreateRecurringTransactionInput,
  UpdateRecurringTransactionInput,
  RecurrenceFrequency,
} from '../../types/db';

export function getNextRunDate(current: string, frequency: RecurrenceFrequency): string {
  const [y, m, d] = current.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  switch (frequency) {
    case 'daily':   date.setDate(date.getDate() + 1); break;
    case 'weekly':  date.setDate(date.getDate() + 7); break;
    case 'monthly': date.setMonth(date.getMonth() + 1); break;
    case 'yearly':  date.setFullYear(date.getFullYear() + 1); break;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function createRecurringTransaction(
  input: CreateRecurringTransactionInput,
): Promise<RecurringTransaction> {
  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const timeOfDay = input.time_of_day ?? '09:00';

  await db.runAsync(
    `INSERT INTO recurring_transactions
       (id, type, amount, account_id, category_id, description, notes,
        frequency, next_run_date, time_of_day, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id, input.type, input.amount, input.account_id,
      input.category_id ?? null, input.description ?? null, input.notes ?? null,
      input.frequency, input.start_date, timeOfDay, now, now,
    ],
  );

  return db.getFirstAsync<RecurringTransaction>(
    'SELECT * FROM recurring_transactions WHERE id = ?', [id],
  ) as Promise<RecurringTransaction>;
}

export async function getRecurringTransactions(): Promise<RecurringTransaction[]> {
  const db = await getDb();
  return db.getAllAsync<RecurringTransaction>(
    'SELECT * FROM recurring_transactions ORDER BY created_at DESC',
  );
}

export async function getRecurringTransactionById(id: string): Promise<RecurringTransaction | null> {
  const db = await getDb();
  return db.getFirstAsync<RecurringTransaction>(
    'SELECT * FROM recurring_transactions WHERE id = ?', [id],
  );
}

export async function updateRecurringTransaction(
  id: string,
  input: UpdateRecurringTransactionInput,
): Promise<RecurringTransaction> {
  const db = await getDb();
  const now = new Date().toISOString();
  const keys = Object.keys(input) as (keyof UpdateRecurringTransactionInput)[];
  if (keys.length > 0) {
    const setClause = [...keys.map(k => `${k} = ?`), 'updated_at = ?'].join(', ');
    const values: (string | number | null)[] = [...keys.map(k => (input[k] as string | number | null) ?? null), now, id];
    await db.runAsync(`UPDATE recurring_transactions SET ${setClause} WHERE id = ?`, values);
  }
  return (await getRecurringTransactionById(id))!;
}

export async function deleteRecurringTransaction(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM recurring_transactions WHERE id = ?', [id]);
}

export async function getDueRecurringTransactions(today: string): Promise<RecurringTransaction[]> {
  const db = await getDb();
  return db.getAllAsync<RecurringTransaction>(
    'SELECT * FROM recurring_transactions WHERE is_active = 1 AND next_run_date <= ? ORDER BY next_run_date ASC',
    [today],
  );
}

export async function advanceNextRunDate(id: string, newDate: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE recurring_transactions SET next_run_date = ?, updated_at = ? WHERE id = ?',
    [newDate, now, id],
  );
}
