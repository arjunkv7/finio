import { v4 as uuidv4 } from 'uuid';
import { SQLiteBindValue } from 'expo-sqlite';
import { getDb } from '../database';
import {
  Account,
  CreateAccountInput,
  UpdateAccountInput,
} from '../../types/db';

const now = () => new Date().toISOString();

export async function createAccount(input: CreateAccountInput): Promise<Account> {
  const db = await getDb();
  const id = uuidv4();
  const ts = now();
  await db.runAsync(
    `INSERT INTO accounts (id, name, type, icon, color, opening_balance, is_archived, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      id,
      input.name,
      input.type,
      input.icon ?? null,
      input.color ?? null,
      input.opening_balance ?? 0,
      input.sort_order ?? 0,
      ts,
      ts,
    ]
  );
  return getAccountById(id) as Promise<Account>;
}

export async function getAccountById(id: string): Promise<Account | null> {
  const db = await getDb();
  return db.getFirstAsync<Account>('SELECT * FROM accounts WHERE id = ?', [id]);
}

export async function getAllAccounts(): Promise<Account[]> {
  const db = await getDb();
  return db.getAllAsync<Account>(
    'SELECT * FROM accounts ORDER BY sort_order ASC, created_at ASC'
  );
}

export async function getActiveAccounts(): Promise<Account[]> {
  const db = await getDb();
  return db.getAllAsync<Account>(
    'SELECT * FROM accounts WHERE is_archived = 0 ORDER BY sort_order ASC, created_at ASC'
  );
}

export async function updateAccount(id: string, input: UpdateAccountInput): Promise<Account | null> {
  const db = await getDb();
  const fields = { ...input } as Record<string, SQLiteBindValue>;
  const keys = Object.keys(fields);
  if (keys.length === 0) return getAccountById(id);
  const ts = now();
  const setClause = [...keys.map(k => `${k} = ?`), 'updated_at = ?'].join(', ');
  await db.runAsync(
    `UPDATE accounts SET ${setClause} WHERE id = ?`,
    [...Object.values(fields), ts, id]
  );
  return getAccountById(id);
}

export async function archiveAccount(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE accounts SET is_archived = 1, updated_at = ? WHERE id = ?',
    [now(), id]
  );
}

export async function deleteAccount(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM accounts WHERE id = ?', [id]);
}

// Returns live balance = opening_balance + sum of all non-deleted transactions
export async function getAccountBalance(accountId: string): Promise<number> {
  const db = await getDb();

  const account = await db.getFirstAsync<{ opening_balance: number }>(
    'SELECT opening_balance FROM accounts WHERE id = ?',
    [accountId]
  );
  if (!account) return 0;

  const row = await db.getFirstAsync<{ delta: number }>(
    `SELECT SUM(
       CASE
         WHEN type = 'income'                                   THEN  amount
         WHEN type = 'expense'                                  THEN -amount
         WHEN type = 'transfer' AND account_id    = ?           THEN -amount
         WHEN type = 'transfer' AND to_account_id = ?           THEN  amount
         ELSE 0
       END
     ) AS delta
     FROM transactions
     WHERE (account_id = ? OR to_account_id = ?) AND is_deleted = 0`,
    [accountId, accountId, accountId, accountId]
  );

  return account.opening_balance + (row?.delta ?? 0);
}

// Returns balances for all active accounts in one call
export async function getAllAccountBalances(): Promise<{ id: string; name: string; balance: number }[]> {
  const accounts = await getActiveAccounts();
  return Promise.all(
    accounts.map(async a => ({
      id: a.id,
      name: a.name,
      balance: await getAccountBalance(a.id),
    }))
  );
}
