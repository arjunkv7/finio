import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { DS } from './src/constants';
import RootNavigator from './src/navigation/RootNavigator';
import { getDb, getSettings } from './src/db/database';
import { useSettingsStore } from './src/store/settingsStore';
import { useRecurringStore } from './src/store/recurringStore';
import { useTransactionsStore } from './src/store/transactionsStore';
import { useSmsTransactionsStore } from './src/store/smsTransactionsStore';
import { initialInboxScan } from './src/services/smsService';

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

function SmsProcessor() {
  const smsAutoDetect  = useSettingsStore(s => s.smsAutoDetect);
  const loadPending    = useSmsTransactionsStore(s => s.loadPending);
  const loadAutoCreated = useSmsTransactionsStore(s => s.loadAutoCreated);
  const didRun         = useRef(false);

  const run = async () => {
    if (!smsAutoDetect) return;
    // One-time inbox scan (no-ops if already done — BroadcastReceiver handles new SMS)
    await initialInboxScan();
    await Promise.all([loadPending(), loadAutoCreated()]);
  };

  useEffect(() => {
    if (!didRun.current) { didRun.current = true; run(); }
    // Refresh on foreground — BroadcastReceiver may have auto-created new transactions
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') Promise.all([loadPending(), loadAutoCreated()]);
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
  const [dbReady, setDbReady]   = useState(false);
  const setSettings             = useSettingsStore(s => s.setSettings);
  const markLoaded              = useSettingsStore(s => s.markLoaded);
  const theme                   = useSettingsStore(s => s.theme);

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    getDb()
      .then(async () => {
        const row = await getSettings();
        if (row) {
          setSettings({
            currencyCode: row.currency_code,
            currencySymbol: row.currency_symbol,
            theme: row.theme as 'light' | 'dark' | 'system',
          });
        }
        markLoaded();
        setDbReady(true);
      })
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
