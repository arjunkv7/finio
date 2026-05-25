import { Platform, PermissionsAndroid } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';
import { parseSms } from '../utils/smsParser';
import {
  createSmsTransaction,
  autoCreateSmsTransaction,
  getLastSmsProcessedAt,
  updateLastSmsProcessedAt,
} from '../db/queries/smsTransactionQueries';
import { getDb } from '../db/database';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Stable fingerprint used by BOTH the broadcast path (HeadlessJS) and the
// one-time inbox scan, so the same SMS is never queued twice.
export function smsFingerprint(sender: string, body: string, timestampMs: number): string {
  const minute = Math.floor(timestampMs / 60_000); // round to minute
  return `${sender.toLowerCase()}:${minute}:${body.trim().slice(0, 40)}`;
}

export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: 'SMS Permission',
        message: 'Finio needs SMS access to automatically detect bank transactions and add them for you.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function checkSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
}

function listSmsAsync(filter: object): Promise<string> {
  return new Promise((resolve, reject) => {
    SmsAndroid.list(
      JSON.stringify(filter),
      (err: string) => reject(new Error(err)),
      (_count: number, smsList: string) => resolve(smsList)
    );
  });
}

/**
 * One-time historical scan — only runs when the feature is first enabled (or
 * after install) to catch bank SMS from the past 30 days that arrived before
 * the BroadcastReceiver was registered.
 *
 * The BroadcastReceiver handles all NEW SMS from here on; this function should
 * not be called on every foreground — only on first enable.
 */
export async function initialInboxScan(): Promise<number> {
  if (Platform.OS !== 'android') return 0;

  const hasPermission = await checkSmsPermission();
  if (!hasPermission) return 0;

  // Already scanned before — skip (the broadcast receiver covers new messages)
  const lastProcessedAt = await getLastSmsProcessedAt();
  if (lastProcessedAt) return 0;

  const minDate = Date.now() - THIRTY_DAYS_MS;

  // Collect fingerprints already in the DB to avoid re-inserting anything the
  // broadcast receiver may have already caught
  const db = await getDb();
  const existingRows = await db.getAllAsync<{ sms_id: string }>(
    'SELECT sms_id FROM sms_transactions WHERE sms_id IS NOT NULL'
  );
  const existingFingerprints = new Set(existingRows.map(r => r.sms_id));

  try {
    const smsList = await listSmsAsync({ box: 'inbox', minDate, maxCount: 300 });
    type RawSms = { _id: string; address: string; body: string; date: number };
    const messages: RawSms[] = JSON.parse(smsList);

    let newCount = 0;
    for (const msg of messages) {
      const fingerprint = smsFingerprint(msg.address, msg.body, msg.date);
      if (existingFingerprints.has(fingerprint)) continue;

      const parsed = parseSms(msg.address, msg.body);
      if (!parsed) continue;

      const d = new Date(msg.date);
      const smsRec = await createSmsTransaction({
        smsId: fingerprint,
        sender: msg.address,
        rawBody: msg.body,
        amount: parsed.amount,
        type: parsed.type,
        accountType: parsed.accountType,
        description: parsed.description,
        messageDate: d.toISOString().split('T')[0],
        messageTime: d.toTimeString().slice(0, 5),
      });
      existingFingerprints.add(fingerprint);
      if (smsRec) {
        await autoCreateSmsTransaction(smsRec.id);
        newCount++;
      }
    }

    await updateLastSmsProcessedAt(new Date().toISOString());
    return newCount;
  } catch (err) {
    console.warn('[SMS] initial scan error:', err);
    return 0;
  }
}
