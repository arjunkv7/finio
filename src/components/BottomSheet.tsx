import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
  Pressable,
  Platform,
  Keyboard,
  ScrollView,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS_DARK, DSType } from '../constants/colors';
import { Typography } from '../constants';
import { useDS } from '../hooks/useDS';

// Consumers use this to cap their ScrollView height to the visible viewport above the keyboard.
export const BottomSheetKeyboardContext = createContext(0);

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

function makeStyles(ds: DSType) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.72)',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1,
      backgroundColor: ds.surface.card,
      borderTopLeftRadius: ds.radius.xl,
      borderTopRightRadius: ds.radius.xl,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: ds.border.subtle,
      paddingBottom: Platform.OS === 'ios' ? 34 : 16,
      ...ds.shadow.modal,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: ds === DS_DARK ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 4,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: ds.border.subtle,
    },
    title: {
      ...Typography.headlineMd,
      color: ds.text.primary,
    },
  });
}

export default function BottomSheet({
  visible,
  onClose,
  children,
  title,
}: BottomSheetProps) {
  const ds = useDS();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(ds), [ds]);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const sheetHeightRef = useRef(0);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 26,
          stiffness: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, backdropOpacity, translateY]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (e) => {
      const kbH = e.endCoordinates.height;
      setKbHeight(kbH);
      // Clamp so the sheet never rises above the safe area top.
      const maxUp = SCREEN_HEIGHT - sheetHeightRef.current - insets.top;
      const toValue = -Math.min(kbH, Math.max(0, maxUp));
      Animated.timing(keyboardOffset, {
        toValue,
        duration: Platform.OS === 'ios' ? e.duration : 180,
        useNativeDriver: true,
      }).start();
    });
    const onHide = Keyboard.addListener(hideEvent, (e) => {
      setKbHeight(0);
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 180,
        useNativeDriver: true,
      }).start();
    });
    return () => { onShow.remove(); onHide.remove(); };
  }, [keyboardOffset, insets.top]);

  useEffect(() => {
    if (!visible) { keyboardOffset.setValue(0); setKbHeight(0); }
  }, [visible, keyboardOffset]);

  return (
    <Modal
      transparent
      visible={visible}
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents="none" />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        onLayout={(e) => { sheetHeightRef.current = e.nativeEvent.layout.height; }}
        style={[styles.sheet, { transform: [{ translateY: Animated.add(translateY, keyboardOffset) }] }]}
      >
        {/* Drag handle */}
        <View style={styles.handle} />

        {title != null && (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
          </View>
        )}

        <BottomSheetKeyboardContext.Provider value={kbHeight}>
          {children}
        </BottomSheetKeyboardContext.Provider>
      </Animated.View>
    </Modal>
  );
}

export function BottomSheetScrollView({ style, ...props }: ScrollViewProps) {
  const kbHeight = useContext(BottomSheetKeyboardContext);
  const insets = useSafeAreaInsets();
  // Cap the scroll area to the visible viewport above the keyboard so the
  // topmost item can't scroll off the top of the screen.
  const maxHeight = kbHeight > 0
    ? SCREEN_HEIGHT - kbHeight - insets.top - 100
    : undefined;
  return (
    <ScrollView
      style={maxHeight != null ? [{ maxHeight }, style] : style}
      {...props}
    />
  );
}
