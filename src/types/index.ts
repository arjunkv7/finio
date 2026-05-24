export * from './db';

export type RootTabParamList = {
  Home: undefined;
  History: undefined;
  Reports: undefined;
  More: undefined;
  // Secondary tabs (hidden from tab bar, navigable from More)
  Accounts: undefined;
  Trips: undefined;
  Savings: undefined;
  Investments: undefined;
  Settings: undefined;
};

export type AccountsStackParamList = {
  AccountsList: undefined;
  AddAccount: undefined;
};

export type TripsStackParamList = {
  TripList: undefined;
  TripDetail: { tripId: string };
  AddTripExpense: { tripId: string };
};

export type RootStackParamList = {
  Tabs: undefined;
  AddTransaction: {
    defaultType?: 'income' | 'expense';
    editTx?: import('./db').Transaction;
  } | undefined;
  ExportScreen: undefined;
};
