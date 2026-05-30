import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSettingsStore } from '../store/settingsStore';
import { getSettings } from '../db/database';
import { useDS } from '../hooks/useDS';
import { DSType } from '../constants/colors';

const PIN_LENGTH = 4;

interface Props {
  onUnlock: () => void;
}

export default function AppLockOverlay({ onUnlock }: Props) {
  const ds = useDS();
  const styles = useMemo(() => makeStyles(ds), [ds]);
  const biometricEnabled = useSettingsStore(s => s.biometricEnabled);

  const [pin, setPin]         = useState('');
  const [error, setError]     = useState('');
  const [hasHW, setHasHW]     = useState(false);
  const pinHashRef = useRef<string | null>(null);

  const triggerDeviceAuth = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Finio',
      cancelLabel: 'Use PIN',
      // false = allow device PIN/pattern/password as fallback after biometric
      disableDeviceFallback: false,
    });
    if (result.success) onUnlock();
  }, [onUnlock]);

  useEffect(() => {
    (async () => {
      const settings = await getSettings();
      pinHashRef.current = settings?.pin_hash ?? null;

      if (biometricEnabled) {
        const hw = await LocalAuthentication.hasHardwareAsync();
        setHasHW(hw);
        // Trigger immediately — system will present biometric or device PIN
        triggerDeviceAuth();
      }
    })();
  }, [biometricEnabled, triggerDeviceAuth]);

  const handleDigit = (d: string) => {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length === PIN_LENGTH) {
      if (next === pinHashRef.current) {
        onUnlock();
      } else {
        setError('Incorrect PIN. Try again.');
        setPin('');
      }
    }
  };

  const handleDelete = () => {
    setPin(p => p.slice(0, -1));
    setError('');
  };

  // Icon to show in the bottom-left key
  const bioIcon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] =
    Platform.OS === 'ios' ? 'face-recognition' : 'fingerprint';

  return (
    <Modal visible animationType="none" statusBarTranslucent>
      <View style={styles.screen}>
        <View style={styles.inner}>
          <MaterialCommunityIcons name="shield-lock-outline" size={52} color={ds.primary} />
          <Text style={styles.appName}>Finio</Text>
          <Text style={styles.subtitle}>
            {biometricEnabled ? 'Use device unlock or enter PIN' : 'Enter your PIN to continue'}
          </Text>

          <View style={styles.dots}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
            ))}
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.keypad}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
              <TouchableOpacity key={d} style={styles.key} onPress={() => handleDigit(d)} activeOpacity={0.7}>
                <Text style={styles.keyText}>{d}</Text>
              </TouchableOpacity>
            ))}

            {/* Bottom row: device-auth | 0 | backspace */}
            <TouchableOpacity
              style={styles.key}
              onPress={biometricEnabled ? triggerDeviceAuth : undefined}
              activeOpacity={biometricEnabled ? 0.7 : 1}
            >
              {!!biometricEnabled && (
                <MaterialCommunityIcons
                  name={hasHW ? bioIcon : 'lock-open-outline'}
                  size={30}
                  color={ds.primary}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.key} onPress={() => handleDigit('0')} activeOpacity={0.7}>
              <Text style={styles.keyText}>0</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.key} onPress={handleDelete} activeOpacity={0.7}>
              <MaterialCommunityIcons name="backspace-outline" size={26} color={ds.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: ds.surface.screen,
      justifyContent: 'center',
      alignItems: 'center',
    },
    inner: {
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    appName: {
      fontSize: 28,
      fontFamily: 'Inter_700Bold',
      color: ds.text.primary,
      marginTop: 16,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: ds.text.muted,
      marginTop: 8,
      marginBottom: 40,
      textAlign: 'center',
    },
    dots: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 16,
    },
    dot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: ds.border.strong,
      backgroundColor: 'transparent',
    },
    dotFilled: {
      backgroundColor: ds.primary,
      borderColor: ds.primary,
    },
    error: {
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: ds.secondary,
      marginBottom: 8,
      textAlign: 'center',
    },
    keypad: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: 288,
      marginTop: 24,
      gap: 12,
    },
    key: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: ds.surface.elevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
    keyText: {
      fontSize: 24,
      fontFamily: 'Inter_500Medium',
      color: ds.text.primary,
    },
  });
}
