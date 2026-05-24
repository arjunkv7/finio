import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import TabNavigator from './TabNavigator';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import ExportScreen from '../screens/ExportScreen';
import AccountsStack from './AccountsStack';
import TripsStack from './TripsStack';
import SavingsScreen from '../screens/SavingsScreen';
import InvestmentsScreen from '../screens/InvestmentsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RecurringScreen from '../screens/RecurringScreen';

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={{ presentation: 'modal', gestureEnabled: true }}
      />
      <Stack.Screen name="ExportScreen" component={ExportScreen} />
      <Stack.Screen name="Accounts"    component={AccountsStack} />
      <Stack.Screen name="Trips"       component={TripsStack} />
      <Stack.Screen name="Savings"     component={SavingsScreen} />
      <Stack.Screen name="Investments" component={InvestmentsScreen} />
      <Stack.Screen name="Settings"    component={SettingsScreen} />
      <Stack.Screen name="Recurring"   component={RecurringScreen} />
    </Stack.Navigator>
  );
}
