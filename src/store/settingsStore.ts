import { create } from 'zustand';
import { Settings } from '../types/db';
import { getSettings, updateSettings } from '../db/database';

interface SettingsState {
  // ── Data ───────────────────────────────────────────────────────────────────
  currencyCode: string;
  currencySymbol: string;
  theme: 'light' | 'dark' | 'system';
  pinEnabled: number;
  biometricEnabled: number;
  driveConnected: number;
  lastBackupAt: string | null;
  schemaVersion: number;
  smsAutoDetect: number;
  privacyHidden: number;

  // ── Meta ───────────────────────────────────────────────────────────────────
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  loadFromDB: () => Promise<void>;
  saveToDb: (
    patch: Partial<
      Pick<SettingsState, 'currencyCode' | 'currencySymbol' | 'theme' | 'pinEnabled' | 'biometricEnabled' | 'driveConnected' | 'lastBackupAt' | 'smsAutoDetect' | 'privacyHidden'>
    >
  ) => Promise<void>;

  // Kept for App.tsx backward-compat
  setSettings: (patch: Partial<Pick<SettingsState, 'currencyCode' | 'currencySymbol' | 'theme'>>) => void;
  markLoaded: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  currencyCode: 'INR',
  currencySymbol: '₹',
  theme: 'dark',
  pinEnabled: 0,
  biometricEnabled: 0,
  driveConnected: 0,
  lastBackupAt: null,
  schemaVersion: 1,
  smsAutoDetect: 1,
  privacyHidden: 0,

  isLoaded: false,
  isLoading: false,
  error: null,

  loadFromDB: async () => {
    set({ isLoading: true, error: null });
    try {
      const row = await getSettings();
      if (row) {
        set({
          currencyCode: row.currency_code,
          currencySymbol: row.currency_symbol,
          theme: row.theme as 'light' | 'dark' | 'system',
          pinEnabled: row.pin_enabled ?? 0,
          biometricEnabled: row.biometric_enabled ?? 0,
          driveConnected: row.drive_connected ?? 0,
          lastBackupAt: row.last_backup_at ?? null,
          schemaVersion: row.schema_version,
          smsAutoDetect: row.sms_auto_detect ?? 1,
          privacyHidden: row.privacy_hidden ?? 0,
          isLoaded: true,
          isLoading: false,
        });
      } else {
        set({ isLoaded: true, isLoading: false });
      }
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  saveToDb: async (patch) => {
    const dbFields: Record<string, string | number | null> = {};
    if (patch.currencyCode != null) dbFields.currency_code = patch.currencyCode;
    if (patch.currencySymbol != null) dbFields.currency_symbol = patch.currencySymbol;
    if (patch.theme != null) dbFields.theme = patch.theme;
    if (patch.pinEnabled != null) dbFields.pin_enabled = patch.pinEnabled;
    if (patch.biometricEnabled != null) dbFields.biometric_enabled = patch.biometricEnabled;
    if (patch.driveConnected != null) dbFields.drive_connected = patch.driveConnected;
    if (patch.lastBackupAt !== undefined) dbFields.last_backup_at = patch.lastBackupAt;
    if (patch.smsAutoDetect != null) dbFields.sms_auto_detect = patch.smsAutoDetect;
    if (patch.privacyHidden != null) dbFields.privacy_hidden = patch.privacyHidden;

    set(patch as Partial<SettingsState>);
    await updateSettings(dbFields);
  },

  // Backward-compat shims (App.tsx calls these directly after DB read)
  setSettings: (patch) => set(patch as Partial<SettingsState>),
  markLoaded: () => set({ isLoaded: true }),
}));

export const useSettings = useSettingsStore;
