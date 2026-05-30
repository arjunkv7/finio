import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform, View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { DS } from './src/constants';
import RootNavigator from './src/navigation/RootNavigator';
import { getDb } from './src/db/database';
import { useSettingsStore } from './src/store/settingsStore';
import { useRecurringStore } from './src/store/recurringStore';
import { useTransactionsStore } from './src/store/transactionsStore';
import { useSmsTransactionsStore } from './src/store/smsTransactionsStore';
import { checkSmsPermission, requestSmsPermission } from './src/services/smsService';

const darkNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: DS.surface.screen,
    card: DS.surface.card,
    text: DS.text.primary,
    border: DS.border.subtle,
    primary: DS.primary,
  },
};

const lightNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F8FAFC',
    card: '#FFFFFF',
    text: '#111317',
    border: 'rgba(0,0,0,0.08)',
    primary: DS.primary,
  },
};

const darkPaperTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: DS.primary,
    background: DS.surface.screen,
    surface: DS.surface.card,
    surfaceVariant: DS.surface.elevated,
    onSurface: DS.text.primary,
    onSurfaceVariant: DS.text.secondary,
    outline: DS.border.strong,
  },
};

const lightPaperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: DS.primary,
  },
};

// Requests notification then SMS permissions sequentially so the two system
// dialogs never appear at the same time (Android only shows one at a time).
function PermissionsSetup() {
  const loadPending     = useSmsTransactionsStore(s => s.loadPending);
  const loadAutoCreated = useSmsTransactionsStore(s => s.loadAutoCreated);

  useEffect(() => {
    (async () => {
      // 1. Notification permission — must finish before SMS to avoid dialog conflict
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        if (Platform.OS === 'android') {
          await Promise.all([
            Notifications.setNotificationChannelAsync('transactions', {
              name: 'Auto-detected Transactions',
              importance: Notifications.AndroidImportance.HIGH,
              vibrationPattern: [0, 250],
              showBadge: false,
            }),
            Notifications.setNotificationChannelAsync('daily_reminder', {
              name: 'Daily Finance Reminder',
              importance: Notifications.AndroidImportance.DEFAULT,
              vibrationPattern: [0, 200],
              showBadge: false,
            }),
          ]);
        }

        // Schedule daily 8 PM review reminder — cancel first to avoid duplicates on relaunch
        await Notifications.cancelScheduledNotificationAsync('finio-daily-review').catch(() => {});
        await Notifications.scheduleNotificationAsync({
          identifier: 'finio-daily-review',
          content: {
            title: "Time to review your day 💰",
            body: "A quick look at today's transactions keeps your finances on track. Tap to log.",
            sound: true,
            color: '#10B981',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 20,
            minute: 0,
            channelId: 'daily_reminder',
          },
        });
      }

      if (Platform.OS !== 'android') return;

      // 2. SMS permission — read from store directly to avoid stale closure
      const { smsAutoDetect, saveToDb } = useSettingsStore.getState();
      if (smsAutoDetect === 0) return; // user previously disabled — skip

      const hasPerm = await checkSmsPermission();
      if (!hasPerm) {
        const granted = await requestSmsPermission();
        if (!granted) {
          await saveToDb({ smsAutoDetect: 0 });
          return;
        }
      }

      await Promise.all([loadPending(), loadAutoCreated()]);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// Handles foreground refresh only — permission management is in PermissionsSetup.
function SmsProcessor() {
  const smsAutoDetect   = useSettingsStore(s => s.smsAutoDetect);
  const loadPending     = useSmsTransactionsStore(s => s.loadPending);
  const loadAutoCreated = useSmsTransactionsStore(s => s.loadAutoCreated);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state !== 'active' || !smsAutoDetect) return;
      const hasPerm = await checkSmsPermission();
      if (hasPerm) await Promise.all([loadPending(), loadAutoCreated()]);
    });
    return () => sub.remove();
  }, [smsAutoDetect]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function RecurringProcessor() {
  const processDue = useRecurringStore(s => s.processDue);
  const loadTransactions = useTransactionsStore(s => s.loadFromDB);
  const didRun = useRef(false);

  const run = async () => {
    const count = await processDue();
    if (count > 0) await loadTransactions();
  };

  useEffect(() => {
    if (!didRun.current) { didRun.current = true; run(); }
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') run();
    });
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const loadSettings          = useSettingsStore(s => s.loadFromDB);
  const theme                 = useSettingsStore(s => s.theme);

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    getDb()
      .then(() => loadSettings())
      .then(() => setDbReady(true))
      .catch(err => {
        console.error('[Finio] DB init error:', err);
        setDbReady(true);
      });
  }, []);

  if (!dbReady || (!fontsLoaded && fontError == null)) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={DS.primary} size="large" />
      </View>
    );
  }

  const isDark     = theme !== 'light';
  const navTheme   = isDark ? darkNavTheme : lightNavTheme;
  const paperTheme = isDark ? darkPaperTheme : lightPaperTheme;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <NavigationContainer theme={navTheme}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <PermissionsSetup />
            <RecurringProcessor />
            <SmsProcessor />
            <RootNavigator />
          </NavigationContainer>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: {
    flex: 1,
    backgroundColor: DS.surface.screen,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
