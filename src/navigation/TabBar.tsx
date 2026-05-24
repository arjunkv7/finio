import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDS } from '../hooks/useDS';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TAB_CONFIG: Record<string, { label: string; active: IconName; inactive: IconName }> = {
  Home:    { label: 'Home',     active: 'home',               inactive: 'home-outline' },
  History: { label: 'History',  active: 'history',            inactive: 'history' },
  Reports: { label: 'Insights', active: 'chart-bar',          inactive: 'chart-bar-stacked' },
  More:    { label: 'More',     active: 'dots-grid',          inactive: 'dots-grid' },
};

const VISIBLE_TABS = ['Home', 'History', 'Reports', 'More'];

export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const ds = useDS();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);

  const visibleRoutes = state.routes.filter(r => VISIBLE_TABS.includes(r.name));

  const activeRouteName = state.routes[state.index]?.name;

  const handleFAB = () => {
    // Navigate up to root stack since AddTransaction lives there
    (navigation as any).navigate('AddTransaction');
  };

  const handleTabPress = (routeName: string, routeKey: string) => {
    const isFocused = activeRouteName === routeName;
    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName as any);
    }
  };

  const renderTab = (routeName: string, routeKey: string) => {
    const isFocused = activeRouteName === routeName;
    const config = TAB_CONFIG[routeName];

    return (
      <TouchableOpacity
        key={routeKey}
        onPress={() => handleTabPress(routeName, routeKey)}
        style={styles.tab}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={config.label}
      >
        <MaterialCommunityIcons
          name={isFocused ? config.active : config.inactive}
          size={24}
          color={isFocused ? ds.primary : ds.text.muted}
        />
        <Text
          style={[
            styles.label,
            { color: isFocused ? ds.primary : ds.text.muted },
          ]}
        >
          {config.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const leftTabs = visibleRoutes.slice(0, 2);
  const rightTabs = visibleRoutes.slice(2, 4);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: ds.surface.card,
          borderTopColor: ds.border.subtle,
          paddingBottom: bottomPad,
        },
      ]}
    >
      {/* Left side: Home + History */}
      <View style={styles.side}>
        {leftTabs.map(r => renderTab(r.name, r.key))}
      </View>

      {/* Center FAB */}
      <View style={styles.fabWrap}>
        <TouchableOpacity
          onPress={handleFAB}
          style={[styles.fab, { backgroundColor: ds.primary }]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
        >
          <MaterialCommunityIcons name="plus" size={30} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Right side: Insights + More */}
      <View style={styles.side}>
        {rightTabs.map(r => renderTab(r.name, r.key))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 2,
    gap: 3,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  fabWrap: {
    width: 72,
    alignItems: 'center',
    marginTop: -20,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});
