import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DS } from '../constants';
import { RootTabParamList } from '../types';
import {
  HomeScreen,
  ReportsScreen,
  SavingsScreen,
  InvestmentsScreen,
  SettingsScreen,
} from '../screens';
import AccountsStack from './AccountsStack';
import TripsStack from './TripsStack';

const Tab = createBottomTabNavigator<RootTabParamList>();

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TAB_ICONS: Record<keyof RootTabParamList, { active: IconName; inactive: IconName }> = {
  Home:        { active: 'home',            inactive: 'home-outline' },
  Accounts:    { active: 'wallet',          inactive: 'wallet-outline' },
  Reports:     { active: 'chart-bar',       inactive: 'chart-bar-stacked' },
  Trips:       { active: 'airplane',        inactive: 'airplane' },
  Savings:     { active: 'piggy-bank',      inactive: 'piggy-bank-outline' },
  Investments: { active: 'trending-up',     inactive: 'trending-up' },
  Settings:    { active: 'cog',             inactive: 'cog-outline' },
};

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: DS.surface.card,
          borderTopColor: DS.border.subtle,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: DS.primary,
        tabBarInactiveTintColor: DS.text.muted,
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 11,
        },
        tabBarIcon: ({ color, focused }) => {
          const icons = TAB_ICONS[route.name as keyof RootTabParamList];
          const name = focused ? icons.active : icons.inactive;
          return <MaterialCommunityIcons name={name} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"        component={HomeScreen} />
      <Tab.Screen name="Accounts"    component={AccountsStack} />
      <Tab.Screen name="Reports"     component={ReportsScreen} />
      <Tab.Screen name="Trips"       component={TripsStack} />
      <Tab.Screen name="Savings"     component={SavingsScreen} />
      <Tab.Screen name="Investments" component={InvestmentsScreen} options={{ tabBarLabel: 'Invest' }} />
      <Tab.Screen name="Settings"    component={SettingsScreen} />
    </Tab.Navigator>
  );
}
