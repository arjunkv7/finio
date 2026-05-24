import { v4 as uuidv4 } from 'uuid';
import { SQLiteBindValue } from 'expo-sqlite';
import { getDb } from '../database';
import {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionFilter,
  MonthlySummary,
} from '../../types/db';

const now = () => new Date().toISOString();

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const db = await getDb();
  const id = uuidv4();
  const ts = now();
  await db.runAsync(
    `INSERT INTO transactions
       (id, type, amount, account_id, to_account_id, category_id, description, notes,
        transaction_date, transaction_time, receipt_photo_uri, is_recurring, recurrence_rule, trip_id,
        is_deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      input.type,
      input.amount,
      input.account_id,
      input.to_account_id ?? null,
      input.category_id ?? null,
      input.description ?? null,
      input.notes ?? null,
      input.transaction_date,
      input.transaction_time ?? null,
      input.receipt_photo_uri ?? null,
      input.is_recurring ?? 0,
      input.recurrence_rule ?? null,
      input.trip_id ?? null,
      ts,
      ts,
    ]
  );
  return getTransactionById(id) as Promise<Transaction>;
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const db = await getDb();
  return db.getFirstAsync<Transaction>(
    'SELECT * FROM transactions WHERE id = ? AND is_deleted = 0',
    [id]
  );
}

export async function getTransactions(filter?: TransactionFilter): Promise<Transaction[]> {
  const db = await getDb();
  const conditions: string[] = ['is_deleted = 0'];
  const params: (string | number)[] = [];

  if (filter?.type) {
    conditions.push('type = ?');
    params.push(filter.type);
  }
  if (filter?.account_id) {
    conditions.push('(account_id = ? OR to_account_id = ?)');
    params.push(filter.account_id, filter.account_id);
  }
  if (filter?.category_id) {
    conditions.push('category_id = ?');
    params.push(filter.category_id);
  }
  if (filter?.start_date) {
    conditions.push('transaction_date >= ?');
    params.push(filter.start_date);
  }
  if (filter?.end_date) {
    conditions.push('transaction_date <= ?');
    params.push(filter.end_date);
  }
  if (filter?.trip_id) {
    conditions.push('trip_id = ?');
    params.push(filter.trip_id);
  }
  if (filter?.search) {
    conditions.push('(description LIKE ? OR notes LIKE ?)');
    params.push(`%${filter.search}%`, `%${filter.search}%`);
  }

  const where = conditions.join(' AND ');
  return db.getAllAsync<Transaction>(
    `SELECT * FROM transactions WHERE ${where} ORDER BY transaction_date DESC, created_at DESC`,
    params
  );
}

export async function getTransactionsPaginated(
  filter: TransactionFilter = {},
  limit = 30,
  offset = 0
): Promise<Transaction[]> {
  const db = await getDb();
  const conditions: string[] = ['is_deleted = 0'];
  const params: (string | number)[] = [];

  if (filter.type) { conditions.push('type = ?'); params.push(filter.type); }
  if (filter.account_id) {
    conditions.push('(account_id = ? OR to_account_id = ?)');
    params.push(filter.account_id, filter.account_id);
  }
  if (filter.category_id) { conditions.push('category_id = ?'); params.push(filter.category_id); }
  if (filter.start_date) { conditions.push('transaction_date >= ?'); params.push(filter.start_date); }
  if (filter.end_date) { conditions.push('transaction_date <= ?'); params.push(filter.end_date); }
  if (filter.trip_id) { conditions.push('trip_id = ?'); params.push(filter.trip_id); }
  if (filter.search) {
    conditions.push('(description LIKE ? OR notes LIKE ?)');
    params.push(`%${filter.search}%`, `%${filter.search}%`);
  }

  const where = conditions.join(' AND ');
  return db.getAllAsync<Transaction>(
    `SELECT * FROM transactions WHERE ${where}
     ORDER BY transaction_date DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
}

export async function getRecentTransactions(limit = 20): Promise<Transaction[]> {
  const db = await getDb();
  return db.getAllAsync<Transaction>(
    `SELECT * FROM transactions WHERE is_deleted = 0
     ORDER BY transaction_date DESC, created_at DESC LIMIT ?`,
    [limit]
  );
}

export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput
): Promise<Transaction | null> {
  const db = await getDb();
  const fields = { ...input } as Record<string, SQLiteBindValue>;
  const keys = Object.keys(fields);
  if (keys.length === 0) return getTransactionById(id);
  const ts = now();
  const setClause = [...keys.map(k => `${k} = ?`), 'updated_at = ?'].join(', ');
  await db.runAsync(
    `UPDATE transactions SET ${setClause} WHERE id = ? AND is_deleted = 0`,
    [...Object.values(fields), ts, id]
  );
  return getTransactionById(id);
}

// Soft delete
export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE transactions SET is_deleted = 1, updated_at = ? WHERE id = ?',
    [now(), id]
  );
}

// ─── Aggregates ──────────────────────────────────────────────────────────────

export async function getMonthlySummary(year: number, month: number): Promise<MonthlySummary> {
  const db = await getDb();
  const pad = String(month).padStart(2, '0');
  const start = `${year}-${pad}-01`;
  const end = `${year}-${pad}-31`;

  const row = await db.getFirstAsync<{ income: number | null; expenses: number | null }>(
    `SELECT
       SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS income,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
     FROM transactions
     WHERE transaction_date BETWEEN ? AND ?
       AND is_deleted = 0
       AND type IN ('income', 'expense')`,
    [start, end]
  );

  const income = row?.income ?? 0;
  const expenses = row?.expenses ?? 0;
  return { income, expenses, net: income - expenses };
}

export async function getCategorySpend(
  year: number,
  month: number
): Promise<{ category_id: string; total: number }[]> {
  const db = await getDb();
  const pad = String(month).padStart(2, '0');
  const start = `${year}-${pad}-01`;
  const end = `${year}-${pad}-31`;
  return db.getAllAsync(
    `SELECT category_id, SUM(amount) AS total
     FROM transactions
     WHERE type = 'expense'
       AND transaction_date BETWEEN ? AND ?
       AND is_deleted = 0
       AND category_id IS NOT NULL
     GROUP BY category_id
     ORDER BY total DESC`,
    [start, end]
  );
}

// N months ending at a specific (year, month) — for Reports screen trend chart
export async function getMonthlyTrendUpTo(
  year: number,
  month: number,
  count = 6
): Promise<{ year: number; month: number; income: number; expenses: number }[]> {
  const db = await getDb();
  // end = last day of selected month; start = first day of (count months earlier)
  const endObj = new Date(year, month, 0); // day 0 of next month = last day of this month
  const startObj = new Date(year, month - count, 1);
  const end = endObj.toISOString().slice(0, 10);
  const start = startObj.toISOString().slice(0, 10);
  return db.getAllAsync(
    `SELECT
       CAST(strftime('%Y', transaction_date) AS INTEGER) AS year,
       CAST(strftime('%m', transaction_date) AS INTEGER) AS month,
       SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS income,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
     FROM transactions
     WHERE is_deleted = 0
       AND type IN ('income', 'expense')
       AND transaction_date >= ?
       AND transaction_date <= ?
     GROUP BY year, month
     ORDER BY year ASC, month ASC`,
    [start, end]
  );
}

// All months with activity for a given calendar year — for Annual Report table
export async function getAnnualSummary(
  year: number
): Promise<{ month: number; income: number; expenses: number }[]> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT
       CAST(strftime('%m', transaction_date) AS INTEGER) AS month,
       SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS income,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
     FROM transactions
     WHERE is_deleted = 0
       AND type IN ('income', 'expense')
       AND transaction_date >= ?
       AND transaction_date < ?
     GROUP BY month
     ORDER BY month ASC`,
    [`${year}-01-01`, `${year + 1}-01-01`]
  );
}

// Last N months income vs expense for trend chart
export async function getMonthlyTrend(
  months = 6
): Promise<{ year: number; month: number; income: number; expenses: number }[]> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT
       CAST(strftime('%Y', transaction_date) AS INTEGER) AS year,
       CAST(strftime('%m', transaction_date) AS INTEGER) AS month,
       SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS income,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
     FROM transactions
     WHERE is_deleted = 0
       AND type IN ('income', 'expense')
       AND transaction_date >= date('now', ? || ' months')
     GROUP BY year, month
     ORDER BY year ASC, month ASC`,
    [`-${months}`]
  );
}
