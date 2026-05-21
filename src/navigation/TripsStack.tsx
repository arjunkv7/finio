import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { TripsStackParamList } from '../types';
import TripListScreen from '../screens/trips/TripListScreen';
import TripDetailScreen from '../screens/trips/TripDetailScreen';
import AddTripExpenseScreen from '../screens/trips/AddTripExpenseScreen';

const Stack = createStackNavigator<TripsStackParamList>();

export default function TripsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TripList" component={TripListScreen} />
      <Stack.Screen name="TripDetail" component={TripDetailScreen} />
      <Stack.Screen
        name="AddTripExpense"
        component={AddTripExpenseScreen}
        options={{ presentation: 'modal', gestureEnabled: true }}
      />
    </Stack.Navigator>
  );
}
