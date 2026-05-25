// ─── Settings ───────────────────────────────────────────────────────────────

export interface Settings {
  id: number;
  currency_code: string;
  currency_symbol: string;
  theme: 'light' | 'dark' | 'system';
  pin_enabled: number;
  pin_hash: string | null;
  drive_connected: number;
  last_backup_at: string | null;
  schema_version: number;
  created_at: string;
  updated_at: string;
}

export type UpdateSettingsInput = Partial<
  Pick<
    Settings,
    | 'currency_code'
    | 'currency_symbol'
    | 'theme'
    | 'pin_enabled'
    | 'pin_hash'
    | 'drive_connected'
    | 'last_backup_at'
  >
>;

// ─── Accounts ───────────────────────────────────────────────────────────────

export type AccountType = 'bank' | 'cash' | 'wallet' | 'credit' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  icon: string | null;
  color: string | null;
  opening_balance: number;
  is_archived: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  icon?: string | null;
  color?: string | null;
  opening_balance?: number;
  sort_order?: number;
}

export type UpdateAccountInput = Partial<CreateAccountInput & { is_archived: number }>;

// ─── Categories ─────────────────────────────────────────────────────────────

export type CategoryType = 'income' | 'expense';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  is_system: number;
  is_deleted: number;
  sort_order: number;
  created_at: string;
}

export interface CreateCategoryInput {
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  sort_order?: number;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

// ─── Transactions ────────────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense' | 'transfer';
export type RecurrenceRule = 'monthly' | 'weekly' | 'yearly';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  description: string | null;
  notes: string | null;
  transaction_date: string;
  transaction_time: string | null;
  receipt_photo_uri: string | null;
  is_recurring: number;
  recurrence_rule: RecurrenceRule | null;
  trip_id: string | null;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  description?: string | null;
  notes?: string | null;
  transaction_date: string;
  transaction_time?: string | null;
  receipt_photo_uri?: string | null;
  is_recurring?: number;
  recurrence_rule?: RecurrenceRule | null;
  trip_id?: string | null;
}

export type UpdateTransactionInput = Partial<CreateTransactionInput>;

export interface TransactionFilter {
  type?: TransactionType;
  account_id?: string;
  category_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  trip_id?: string;
}

export interface MonthlySummary {
  income: number;
  expenses: number;
  net: number;
}

// ─── Savings Goals ───────────────────────────────────────────────────────────

export interface SavingsGoal {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  target_amount: number;
  target_date: string | null;
  is_completed: number;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSavingsGoalInput {
  name: string;
  icon?: string | null;
  color?: string | null;
  target_amount: number;
  target_date?: string | null;
}

export type UpdateSavingsGoalInput = Partial<CreateSavingsGoalInput & { is_completed: number }>;

// ─── Savings Contributions ───────────────────────────────────────────────────

export interface SavingsContribution {
  id: string;
  goal_id: string;
  amount: number;
  notes: string | null;
  contribution_date: string;
  created_at: string;
}

export interface CreateContributionInput {
  goal_id: string;
  amount: number;
  notes?: string | null;
  contribution_date: string;
}

// ─── Investments ─────────────────────────────────────────────────────────────

export type AssetType =
  | 'stocks'
  | 'mutual_fund'
  | 'crypto'
  | 'fixed_deposit'
  | 'gold'
  | 'real_estate'
  | 'other';

export interface Investment {
  id: string;
  asset_name: string;
  asset_type: AssetType;
  amount_invested: number;
  investment_date: string;
  notes: string | null;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export interface CreateInvestmentInput {
  asset_name: string;
  asset_type: AssetType;
  amount_invested: number;
  investment_date: string;
  notes?: string | null;
}

export type UpdateInvestmentInput = Partial<CreateInvestmentInput>;

// ─── Trips ───────────────────────────────────────────────────────────────────

export interface Trip {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  is_settled: number;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTripInput {
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export type UpdateTripInput = Partial<CreateTripInput & { is_settled: number }>;

// ─── Trip Participants ───────────────────────────────────────────────────────

export interface TripParticipant {
  id: string;
  trip_id: string;
  name: string;
  is_self: number;
  created_at: string;
}

export interface CreateParticipantInput {
  trip_id: string;
  name: string;
  is_self?: number;
}

// ─── Trip Expenses ───────────────────────────────────────────────────────────

export type SplitType = 'equal' | 'custom' | 'percentage';

export interface TripExpense {
  id: string;
  trip_id: string;
  paid_by_participant_id: string;
  category_id: string | null;
  amount: number;
  description: string | null;
  split_type: SplitType;
  expense_date: string;
  linked_transaction_id: string | null;
  created_at: string;
}

export interface CreateTripExpenseInput {
  trip_id: string;
  paid_by_participant_id: string;
  category_id?: string | null;
  amount: number;
  description?: string | null;
  split_type?: SplitType;
  expense_date: string;
  linked_transaction_id?: string | null;
}

// ─── Trip Expense Splits ─────────────────────────────────────────────────────

export interface TripExpenseSplit {
  id: string;
  trip_expense_id: string;
  participant_id: string;
  share_amount: number;
  is_excluded: number;
}

export interface CreateSplitInput {
  trip_expense_id: string;
  participant_id: string;
  share_amount: number;
  is_excluded?: number;
}

export interface Settlement {
  from_id: string;
  from_name: string;
  to_id: string;
  to_name: string;
  amount: number;
}

// ─── Recurring Transactions ──────────────────────────────────────────────────

export interface RecurringTransaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  account_id: string;
  category_id: string | null;
  description: string | null;
  notes: string | null;
  frequency: RecurrenceFrequency;
  next_run_date: string;
  time_of_day: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CreateRecurringTransactionInput {
  type: 'income' | 'expense';
  amount: number;
  account_id: string;
  category_id?: string | null;
  description?: string | null;
  notes?: string | null;
  frequency: RecurrenceFrequency;
  start_date: string;
  time_of_day?: string;
}

export type UpdateRecurringTransactionInput = Partial<{
  amount: number;
  category_id: string | null;
  description: string | null;
  notes: string | null;
  frequency: RecurrenceFrequency;
  next_run_date: string;
  time_of_day: string;
  is_active: number;
}>;

// ─── SMS Transactions ────────────────────────────────────────────────────────

export type SmsTransactionStatus = 'pending' | 'approved' | 'dismissed' | 'auto_created';

export interface SmsTransaction {
  id: string;
  sms_id: string | null;
  sender: string;
  raw_body: string;
  amount: number;
  type: 'income' | 'expense';
  account_type: string;
  description: string | null;
  message_date: string;
  message_time: string;
  status: SmsTransactionStatus;
  transaction_id: string | null;
  created_at: string;
}

export interface CreateSmsTransactionInput {
  smsId: string | null;
  sender: string;
  rawBody: string;
  amount: number;
  type: 'income' | 'expense';
  accountType: string;
  description: string | null;
  messageDate: string;
  messageTime: string;
}

// ─── Budgets ─────────────────────────────────────────────────────────────────

export interface Budget {
  id: string;
  category_id: string;
  monthly_limit: number;
  alert_at_percent: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CreateBudgetInput {
  category_id: string;
  monthly_limit: number;
  alert_at_percent?: number;
}

export type UpdateBudgetInput = Partial<CreateBudgetInput & { is_active: number }>;

export interface BudgetProgress {
  budget: Budget;
  category_name: string;
  spent: number;
  limit: number;
  percent: number;
}
