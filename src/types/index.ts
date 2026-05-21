export * from './db';

export type RootTabParamList = {
  Home: undefined;
  Accounts: undefined;
  Reports: undefined;
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
