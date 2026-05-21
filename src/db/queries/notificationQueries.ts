import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: string | null;
  is_read: number;
  created_at: string;
}

export interface CreateNotificationInput {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function createNotification(input: CreateNotificationInput): Promise<AppNotification> {
  const db = await getDb();
  const id = uuidv4();
  const ts = new Date().toISOString();
  const dataStr = input.data ? JSON.stringify(input.data) : null;
  await db.runAsync(
    `INSERT INTO notifications (id, type, title, body, data, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [id, input.type, input.title, input.body, dataStr, ts]
  );
  return { id, type: input.type, title: input.title, body: input.body, data: dataStr, is_read: 0, created_at: ts };
}

export async function getUnreadNotifications(): Promise<AppNotification[]> {
  const db = await getDb();
  return db.getAllAsync<AppNotification>(
    'SELECT * FROM notifications WHERE is_read = 0 ORDER BY created_at DESC'
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
}

export async function markAllNotificationsRead(): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE notifications SET is_read = 1');
}
