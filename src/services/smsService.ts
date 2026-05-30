import { Platform, PermissionsAndroid } from 'react-native';


// Stable fingerprint used by BOTH the broadcast path (HeadlessJS) and the
// one-time inbox scan, so the same SMS is never queued twice.
export function smsFingerprint(sender: string, body: string, timestampMs: number): string {
  const minute = Math.floor(timestampMs / 60_000); // round to minute
  return `${sender.toLowerCase()}:${minute}:${body.trim().slice(0, 40)}`;
}

export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    // Both READ_SMS (inbox scan) and RECEIVE_SMS (BroadcastReceiver) are needed.
    // On Android 6–12 they share a permission group so one grant covers both;
    // on Android 13+ they must be requested explicitly.
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]);
    return (
      results[PermissionsAndroid.PERMISSIONS.READ_SMS]    === PermissionsAndroid.RESULTS.GRANTED &&
      results[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch {
    return false;
  }
}

export async function checkSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const [read, receive] = await Promise.all([
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS),
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS),
  ]);
  return read && receive;
}

