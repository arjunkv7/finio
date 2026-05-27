import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { SmsTransaction, CreateSmsTransactionInput } from '../../types/db';

export interface AutoCreatedEntry {
  sms_id: string;
  sms_amount: number;
  sms_type: string;
  sms_description: string | null;
  sms_message_date: string;
  sms_message_time: string;
  tx_id: string;
  tx_type: string;
  tx_amount: number;
  tx_account_id: string;
  tx_category_id: string | null;
  tx_description: string | null;
  tx_notes: string | null;
  tx_transaction_date: string;
  tx_transaction_time: string | null;
  tx_created_at: string;
  tx_updated_at: string;
  account_name: string;
  account_type: string;
}

const now = () => new Date().toISOString();

export async function createSmsTransaction(input: CreateSmsTransactionInput): Promise<SmsTransaction> {
  const db = await getDb();
  const id = uuidv4();
  const ts = now();
  await db.runAsync(
    `INSERT OR IGNORE INTO sms_transactions
       (id, sms_id, sender, raw_body, amount, type, account_type, description,
        message_date, message_time, status, transaction_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?)`,
    [
      id,
      input.smsId ?? null,
      input.sender,
      input.rawBody,
      input.amount,
      input.type,
      input.accountType,
      input.description ?? null,
      input.messageDate,
      input.messageTime,
      ts,
    ]
  );
  return db.getFirstAsync<SmsTransaction>(
    'SELECT * FROM sms_transactions WHERE id = ?',
    [id]
  ) as Promise<SmsTransaction>;
}

export async function getPendingSmsTransactions(): Promise<SmsTransaction[]> {
  const db = await getDb();
  return db.getAllAsync<SmsTransaction>(
    "SELECT * FROM sms_transactions WHERE status = 'pending' ORDER BY message_date DESC, message_time DESC"
  );
}

export async function getPendingSmsCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM sms_transactions WHERE status = 'pending'"
  );
  return row?.count ?? 0;
}

export async function getPendingSmsIds(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ sms_id: string }>(
    "SELECT sms_id FROM sms_transactions WHERE sms_id IS NOT NULL"
  );
  return rows.map(r => r.sms_id);
}

export async function approveSmsTransaction(id: string, transactionId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE sms_transactions SET status = 'approved', transaction_id = ? WHERE id = ?",
    [transactionId, id]
  );
}

export async function dismissSmsTransaction(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE sms_transactions SET status = 'dismissed' WHERE id = ?",
    [id]
  );
}

export async function dismissAllPendingSmsTransactions(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE sms_transactions SET status = 'dismissed' WHERE status = 'pending'"
  );
}

export async function autoCreateSmsTransaction(smsId: string): Promise<string | null> {
  const db = await getDb();
  const sms = await db.getFirstAsync<SmsTransaction>(
    'SELECT * FROM sms_transactions WHERE id = ?', [smsId]
  );
  if (!sms || sms.status !== 'pending') return null;

  // Prefer matching account type; fall back to any non-archived account
  const preferredTypes =
    sms.account_type === 'credit'  ? ['credit', 'bank', 'cash', 'other'] :
    sms.account_type === 'wallet'  ? ['wallet', 'cash', 'bank', 'other'] :
                                     ['bank', 'cash', 'wallet', 'other'];

  let account: { id: string } | null = null;
  for (const type of preferredTypes) {
    account = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM accounts WHERE is_archived = 0 AND type = ? ORDER BY sort_order ASC LIMIT 1',
      [type]
    );
    if (account) break;
  }
  if (!account) {
    account = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM accounts WHERE is_archived = 0 ORDER BY sort_order ASC LIMIT 1'
    );
  }
  if (!account) return null;

  const txId = uuidv4();
  const ts = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO transactions
       (id, type, amount, account_id, to_account_id, category_id, description, notes,
        transaction_date, transaction_time, receipt_photo_uri, is_recurring, recurrence_rule,
        trip_id, is_deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?, NULL, 0, NULL, NULL, 0, ?, ?)`,
    [txId, sms.type, sms.amount, account.id, sms.description ?? null,
     sms.message_date, sms.message_time ?? null, ts, ts]
  );
  await db.runAsync(
    "UPDATE sms_transactions SET status = 'auto_created', transaction_id = ? WHERE id = ?",
    [txId, smsId]
  );
  return txId;
}

export async function getAutoCreatedEntries(): Promise<AutoCreatedEntry[]> {
  const db = await getDb();
  return db.getAllAsync<AutoCreatedEntry>(`
    SELECT
      s.id               AS sms_id,
      s.amount           AS sms_amount,
      s.type             AS sms_type,
      s.description      AS sms_description,
      s.message_date     AS sms_message_date,
      s.message_time     AS sms_message_time,
      t.id               AS tx_id,
      t.type             AS tx_type,
      t.amount           AS tx_amount,
      t.account_id       AS tx_account_id,
      t.category_id      AS tx_category_id,
      t.description      AS tx_description,
      t.notes            AS tx_notes,
      t.transaction_date AS tx_transaction_date,
      t.transaction_time AS tx_transaction_time,
      t.created_at       AS tx_created_at,
      t.updated_at       AS tx_updated_at,
      a.name             AS account_name,
      a.type             AS account_type
    FROM sms_transactions s
    JOIN transactions t ON s.transaction_id = t.id AND t.is_deleted = 0
    JOIN accounts a     ON t.account_id = a.id
    WHERE s.status = 'auto_created'
    ORDER BY s.message_date DESC, s.message_time DESC
  `);
}

export async function markAllAutoCreatedAsApproved(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE sms_transactions SET status = 'approved' WHERE status = 'auto_created'"
  );
}

export async function approveSingleAutoCreatedSmsTransaction(smsId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE sms_transactions SET status = 'approved' WHERE id = ?", [smsId]
  );
}

export async function deleteAutoCreatedSmsTransaction(smsId: string): Promise<void> {
  const db = await getDb();
  const sms = await db.getFirstAsync<{ transaction_id: string | null }>(
    'SELECT transaction_id FROM sms_transactions WHERE id = ?', [smsId]
  );
  if (sms?.transaction_id) {
    const ts = new Date().toISOString();
    await db.runAsync(
      'UPDATE transactions SET is_deleted = 1, updated_at = ? WHERE id = ?',
      [ts, sms.transaction_id]
    );
  }
  await db.runAsync(
    "UPDATE sms_transactions SET status = 'dismissed' WHERE id = ?", [smsId]
  );
}

export async function deleteAllAutoCreatedSmsTransactions(): Promise<void> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; transaction_id: string | null }>(
    "SELECT id, transaction_id FROM sms_transactions WHERE status = 'auto_created'"
  );
  const ts = new Date().toISOString();
  for (const row of rows) {
    if (row.transaction_id) {
      await db.runAsync(
        'UPDATE transactions SET is_deleted = 1, updated_at = ? WHERE id = ?',
        [ts, row.transaction_id]
      );
    }
  }
  await db.runAsync("UPDATE sms_transactions SET status = 'dismissed' WHERE status = 'auto_created'");
}

export async function getLastSmsProcessedAt(): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ sms_last_processed_at: string | null }>(
    'SELECT sms_last_processed_at FROM settings WHERE id = 1'
  );
  return row?.sms_last_processed_at ?? null;
}

export async function updateLastSmsProcessedAt(isoDate: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE settings SET sms_last_processed_at = ? WHERE id = 1',
    [isoDate]
  );
}
