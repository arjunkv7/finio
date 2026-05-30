import { v4 as uuidv4 } from 'uuid';
import { SQLiteBindValue } from 'expo-sqlite';
import { getDb } from '../database';
import {
  SavingsGoal,
  SavingsContribution,
  CreateSavingsGoalInput,
  UpdateSavingsGoalInput,
  CreateContributionInput,
} from '../../types/db';

const now = () => new Date().toISOString();

// ─── Goals ───────────────────────────────────────────────────────────────────

export async function createSavingsGoal(input: CreateSavingsGoalInput): Promise<SavingsGoal> {
  const db = await getDb();
  const id = uuidv4();
  const ts = now();
  await db.runAsync(
    `INSERT INTO savings_goals
       (id, name, icon, color, target_amount, target_date, is_completed, is_deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    [
      id,
      input.name,
      input.icon ?? null,
      input.color ?? null,
      input.target_amount,
      input.target_date ?? null,
      ts,
      ts,
    ]
  );
  return getSavingsGoalById(id) as Promise<SavingsGoal>;
}

export async function getSavingsGoalById(id: string): Promise<SavingsGoal | null> {
  const db = await getDb();
  return db.getFirstAsync<SavingsGoal>(
    'SELECT * FROM savings_goals WHERE id = ? AND is_deleted = 0',
    [id]
  );
}

export async function getAllSavingsGoals(): Promise<SavingsGoal[]> {
  const db = await getDb();
  return db.getAllAsync<SavingsGoal>(
    'SELECT * FROM savings_goals WHERE is_deleted = 0 ORDER BY created_at DESC'
  );
}

export async function updateSavingsGoal(
  id: string,
  input: UpdateSavingsGoalInput
): Promise<SavingsGoal | null> {
  const db = await getDb();
  const fields = { ...input } as Record<string, SQLiteBindValue>;
  const keys = Object.keys(fields);
  if (keys.length === 0) return getSavingsGoalById(id);
  const ts = now();
  const setClause = [...keys.map(k => `${k} = ?`), 'updated_at = ?'].join(', ');
  await db.runAsync(
    `UPDATE savings_goals SET ${setClause} WHERE id = ? AND is_deleted = 0`,
    [...Object.values(fields), ts, id]
  );
  return getSavingsGoalById(id);
}

export async function deleteSavingsGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE savings_goals SET is_deleted = 1, updated_at = ? WHERE id = ?',
    [now(), id]
  );
}

// ─── Contributions ───────────────────────────────────────────────────────────

export async function addContribution(input: CreateContributionInput): Promise<SavingsContribution> {
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
         VALUES (?, 'transfer', ?, ?, NULL, NULL, 'Savings contribution', NULL, ?, NULL, NULL, 0, NULL, NULL, 'savings', 0, ?, ?)`,
        [txId, input.amount, input.account_id, input.contribution_date, ts, ts]
      );
      linkedTransactionId = txId;
    }

    await db.runAsync(
      `INSERT INTO savings_contributions
         (id, goal_id, amount, notes, contribution_date, account_id, linked_transaction_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.goal_id, input.amount, input.notes ?? null, input.contribution_date,
       input.account_id ?? null, linkedTransactionId, ts]
    );
  });

  // Auto-mark goal complete if target reached (outside transaction for clean reads)
  const total = await getTotalContributed(input.goal_id);
  const goal = await getSavingsGoalById(input.goal_id);
  if (goal && total >= goal.target_amount && !goal.is_completed) {
    await db.runAsync(
      'UPDATE savings_goals SET is_completed = 1, updated_at = ? WHERE id = ?',
      [now(), input.goal_id]
    );
  }

  return getContributionById(id) as Promise<SavingsContribution>;
}

export async function getContributionById(id: string): Promise<SavingsContribution | null> {
  const db = await getDb();
  return db.getFirstAsync<SavingsContribution>(
    'SELECT * FROM savings_contributions WHERE id = ?',
    [id]
  );
}

export async function getContributionsByGoal(goalId: string): Promise<SavingsContribution[]> {
  const db = await getDb();
  return db.getAllAsync<SavingsContribution>(
    'SELECT * FROM savings_contributions WHERE goal_id = ? ORDER BY contribution_date DESC',
    [goalId]
  );
}

export async function getTotalContributed(goalId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(amount) AS total FROM savings_contributions WHERE goal_id = ?',
    [goalId]
  );
  return row?.total ?? 0;
}

export async function deleteContribution(id: string): Promise<void> {
  const db = await getDb();

  const contrib = await db.getFirstAsync<{ linked_transaction_id: string | null }>(
    'SELECT linked_transaction_id FROM savings_contributions WHERE id = ?',
    [id]
  );

  await db.withTransactionAsync(async () => {
    // Revert account balance by soft-deleting the linked expense transaction
    if (contrib?.linked_transaction_id) {
      await db.runAsync(
        'UPDATE transactions SET is_deleted = 1, updated_at = ? WHERE id = ? AND is_deleted = 0',
        [now(), contrib.linked_transaction_id]
      );
    }
    await db.runAsync('DELETE FROM savings_contributions WHERE id = ?', [id]);
  });
}

// Returns goal with live progress fields
export async function getSavingsGoalProgress(goalId: string) {
  const goal = await getSavingsGoalById(goalId);
  if (!goal) return null;
  const contributed = await getTotalContributed(goalId);
  const remaining = Math.max(0, goal.target_amount - contributed);
  const percent = goal.target_amount > 0
    ? Math.min(100, Math.round((contributed / goal.target_amount) * 100))
    : 0;

  let daysRemaining: number | null = null;
  if (goal.target_date) {
    const diff = new Date(goal.target_date).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(diff / 86_400_000));
  }

  return { ...goal, contributed, remaining, percent, daysRemaining };
}
