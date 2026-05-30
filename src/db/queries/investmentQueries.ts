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
  let linkedTransactionId: string | null = null;

  await db.withTransactionAsync(async () => {
    // If an account is linked, deduct the amount as an expense transaction
    if (input.account_id) {
      const txId = uuidv4();
      await db.runAsync(
        `INSERT INTO transactions
           (id, type, amount, account_id, to_account_id, category_id, description, notes,
            transaction_date, transaction_time, receipt_photo_uri, is_recurring, recurrence_rule,
            trip_id, tag, is_deleted, created_at, updated_at)
         VALUES (?, 'transfer', ?, ?, NULL, NULL, ?, NULL, ?, NULL, NULL, 0, NULL, NULL, 'investment', 0, ?, ?)`,
        [txId, input.amount_invested, input.account_id, `Investment: ${input.asset_name}`, input.investment_date, ts, ts]
      );
      linkedTransactionId = txId;
    }

    await db.runAsync(
      `INSERT INTO investments
         (id, asset_name, asset_type, amount_invested, investment_date, notes,
          account_id, linked_transaction_id, is_deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [id, input.asset_name, input.asset_type, input.amount_invested, input.investment_date,
       input.notes ?? null, input.account_id ?? null, linkedTransactionId, ts, ts]
    );
  });

  return getInvestmentById(id) as Promise<Investment>;
}

export async function getInvestmentById(id: string): Promise<Investment | null> {
  const db = await getDb();
  return db.getFirstAsync<Investment>(
    'SELECT * FROM investments WHERE id = ? AND is_deleted = 0',
    [id]
  );
}

export interface InvestmentWithTotal extends Investment {
  total_amount: number;
}

export async function getAllInvestments(): Promise<InvestmentWithTotal[]> {
  const db = await getDb();
  return db.getAllAsync<InvestmentWithTotal>(`
    SELECT i.*,
      i.amount_invested + COALESCE((
        SELECT SUM(c.amount) FROM investment_contributions c WHERE c.investment_id = i.id
      ), 0) AS total_amount
    FROM investments i
    WHERE i.is_deleted = 0
    ORDER BY i.investment_date DESC
  `);
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

  const investment = await db.getFirstAsync<{ linked_transaction_id: string | null }>(
    'SELECT linked_transaction_id FROM investments WHERE id = ? AND is_deleted = 0',
    [id]
  );

  await db.withTransactionAsync(async () => {
    // Revert account balance by soft-deleting the linked expense transaction
    if (investment?.linked_transaction_id) {
      await db.runAsync(
        'UPDATE transactions SET is_deleted = 1, updated_at = ? WHERE id = ? AND is_deleted = 0',
        [now(), investment.linked_transaction_id]
      );
    }
    await db.runAsync(
      'UPDATE investments SET is_deleted = 1, updated_at = ? WHERE id = ?',
      [now(), id]
    );
  });
}

export async function getTotalInvested(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number | null }>(`
    SELECT
      (SELECT COALESCE(SUM(amount_invested), 0) FROM investments WHERE is_deleted = 0) +
      (SELECT COALESCE(SUM(c.amount), 0)
       FROM investment_contributions c
       JOIN investments i ON c.investment_id = i.id
       WHERE i.is_deleted = 0) AS total
  `);
  return row?.total ?? 0;
}

export async function getInvestmentSummaryByType(): Promise<{ asset_type: AssetType; total: number }[]> {
  const db = await getDb();
  return db.getAllAsync(`
    SELECT i.asset_type,
      SUM(i.amount_invested + COALESCE((
        SELECT SUM(c.amount) FROM investment_contributions c WHERE c.investment_id = i.id
      ), 0)) AS total
    FROM investments i
    WHERE i.is_deleted = 0
    GROUP BY i.asset_type
    ORDER BY total DESC
  `);
}
