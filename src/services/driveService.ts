import * as FileSystem from 'expo-file-system/legacy';

const TOKEN_FILE = (FileSystem.documentDirectory ?? '') + '.gd_token';
const BACKUP_FILENAME = 'finio_backup.json';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

type StoredToken = { accessToken: string; expiresAt: number };

// ── Token persistence ─────────────────────────────────────────────────────────

export async function saveAccessToken(accessToken: string, expiresIn: number): Promise<void> {
  const payload: StoredToken = { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
  await FileSystem.writeAsStringAsync(TOKEN_FILE, JSON.stringify(payload));
}

export async function getStoredToken(): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(TOKEN_FILE);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(TOKEN_FILE);
    const stored: StoredToken = JSON.parse(raw);
    // Treat token as expired 2 min before actual expiry to avoid edge-case failures
    if (Date.now() > stored.expiresAt - 120_000) return null;
    return stored.accessToken;
  } catch {
    return null;
  }
}

export async function clearStoredToken(): Promise<void> {
  try { await FileSystem.deleteAsync(TOKEN_FILE, { idempotent: true }); } catch {}
}

// ── Drive API helpers ─────────────────────────────────────────────────────────

async function findBackupFileId(accessToken: string): Promise<string | null> {
  const url =
    `${DRIVE_FILES}?q=name%3D'${BACKUP_FILENAME}'+and+trashed%3Dfalse&fields=files(id)`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.files as { id: string }[])?.[0]?.id ?? null;
}

export async function uploadBackup(jsonContent: string, accessToken: string): Promise<void> {
  const existingId = await findBackupFileId(accessToken);
  const boundary = 'finio_mp_boundary';
  const metadata = JSON.stringify({ name: BACKUP_FILENAME, mimeType: 'application/json' });
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    jsonContent,
    `--${boundary}--`,
  ].join('\r\n');

  const url = existingId
    ? `${DRIVE_UPLOAD}/${existingId}?uploadType=multipart`
    : `${DRIVE_UPLOAD}?uploadType=multipart`;

  const res = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive upload failed (${res.status}): ${text}`);
  }
}

export async function downloadBackup(accessToken: string): Promise<string | null> {
  const fileId = await findBackupFileId(accessToken);
  if (!fileId) return null;
  const res = await fetch(`${DRIVE_FILES}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.text();
}
