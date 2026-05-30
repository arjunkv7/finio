import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'finio.db';
const SCHEMA_VERSION = 12;

let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      try {
        await bootstrap(db);
      } catch (err) {
        console.error('[Finio] bootstrap error:', err);
        // Re-throw so callers know the DB is not ready; reset so next call retries
        _dbPromise = null;
        throw err;
      }
      return db;
    })();
  }
  return _dbPromise;
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function bootstrap(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  const currentVersion = await getSchemaVersion(db);

  if (currentVersion === 0) {
    await createSchema(db);
    await createIndexes(db);
    await seedDefaults(db);
    await setSchemaVersion(db, SCHEMA_VERSION);
  } else {
    await db.execAsync('PRAGMA foreign_keys = ON');
    await runMigrations(db, currentVersion);
  }
}

// ─── Schema version via PRAGMA user_version ──────────────────────────────────

async function getSchemaVersion(db: SQLite.SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

async function setSchemaVersion(db: SQLite.SQLiteDatabase, version: number): Promise<void> {
  await db.execAsync(`PRAGMA user_version = ${version}`);
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE settings SET schema_version = ?, updated_at = ? WHERE id = 1',
    [version, now]
  );
}

// ─── Migrations ──────────────────────────────────────────────────────────────

async function runMigrations(db: SQLite.SQLiteDatabase, from: number): Promise<void> {
  if (from < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS notifications (
        id         TEXT    PRIMARY KEY,
        title      TEXT    NOT NULL,
        body       TEXT    NOT NULL,
        type       TEXT    NOT NULL,
        data       TEXT,
        is_read    INTEGER NOT NULL DEFAULT 0,
        created_at TEXT    NOT NULL
      );
    `);
    await setSchemaVersion(db, 2);
  }
  if (from < 3) {
    await db.execAsync(`ALTER TABLE transactions ADD COLUMN transaction_time TEXT;`);
    await setSchemaVersion(db, 3);
  }
  if (from < 4) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id            TEXT    PRIMARY KEY,
        type          TEXT    NOT NULL,
        amount        INTEGER NOT NULL,
        account_id    TEXT    NOT NULL REFERENCES accounts(id),
        category_id   TEXT             REFERENCES categories(id),
        description   TEXT,
        notes         TEXT,
        frequency     TEXT    NOT NULL,
        next_run_date TEXT    NOT NULL,
        time_of_day   TEXT    NOT NULL DEFAULT '09:00',
        is_active     INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT    NOT NULL,
        updated_at    TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_recurring_next_run_date
        ON recurring_transactions(next_run_date, is_active);
    `);
    await setSchemaVersion(db, 4);
  }
  if (from < 5) {
    await db.execAsync(`
      ALTER TABLE settings ADD COLUMN sms_auto_detect INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE settings ADD COLUMN sms_last_processed_at TEXT;


      CREATE TABLE IF NOT EXISTS sms_transactions (
        id               TEXT    PRIMARY KEY,
        sms_id           TEXT,
        sender           TEXT    NOT NULL,
        raw_body         TEXT    NOT NULL,
        amount           INTEGER NOT NULL,
        type             TEXT    NOT NULL,
        account_type     TEXT    NOT NULL DEFAULT 'bank',
        description      TEXT,
        message_date     TEXT    NOT NULL,
        message_time     TEXT    NOT NULL,
        status           TEXT    NOT NULL DEFAULT 'pending',
        transaction_id   TEXT    REFERENCES transactions(id),
        created_at       TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sms_transactions_status
        ON sms_transactions(status);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_transactions_sms_id
        ON sms_transactions(sms_id) WHERE sms_id IS NOT NULL;
    `);
    await setSchemaVersion(db, 5);
  }
  if (from < 6) {
    await db.execAsync(`ALTER TABLE settings ADD COLUMN privacy_hidden INTEGER NOT NULL DEFAULT 0;`);
    await setSchemaVersion(db, 6);
  }
  if (from < 7) {
    await db.execAsync(`ALTER TABLE transactions ADD COLUMN tag TEXT;`);
    await setSchemaVersion(db, 7);
  }
  if (from < 8) {
    // Collect linked transaction IDs before removing the FK rows
    const smsRows = await db.getAllAsync<{ transaction_id: string }>(
      "SELECT transaction_id FROM sms_transactions WHERE transaction_id IS NOT NULL"
    );
    // Delete child (FK referencing transactions) first
    await db.runAsync("DELETE FROM sms_transactions");
    // Then delete the auto-created transactions
    if (smsRows.length > 0) {
      const placeholders = smsRows.map(() => '?').join(',');
      await db.runAsync(
        `DELETE FROM transactions WHERE id IN (${placeholders})`,
        smsRows.map(r => r.transaction_id)
      );
    }
    await setSchemaVersion(db, 8);
  }
  if (from < 9) {
    await db.execAsync(`ALTER TABLE investments ADD COLUMN account_id TEXT REFERENCES accounts(id);`);
    await db.execAsync(`ALTER TABLE investments ADD COLUMN linked_transaction_id TEXT REFERENCES transactions(id);`);
    await setSchemaVersion(db, 9);
  }
  if (from < 10) {
    await db.execAsync(`ALTER TABLE savings_contributions ADD COLUMN account_id TEXT REFERENCES accounts(id);`);
    await db.execAsync(`ALTER TABLE savings_contributions ADD COLUMN linked_transaction_id TEXT REFERENCES transactions(id);`);
    await setSchemaVersion(db, 10);
  }
  if (from < 11) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS investment_contributions (
        id                     TEXT    PRIMARY KEY,
        investment_id          TEXT    NOT NULL REFERENCES investments(id),
        amount                 INTEGER NOT NULL,
        notes                  TEXT,
        contribution_date      TEXT    NOT NULL,
        account_id             TEXT             REFERENCES accounts(id),
        linked_transaction_id  TEXT             REFERENCES transactions(id),
        created_at             TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_investment_contributions_investment_id
        ON investment_contributions(investment_id);
    `);
    await db.execAsync(`ALTER TABLE recurring_transactions ADD COLUMN savings_goal_id TEXT REFERENCES savings_goals(id);`);
    await db.execAsync(`ALTER TABLE recurring_transactions ADD COLUMN investment_id TEXT REFERENCES investments(id);`);
    await setSchemaVersion(db, 11);
  }
  if (from < 12) {
    const now = new Date().toISOString();
    // New income categories
    const newIncome: [string, string, string, number][] = [
      ['Bonus',       'cash-multiple', '#FFD54F', 6],
      ['Interest',    'bank',          '#26C6DA', 7],
      ['Investments', 'trending-up',   '#42A5F5', 8],
    ];
    for (const [name, icon, color, sort_order] of newIncome) {
      await db.runAsync(
        `INSERT INTO categories (id, name, type, icon, color, is_system, sort_order, created_at)
         SELECT ?, ?, 'income', ?, ?, 1, ?, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM categories WHERE name = ? AND type = 'income' AND is_deleted = 0
         )`,
        [uuidv4(), name, icon, color, sort_order, now, name]
      );
    }
    // New expense categories
    const newExpense: [string, string, string, number][] = [
      ['Groceries',     'cart',          '#4CAF50', 9],
      ['Travel',        'airplane',      '#42A5F5', 10],
      ['Personal Care', 'content-cut',   '#EC407A', 11],
      ['Clothing',      'tshirt-crew',   '#FF7043', 12],
      ['Subscriptions', 'television',    '#26C6DA', 13],
      ['Gym & Fitness', 'dumbbell',      '#66BB6A', 14],
      ['Fuel',          'gas-station',   '#FFA726', 15],
    ];
    for (const [name, icon, color, sort_order] of newExpense) {
      await db.runAsync(
        `INSERT INTO categories (id, name, type, icon, color, is_system, sort_order, created_at)
         SELECT ?, ?, 'expense', ?, ?, 1, ?, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM categories WHERE name = ? AND type = 'expense' AND is_deleted = 0
         )`,
        [uuidv4(), name, icon, color, sort_order, now, name]
      );
    }
    await setSchemaVersion(db, 12);
  }
}

// ─── Schema creation ─────────────────────────────────────────────────────────

async function createSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      id                      INTEGER PRIMARY KEY,
      currency_code           TEXT    NOT NULL DEFAULT 'INR',
      currency_symbol         TEXT    NOT NULL DEFAULT '₹',
      theme                   TEXT    NOT NULL DEFAULT 'system',
      pin_enabled             INTEGER NOT NULL DEFAULT 0,
      pin_hash                TEXT,
      drive_connected         INTEGER NOT NULL DEFAULT 0,
      last_backup_at          TEXT,
      schema_version          INTEGER NOT NULL DEFAULT 1,
      sms_auto_detect         INTEGER NOT NULL DEFAULT 1,
      sms_last_processed_at   TEXT,
      privacy_hidden          INTEGER NOT NULL DEFAULT 0,
      created_at              TEXT    NOT NULL,
      updated_at              TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id              TEXT    PRIMARY KEY,
      name            TEXT    NOT NULL,
      type            TEXT    NOT NULL,
      icon            TEXT,
      color           TEXT,
      opening_balance INTEGER NOT NULL DEFAULT 0,
      is_archived     INTEGER NOT NULL DEFAULT 0,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL,
      updated_at      TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id          TEXT    PRIMARY KEY,
      name        TEXT    NOT NULL,
      type        TEXT    NOT NULL,
      icon        TEXT    NOT NULL,
      color       TEXT    NOT NULL,
      is_system   INTEGER NOT NULL DEFAULT 0,
      is_deleted  INTEGER NOT NULL DEFAULT 0,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id                 TEXT    PRIMARY KEY,
      type               TEXT    NOT NULL,
      amount             INTEGER NOT NULL,
      account_id         TEXT    NOT NULL REFERENCES accounts(id),
      to_account_id      TEXT             REFERENCES accounts(id),
      category_id        TEXT             REFERENCES categories(id),
      description        TEXT,
      notes              TEXT,
      transaction_date   TEXT    NOT NULL,
      transaction_time   TEXT,
      receipt_photo_uri  TEXT,
      is_recurring       INTEGER NOT NULL DEFAULT 0,
      recurrence_rule    TEXT,
      trip_id            TEXT             REFERENCES trips(id),
      tag                TEXT,
      is_deleted         INTEGER NOT NULL DEFAULT 0,
      created_at         TEXT    NOT NULL,
      updated_at         TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id             TEXT    PRIMARY KEY,
      name           TEXT    NOT NULL,
      icon           TEXT,
      color          TEXT,
      target_amount  INTEGER NOT NULL,
      target_date    TEXT,
      is_completed   INTEGER NOT NULL DEFAULT 0,
      is_deleted     INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT    NOT NULL,
      updated_at     TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS savings_contributions (
      id                     TEXT    PRIMARY KEY,
      goal_id                TEXT    NOT NULL REFERENCES savings_goals(id),
      amount                 INTEGER NOT NULL,
      notes                  TEXT,
      contribution_date      TEXT    NOT NULL,
      account_id             TEXT             REFERENCES accounts(id),
      linked_transaction_id  TEXT             REFERENCES transactions(id),
      created_at             TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS investments (
      id                     TEXT    PRIMARY KEY,
      asset_name             TEXT    NOT NULL,
      asset_type             TEXT    NOT NULL,
      amount_invested        INTEGER NOT NULL,
      investment_date        TEXT    NOT NULL,
      notes                  TEXT,
      account_id             TEXT             REFERENCES accounts(id),
      linked_transaction_id  TEXT             REFERENCES transactions(id),
      is_deleted             INTEGER NOT NULL DEFAULT 0,
      created_at             TEXT    NOT NULL,
      updated_at             TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trips (
      id          TEXT    PRIMARY KEY,
      name        TEXT    NOT NULL,
      description TEXT,
      start_date  TEXT,
      end_date    TEXT,
      is_settled  INTEGER NOT NULL DEFAULT 0,
      is_deleted  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL,
      updated_at  TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trip_participants (
      id         TEXT    PRIMARY KEY,
      trip_id    TEXT    NOT NULL REFERENCES trips(id),
      name       TEXT    NOT NULL,
      is_self    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trip_expenses (
      id                      TEXT    PRIMARY KEY,
      trip_id                 TEXT    NOT NULL REFERENCES trips(id),
      paid_by_participant_id  TEXT    NOT NULL REFERENCES trip_participants(id),
      category_id             TEXT             REFERENCES categories(id),
      amount                  INTEGER NOT NULL,
      description             TEXT,
      split_type              TEXT    NOT NULL DEFAULT 'equal',
      expense_date            TEXT    NOT NULL,
      linked_transaction_id   TEXT             REFERENCES transactions(id),
      created_at              TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trip_expense_splits (
      id               TEXT    PRIMARY KEY,
      trip_expense_id  TEXT    NOT NULL REFERENCES trip_expenses(id),
      participant_id   TEXT    NOT NULL REFERENCES trip_participants(id),
      share_amount     INTEGER NOT NULL,
      is_excluded      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id               TEXT    PRIMARY KEY,
      category_id      TEXT    NOT NULL REFERENCES categories(id),
      monthly_limit    INTEGER NOT NULL,
      alert_at_percent INTEGER NOT NULL DEFAULT 80,
      is_active        INTEGER NOT NULL DEFAULT 1,
      created_at       TEXT    NOT NULL,
      updated_at       TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id         TEXT    PRIMARY KEY,
      type       TEXT    NOT NULL,
      title      TEXT    NOT NULL,
      body       TEXT    NOT NULL,
      data       TEXT,
      is_read    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sms_transactions (
      id               TEXT    PRIMARY KEY,
      sms_id           TEXT,
      sender           TEXT    NOT NULL,
      raw_body         TEXT    NOT NULL,
      amount           INTEGER NOT NULL,
      type             TEXT    NOT NULL,
      account_type     TEXT    NOT NULL DEFAULT 'bank',
      description      TEXT,
      message_date     TEXT    NOT NULL,
      message_time     TEXT    NOT NULL,
      status           TEXT    NOT NULL DEFAULT 'pending',
      transaction_id   TEXT    REFERENCES transactions(id),
      created_at       TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id               TEXT    PRIMARY KEY,
      type             TEXT    NOT NULL,
      amount           INTEGER NOT NULL,
      account_id       TEXT    NOT NULL REFERENCES accounts(id),
      category_id      TEXT             REFERENCES categories(id),
      description      TEXT,
      notes            TEXT,
      frequency        TEXT    NOT NULL,
      next_run_date    TEXT    NOT NULL,
      time_of_day      TEXT    NOT NULL DEFAULT '09:00',
      is_active        INTEGER NOT NULL DEFAULT 1,
      savings_goal_id  TEXT             REFERENCES savings_goals(id),
      investment_id    TEXT             REFERENCES investments(id),
      created_at       TEXT    NOT NULL,
      updated_at       TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS investment_contributions (
      id                     TEXT    PRIMARY KEY,
      investment_id          TEXT    NOT NULL REFERENCES investments(id),
      amount                 INTEGER NOT NULL,
      notes                  TEXT,
      contribution_date      TEXT    NOT NULL,
      account_id             TEXT             REFERENCES accounts(id),
      linked_transaction_id  TEXT             REFERENCES transactions(id),
      created_at             TEXT    NOT NULL
    );
  `);
}

// ─── Indexes ─────────────────────────────────────────────────────────────────

async function createIndexes(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_transactions_account_id
      ON transactions(account_id);

    CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date
      ON transactions(transaction_date);

    CREATE INDEX IF NOT EXISTS idx_transactions_category_id
      ON transactions(category_id);

    CREATE INDEX IF NOT EXISTS idx_transactions_type_date
      ON transactions(type, transaction_date);

    CREATE INDEX IF NOT EXISTS idx_transactions_trip_id
      ON transactions(trip_id);

    CREATE INDEX IF NOT EXISTS idx_savings_contributions_goal_id
      ON savings_contributions(goal_id);

    CREATE INDEX IF NOT EXISTS idx_trip_expense_splits_expense_id
      ON trip_expense_splits(trip_expense_id);

    CREATE INDEX IF NOT EXISTS idx_budgets_category_id
      ON budgets(category_id);

    CREATE INDEX IF NOT EXISTS idx_investment_contributions_investment_id
      ON investment_contributions(investment_id);

    CREATE INDEX IF NOT EXISTS idx_recurring_next_run_date
      ON recurring_transactions(next_run_date, is_active);

    CREATE INDEX IF NOT EXISTS idx_sms_transactions_status
      ON sms_transactions(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_transactions_sms_id
      ON sms_transactions(sms_id) WHERE sms_id IS NOT NULL;
  `);
}

// ─── Seed data ───────────────────────────────────────────────────────────────

async function seedDefaults(db: SQLite.SQLiteDatabase): Promise<void> {
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // Settings — always id=1
    await db.runAsync(
      `INSERT OR IGNORE INTO settings
        (id, currency_code, currency_symbol, theme, schema_version, created_at, updated_at)
       VALUES (1, 'INR', '₹', 'dark', ?, ?, ?)`,
      [SCHEMA_VERSION, now, now]
    );

    // Default accounts
    await db.runAsync(
      `INSERT INTO accounts (id, name, type, opening_balance, sort_order, created_at, updated_at)
       VALUES (?, 'Cash', 'cash', 0, 1, ?, ?)`,
      [uuidv4(), now, now]
    );
    await db.runAsync(
      `INSERT INTO accounts (id, name, type, opening_balance, sort_order, created_at, updated_at)
       VALUES (?, 'Bank', 'bank', 0, 0, ?, ?)`,
      [uuidv4(), now, now]
    );

    // Income categories
    const incomeCategories: [string, string, string][] = [
      ['Salary',      'cash-register',   '#00E676'],
      ['Freelance',   'laptop',          '#00BCD4'],
      ['Business',    'briefcase',       '#FF9800'],
      ['Bonus',       'cash-multiple',   '#FFD54F'],
      ['Rental',      'home',            '#9C7EF0'],
      ['Dividends',   'chart-line',      '#F06292'],
      ['Interest',    'bank',            '#26C6DA'],
      ['Investments', 'trending-up',     '#42A5F5'],
      ['Other',       'dots-horizontal', '#A0A0A0'],
    ];

    for (let i = 0; i < incomeCategories.length; i++) {
      const [name, icon, color] = incomeCategories[i];
      await db.runAsync(
        `INSERT INTO categories (id, name, type, icon, color, is_system, sort_order, created_at)
         VALUES (?, ?, 'income', ?, ?, 1, ?, ?)`,
        [uuidv4(), name, icon, color, i, now]
      );
    }

    // Expense categories
    const expenseCategories: [string, string, string][] = [
      ['Food & Dining',    'food',             '#FF6B6B'],
      ['Groceries',        'cart',             '#4CAF50'],
      ['Transport',        'car',              '#FF9800'],
      ['Fuel',             'gas-station',      '#FFA726'],
      ['Housing',          'home-city',        '#9C7EF0'],
      ['Health',           'medical-bag',      '#00E676'],
      ['Gym & Fitness',    'dumbbell',         '#66BB6A'],
      ['Entertainment',    'movie-open',       '#E040FB'],
      ['Subscriptions',    'television',       '#26C6DA'],
      ['Shopping',         'shopping',         '#00BCD4'],
      ['Clothing',         'tshirt-crew',      '#FF7043'],
      ['Personal Care',    'content-cut',      '#EC407A'],
      ['Bills & Utilities','lightning-bolt',   '#FFB74D'],
      ['Education',        'school',           '#2196F3'],
      ['Travel',           'airplane',         '#42A5F5'],
      ['Other',            'dots-horizontal',  '#A0A0A0'],
    ];

    for (let i = 0; i < expenseCategories.length; i++) {
      const [name, icon, color] = expenseCategories[i];
      await db.runAsync(
        `INSERT INTO categories (id, name, type, icon, color, is_system, sort_order, created_at)
         VALUES (?, ?, 'expense', ?, ?, 1, ?, ?)`,
        [uuidv4(), name, icon, color, i, now]
      );
    }
  });
}

// ─── Settings helpers (used app-wide) ────────────────────────────────────────

export async function getSettings() {
  const db = await getDb();
  return db.getFirstAsync<{
    currency_code: string;
    currency_symbol: string;
    theme: string;
    pin_enabled: number;
    pin_hash: string | null;
    drive_connected: number;
    last_backup_at: string | null;
    schema_version: number;
    sms_auto_detect: number;
    sms_last_processed_at: string | null;
    privacy_hidden: number;
  }>('SELECT * FROM settings WHERE id = 1');
}

export async function updateSettings(fields: Record<string, string | number | null>): Promise<void> {
  const db = await getDb();
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const now = new Date().toISOString();
  const setClause = [...keys.map(k => `${k} = ?`), 'updated_at = ?'].join(', ');
  const values = [...Object.values(fields), now];
  await db.runAsync(`UPDATE settings SET ${setClause} WHERE id = 1`, values);
}

export async function clearAllUserData(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    // Delete in child-before-parent order to satisfy FK constraints
    await db.runAsync('DELETE FROM trip_expense_splits');
    await db.runAsync('DELETE FROM trip_expenses');
    await db.runAsync('DELETE FROM sms_transactions');
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM trip_participants');
    await db.runAsync('DELETE FROM trips');
    await db.runAsync('DELETE FROM recurring_transactions');
    await db.runAsync('DELETE FROM budgets');
    await db.runAsync('DELETE FROM savings_contributions');
    await db.runAsync('DELETE FROM savings_goals');
    await db.runAsync('DELETE FROM accounts');
    await db.runAsync('DELETE FROM categories WHERE is_system = 0');
    await db.runAsync('DELETE FROM investments');
    await db.runAsync('DELETE FROM notifications');
    await db.runAsync(
      `UPDATE settings SET pin_enabled = 0, pin_hash = NULL, last_backup_at = NULL WHERE id = 1`
    );
  });
}

export async function ensureDefaultAccounts(): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM accounts');
  if ((row?.count ?? 0) > 0) return;
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO accounts (id, name, type, opening_balance, sort_order, created_at, updated_at)
       VALUES (?, 'Bank', 'bank', 0, 0, ?, ?)`,
      [uuidv4(), now, now]
    );
    await db.runAsync(
      `INSERT INTO accounts (id, name, type, opening_balance, sort_order, created_at, updated_at)
       VALUES (?, 'Cash', 'cash', 0, 1, ?, ?)`,
      [uuidv4(), now, now]
    );
  });
}
