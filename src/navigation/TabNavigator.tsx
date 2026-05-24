import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootTabParamList } from '../types';
import {
  HomeScreen,
  HistoryScreen,
  ReportsScreen,
  SettingsScreen,
} from '../screens';
import MoreScreen from '../screens/MoreScreen';
import AccountsStack from './AccountsStack';
import TripsStack from './TripsStack';
import SavingsScreen from '../screens/SavingsScreen';
import InvestmentsScreen from '../screens/InvestmentsScreen';
import CustomTabBar from './TabBar';

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {/* ── Visible tabs ─────────────────────────────────────────── */}
      <Tab.Screen name="Home"    component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="More"    component={MoreScreen} />

      {/* ── Hidden tabs (accessible via More screen) ─────────────── */}
      <Tab.Screen name="Accounts"    component={AccountsStack} />
      <Tab.Screen name="Trips"       component={TripsStack} />
      <Tab.Screen name="Savings"     component={SavingsScreen} />
      <Tab.Screen name="Investments" component={InvestmentsScreen} />
      <Tab.Screen name="Settings"    component={SettingsScreen} />
    </Tab.Navigator>
  );
}
