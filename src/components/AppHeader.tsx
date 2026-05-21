import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DS } from '../constants';

interface AppHeaderProps {
  title: string;
  onBack?: () => void;
  rightIcon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onRightPress?: () => void;
  rightLabel?: string;
}

export default function AppHeader({
  title,
  onBack,
  rightIcon,
  onRightPress,
  rightLabel,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {/* Left — back button or spacer */}
        <View style={styles.side}>
          {onBack != null && (
            <TouchableOpacity
              onPress={onBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.iconBtn}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={28}
                color={DS.text.primary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {/* Right — icon or text action */}
        <View style={[styles.side, styles.sideRight]}>
          {onRightPress != null && (rightIcon != null || rightLabel != null) && (
            <TouchableOpacity
              onPress={onRightPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.iconBtn}
            >
              {rightLabel != null ? (
                <Text style={styles.rightLabel}>{rightLabel}</Text>
              ) : (
                rightIcon != null && (
                  <MaterialCommunityIcons
                    name={rightIcon}
                    size={24}
                    color={DS.text.primary}
                  />
                )
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: DS.surface.screen,
    borderBottomWidth: 1,
    borderBottomColor: DS.border.subtle,
  },
  row: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  side: {
    width: 44,
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  iconBtn: {
    padding: 4,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
    color: DS.text.primary,
  },
  rightLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: DS.primaryLight,
  },
});
