import { v4 as uuidv4 } from 'uuid';
import { SQLiteBindValue } from 'expo-sqlite';
import { getDb } from '../database';
import {
  Budget,
  CreateBudgetInput,
  UpdateBudgetInput,
  BudgetProgress,
} from '../../types/db';

const now = () => new Date().toISOString();

export async function createBudget(input: CreateBudgetInput): Promise<Budget> {
  const db = await getDb();
  const id = uuidv4();
  const ts = now();
  await db.runAsync(
    `INSERT INTO budgets (id, category_id, monthly_limit, alert_at_percent, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [id, input.category_id, input.monthly_limit, input.alert_at_percent ?? 80, ts, ts]
  );
  return getBudgetById(id) as Promise<Budget>;
}

export async function getBudgetById(id: string): Promise<Budget | null> {
  const db = await getDb();
  return db.getFirstAsync<Budget>('SELECT * FROM budgets WHERE id = ?', [id]);
}

export async function getAllBudgets(): Promise<Budget[]> {
  const db = await getDb();
  return db.getAllAsync<Budget>(
    'SELECT * FROM budgets WHERE is_active = 1 ORDER BY created_at DESC'
  );
}

export async function getBudgetByCategory(categoryId: string): Promise<Budget | null> {
  const db = await getDb();
  return db.getFirstAsync<Budget>(
    'SELECT * FROM budgets WHERE category_id = ? AND is_active = 1',
    [categoryId]
  );
}

export async function updateBudget(id: string, input: UpdateBudgetInput): Promise<Budget | null> {
  const db = await getDb();
  const fields = { ...input } as Record<string, SQLiteBindValue>;
  const keys = Object.keys(fields);
  if (keys.length === 0) return getBudgetById(id);
  const ts = now();
  const setClause = [...keys.map(k => `${k} = ?`), 'updated_at = ?'].join(', ');
  await db.runAsync(
    `UPDATE budgets SET ${setClause} WHERE id = ?`,
    [...Object.values(fields), ts, id]
  );
  return getBudgetById(id);
}

export async function deleteBudget(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM budgets WHERE id = ?', [id]);
}

export async function getBudgetProgress(
  categoryId: string,
  year: number,
  month: number
): Promise<BudgetProgress | null> {
  const db = await getDb();
  const budget = await getBudgetByCategory(categoryId);
  if (!budget) return null;

  const pad = String(month).padStart(2, '0');
  const start = `${year}-${pad}-01`;
  const end = `${year}-${pad}-31`;

  const spendRow = await db.getFirstAsync<{ spent: number | null }>(
    `SELECT SUM(amount) AS spent
     FROM transactions
     WHERE category_id = ?
       AND transaction_date BETWEEN ? AND ?
       AND type = 'expense'
       AND is_deleted = 0`,
    [categoryId, start, end]
  );

  const catRow = await db.getFirstAsync<{ name: string }>(
    'SELECT name FROM categories WHERE id = ?',
    [categoryId]
  );

  const spent = spendRow?.spent ?? 0;
  const limit = budget.monthly_limit;
  const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;

  return {
    budget,
    category_name: catRow?.name ?? '',
    spent,
    limit,
    percent,
  };
}

// All active budgets with progress for a given month
export async function getAllBudgetProgress(year: number, month: number): Promise<BudgetProgress[]> {
  const budgets = await getAllBudgets();
  const results = await Promise.all(
    budgets.map(b => getBudgetProgress(b.category_id, year, month))
  );
  return results.filter((r): r is BudgetProgress => r !== null);
}
