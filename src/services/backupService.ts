import { getDb } from '../db/database';

type BackupPayload = {
  version: number;
  created_at: string;
  accounts: unknown[];
  categories: unknown[];
  transactions: unknown[];
  recurring_transactions: unknown[];
  savings_goals: unknown[];
  savings_contributions: unknown[];
  investments: unknown[];
  investment_contributions: unknown[];
  budgets: unknown[];
  trips: unknown[];
  trip_participants: unknown[];
  trip_expenses: unknown[];
  trip_expense_splits: unknown[];
};

export async function exportAllData(): Promise<string> {
  const db = await getDb();
  const [
    accounts, categories, transactions, recurringTransactions,
    savingsGoals, savingsContributions, investments, investmentContributions,
    budgets, trips, tripParticipants, tripExpenses, tripExpenseSplits,
  ] = await Promise.all([
    db.getAllAsync('SELECT * FROM accounts WHERE is_archived = 0'),
    db.getAllAsync('SELECT * FROM categories WHERE is_deleted = 0'),
    db.getAllAsync('SELECT * FROM transactions WHERE is_deleted = 0'),
    db.getAllAsync('SELECT * FROM recurring_transactions WHERE is_active = 1'),
    db.getAllAsync('SELECT * FROM savings_goals WHERE is_deleted = 0'),
    db.getAllAsync('SELECT * FROM savings_contributions'),
    db.getAllAsync('SELECT * FROM investments WHERE is_deleted = 0'),
    db.getAllAsync('SELECT * FROM investment_contributions'),
    db.getAllAsync('SELECT * FROM budgets WHERE is_active = 1'),
    db.getAllAsync('SELECT * FROM trips WHERE is_deleted = 0'),
    db.getAllAsync('SELECT * FROM trip_participants'),
    db.getAllAsync('SELECT * FROM trip_expenses'),
    db.getAllAsync('SELECT * FROM trip_expense_splits'),
  ]);

  const payload: BackupPayload = {
    version: 1,
    created_at: new Date().toISOString(),
    accounts, categories, transactions,
    recurring_transactions: recurringTransactions,
    savings_goals: savingsGoals,
    savings_contributions: savingsContributions,
    investments,
    investment_contributions: investmentContributions,
    budgets, trips,
    trip_participants: tripParticipants,
    trip_expenses: tripExpenses,
    trip_expense_splits: tripExpenseSplits,
  };
  return JSON.stringify(payload);
}

export async function importBackupData(jsonString: string): Promise<void> {
  const data: BackupPayload = JSON.parse(jsonString);
  if (data.version !== 1) throw new Error('Unsupported backup version');

  const db = await getDb();

  await db.withTransactionAsync(async () => {
    // Delete in child-before-parent order (FK constraints)
    await db.runAsync('DELETE FROM trip_expense_splits');
    await db.runAsync('DELETE FROM trip_expenses');
    await db.runAsync('DELETE FROM trip_participants');
    await db.runAsync('DELETE FROM trips');
    await db.runAsync('DELETE FROM sms_transactions');
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM recurring_transactions');
    await db.runAsync('DELETE FROM budgets');
    await db.runAsync('DELETE FROM savings_contributions');
    await db.runAsync('DELETE FROM savings_goals');
    await db.runAsync('DELETE FROM investment_contributions');
    await db.runAsync('DELETE FROM investments');
    await db.runAsync('DELETE FROM accounts');
    await db.runAsync('DELETE FROM categories WHERE is_system = 0');

    const insertRows = async (table: string, rows: unknown[]) => {
      for (const row of rows) {
        const r = row as Record<string, unknown>;
        const cols = Object.keys(r);
        const placeholders = cols.map(() => '?').join(', ');
        await db.runAsync(
          `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
          Object.values(r) as (string | number | null)[]
        );
      }
    };

    // Insert in parent-before-child order
    await insertRows('accounts', data.accounts);
    await insertRows('categories', data.categories);
    await insertRows('savings_goals', data.savings_goals);
    await insertRows('investments', data.investments);
    await insertRows('trips', data.trips);
    await insertRows('trip_participants', data.trip_participants);
    await insertRows('transactions', data.transactions);
    await insertRows('savings_contributions', data.savings_contributions);
    await insertRows('investment_contributions', data.investment_contributions);
    await insertRows('recurring_transactions', data.recurring_transactions);
    await insertRows('budgets', data.budgets);
    await insertRows('trip_expenses', data.trip_expenses);
    await insertRows('trip_expense_splits', data.trip_expense_splits);
  });
}
