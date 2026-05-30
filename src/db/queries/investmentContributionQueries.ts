import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { InvestmentContribution, CreateInvestmentContributionInput } from '../../types/db';

const now = () => new Date().toISOString();

export async function addInvestmentContribution(
  input: CreateInvestmentContributionInput
): Promise<InvestmentContribution> {
  const db = await getDb();
  const id = uuidv4();
  const ts = now();
  let linkedTransactionId: string | null = null;

  await db.withTransactionAsync(async () => {
    if (input.account_id) {
      const txId = uuidv4();
      // Lookup investment name for the description
      const inv = await db.getFirstAsync<{ asset_name: string }>(
        'SELECT asset_name FROM investments WHERE id = ?',
        [input.investment_id]
      );
      await db.runAsync(
        `INSERT INTO transactions
           (id, type, amount, account_id, to_account_id, category_id, description, notes,
            transaction_date, transaction_time, receipt_photo_uri, is_recurring, recurrence_rule,
            trip_id, tag, is_deleted, created_at, updated_at)
         VALUES (?, 'transfer', ?, ?, NULL, NULL, ?, NULL, ?, NULL, NULL, 0, NULL, NULL, 'investment', 0, ?, ?)`,
        [txId, input.amount, input.account_id, `SIP: ${inv?.asset_name ?? 'Investment'}`, input.contribution_date, ts, ts]
      );
      linkedTransactionId = txId;
    }

    await db.runAsync(
      `INSERT INTO investment_contributions
         (id, investment_id, amount, notes, contribution_date, account_id, linked_transaction_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.investment_id, input.amount, input.notes ?? null, input.contribution_date,
       input.account_id ?? null, linkedTransactionId, ts]
    );
  });

  return db.getFirstAsync<InvestmentContribution>(
    'SELECT * FROM investment_contributions WHERE id = ?', [id]
  ) as Promise<InvestmentContribution>;
}

export async function getContributionsByInvestment(investmentId: string): Promise<InvestmentContribution[]> {
  const db = await getDb();
  return db.getAllAsync<InvestmentContribution>(
    'SELECT * FROM investment_contributions WHERE investment_id = ? ORDER BY contribution_date DESC',
    [investmentId]
  );
}

export async function deleteInvestmentContribution(id: string): Promise<void> {
  const db = await getDb();
  const contrib = await db.getFirstAsync<{ linked_transaction_id: string | null }>(
    'SELECT linked_transaction_id FROM investment_contributions WHERE id = ?',
    [id]
  );
  await db.withTransactionAsync(async () => {
    if (contrib?.linked_transaction_id) {
      await db.runAsync(
        'UPDATE transactions SET is_deleted = 1, updated_at = ? WHERE id = ? AND is_deleted = 0',
        [now(), contrib.linked_transaction_id]
      );
    }
    await db.runAsync('DELETE FROM investment_contributions WHERE id = ?', [id]);
  });
}
