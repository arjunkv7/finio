import { v4 as uuidv4 } from 'uuid';
import { SQLiteBindValue } from 'expo-sqlite';
import { getDb } from '../database';
import {
  Investment,
  AssetType,
  CreateInvestmentInput,
  UpdateInvestmentInput,
} from '../../types/db';

const now = () => new Date().toISOString();

export async function createInvestment(input: CreateInvestmentInput): Promise<Investment> {
  const db = await getDb();
  const id = uuidv4();
  const ts = now();
  await db.runAsync(
    `INSERT INTO investments
       (id, asset_name, asset_type, amount_invested, investment_date, notes, is_deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [id, input.asset_name, input.asset_type, input.amount_invested, input.investment_date, input.notes ?? null, ts, ts]
  );
  return getInvestmentById(id) as Promise<Investment>;
}

export async function getInvestmentById(id: string): Promise<Investment | null> {
  const db = await getDb();
  return db.getFirstAsync<Investment>(
    'SELECT * FROM investments WHERE id = ? AND is_deleted = 0',
    [id]
  );
}

export async function getAllInvestments(): Promise<Investment[]> {
  const db = await getDb();
  return db.getAllAsync<Investment>(
    'SELECT * FROM investments WHERE is_deleted = 0 ORDER BY investment_date DESC'
  );
}

export async function getInvestmentsByType(assetType: AssetType): Promise<Investment[]> {
  const db = await getDb();
  return db.getAllAsync<Investment>(
    'SELECT * FROM investments WHERE asset_type = ? AND is_deleted = 0 ORDER BY investment_date DESC',
    [assetType]
  );
}

export async function updateInvestment(
  id: string,
  input: UpdateInvestmentInput
): Promise<Investment | null> {
  const db = await getDb();
  const fields = { ...input } as Record<string, SQLiteBindValue>;
  const keys = Object.keys(fields);
  if (keys.length === 0) return getInvestmentById(id);
  const ts = now();
  const setClause = [...keys.map(k => `${k} = ?`), 'updated_at = ?'].join(', ');
  await db.runAsync(
    `UPDATE investments SET ${setClause} WHERE id = ? AND is_deleted = 0`,
    [...Object.values(fields), ts, id]
  );
  return getInvestmentById(id);
}

export async function deleteInvestment(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE investments SET is_deleted = 1, updated_at = ? WHERE id = ?',
    [now(), id]
  );
}

export async function getTotalInvested(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(amount_invested) AS total FROM investments WHERE is_deleted = 0'
  );
  return row?.total ?? 0;
}

// Breakdown by asset type
export async function getInvestmentSummaryByType(): Promise<{ asset_type: AssetType; total: number }[]> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT asset_type, SUM(amount_invested) AS total
     FROM investments
     WHERE is_deleted = 0
     GROUP BY asset_type
     ORDER BY total DESC`
  );
}
