/**
 * HeadlessJS task — runs in the background (app may be closed) whenever
 * SmsReceiver fires. Parses the incoming SMS, auto-creates a transaction,
 * and fires a push notification.
 *
 * Must complete within the 5 s timeout set in SmsHeadlessTaskService.
 */
import * as Notifications from 'expo-notifications';
import { parseSms } from '../utils/smsParser';
import { getDb } from '../db/database';
import { smsFingerprint } from '../services/smsService';
import {
  createSmsTransaction,
  autoCreateSmsTransaction,
  updateLastSmsProcessedAt,
} from '../db/queries/smsTransactionQueries';
import { createNotification } from '../db/queries/notificationQueries';

interface SmsTaskData {
  sender: string;
  body: string;
  timestamp: number; // ms epoch, comes as Double from Kotlin
}

const SmsTransactionTask = async (taskData: SmsTaskData): Promise<void> => {
  const { sender, body, timestamp } = taskData;

  try {
    // Guard: check that the feature is still enabled
    const db = await getDb();
    const row = await db.getFirstAsync<{ sms_auto_detect: number }>(
      'SELECT sms_auto_detect FROM settings WHERE id = 1'
    );
    if (!row || row.sms_auto_detect !== 1) return;

    const parsed = parseSms(sender, body);
    if (!parsed) return;

    const fingerprint = smsFingerprint(sender, body, timestamp);
    const d = new Date(timestamp);

    const smsRec = await createSmsTransaction({
      smsId: fingerprint,
      sender,
      rawBody: body,
      amount: parsed.amount,
      type: parsed.type,
      accountType: parsed.accountType,
      description: parsed.description,
      messageDate: d.toISOString().split('T')[0],
      messageTime: d.toTimeString().slice(0, 5),
    });

    // INSERT OR IGNORE returns null id when fingerprint already existed — skip
    if (!smsRec) return;

    await autoCreateSmsTransaction(smsRec.id);
    await updateLastSmsProcessedAt(new Date().toISOString());

    const amtStr = `₹${(parsed.amount / 100).toFixed(0)}`;
    const typeLabel = parsed.type === 'expense' ? 'Expense' : 'Income';
    const title = `${typeLabel} added: ${amtStr}`;
    const notifBody = parsed.description
      ? `${parsed.description} · Auto-added to Finio`
      : 'Auto-added to Finio · Tap to review';

    await Promise.all([
      Notifications.scheduleNotificationAsync({
        content: { title, body: notifBody },
        trigger: null,
      }),
      createNotification({ type: 'sms_detected', title, body: notifBody }),
    ]);
  } catch (err) {
    console.error('[SmsTask]', err);
  }
};

export default SmsTransactionTask;
