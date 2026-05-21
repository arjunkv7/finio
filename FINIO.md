

| FINIO Personal Finance Tracker Development Plan & Technical Documentation |
| :---: |

| Document Version | v1.0 — Initial Release |
| :---- | :---- |
| **Platform** | iOS & Android (React Native \+ Expo) |
| **Storage** | Local SQLite \+ Google Drive backup |
| **Default Currency** | INR (user-selectable) |
| **Total Features** | 46 features across 9 modules |

| 1\. Project Overview |
| :---- |

## **1.1 Purpose**

Finio is a local-first mobile application for personal finance tracking. It enables users to log income, expenses, savings goals, and investments across multiple accounts. All data is stored on the device using SQLite with optional backup and restore via the user's own Google Drive account. No backend server or cloud database is required.

## **1.2 Core Principles**

* Privacy first — all data stays on the user's device

* No subscription or server cost — free to run forever

* Fast and offline — works without internet connection

* Simple UX — any transaction logged in under 10 seconds

* Exportable — data available as Excel, PDF, or CSV at any time

## **1.3 Technology Stack**

| Layer | Technology | Purpose |
| :---- | :---- | :---- |
| Mobile Framework | React Native \+ Expo | Single codebase for iOS & Android |
| Local Database | SQLite via expo-sqlite | On-device data storage |
| Navigation | React Navigation v6 | Tab & stack navigation |
| Charts | Victory Native / Recharts | Dashboard visualisations |
| Excel Export | SheetJS (xlsx) | Generate .xlsx on device |
| PDF Export | react-native-html-to-pdf | Generate PDF reports |
| Google Drive | expo-auth-session \+ Drive REST API | Backup & restore |
| State Management | Zustand or Context API | Global app state |
| UI Components | Custom \+ React Native Paper | Design system |

| 2\. Feature List |
| :---- |

All 46 features are grouped into 9 modules and delivered across 3 phases. Phase 1 (MVP) targets core data entry and the home dashboard. Phase 2 adds reporting, exports, and the trip expense tracker. Phase 3 delivers Google Drive backup and restore.

| Phase 1 — MVP (Weeks 1-8) | Phase 2 — Reports (Weeks 9-16) | Phase 3 — Drive Sync (Weeks 17-18) |
| :---: | :---: | :---: |

### **2.1 Complete Feature Matrix**

| Module | Feature | Description | Phase |
| :---- | :---- | :---- | :---- |
| Accounts | Create accounts | Name, type (bank/cash/wallet/credit), opening balance | Phase 1 |
|  | Account balances | Live balance calculated from all transactions | Phase 1 |
|  | Transfer between accounts | Move funds; no income/expense impact on reports | Phase 1 |
|  | Account-level reports | Filter transactions and summaries by account | Phase 2 |
|  | Edit & archive accounts | Rename, change icon, archive closed accounts | Phase 1 |
| Income | Add income entry | Amount, source, account, date, category, notes | Phase 1 |
|  | Income categories | Salary, freelance, business, rental, dividends, other | Phase 1 |
|  | Recurring income | Mark as monthly/weekly, auto-remind to log | Phase 2 |
|  | Edit & delete | Update or remove any income entry | Phase 1 |
| Expenses | Add expense entry | Amount, category, account, date, merchant, notes | Phase 1 |
|  | Expense categories | Food, transport, housing, health, entertainment, shopping, bills, education, other | Phase 1 |
|  | Custom categories | Add, rename, recolour, delete categories | Phase 1 |
|  | Recurring expenses | Subscriptions, rent, EMI — monthly reminders | Phase 2 |
|  | Receipt photo | Attach photo from camera or gallery | Phase 2 |
|  | Monthly budget per category | Set limit, progress bar, alert at 80% and 100% | Phase 2 |
| Savings | Savings goals | Name, target amount, target date | Phase 1 |
|  | Log contributions | Add deposits toward each goal | Phase 1 |
|  | Progress tracker | Progress bar, % complete, days remaining | Phase 1 |
|  | Savings rate | % of income saved this month and year | Phase 2 |
| Investments | Log investment entry | Asset name, type, amount invested, date, notes | Phase 1 |
|  | Investment history & total | List of all entries, total amount invested to date | Phase 1 |
| Trip & Group | Create a trip / event | Name, dates, description (Goa trip, office party, etc.) | Phase 2 |
| Expenses | Add participants | Add names of people in the group (no account needed) | Phase 2 |
|  | Log trip expenses | Amount, category, paid by (which person), date, notes | Phase 2 |
|  | Split options | Equal split, custom amounts, percentage, exclude members | Phase 2 |
|  | Settlement summary | Who owes whom — simplified settlement breakdown | Phase 2 |
|  | Trip total & per-person cost | Total spent, each person's share, category breakdown | Phase 2 |
|  | Export trip summary | Share trip breakdown as PDF or shareable image | Phase 2 |
| Dashboard & | Home dashboard | Net balance, monthly snapshot, account balances, recent transactions | Phase 1 |
| Reports | Monthly summary | Total in, total out, savings, top spending categories | Phase 1 |
|  | Category breakdown | Donut chart — expenses by category | Phase 2 |
|  | Income vs expense trend | Bar chart — last 6 or 12 months | Phase 2 |
|  | Net worth snapshot | Total assets (accounts \+ investments) | Phase 2 |
|  | Annual report | Full year summary, month-by-month breakdown | Phase 2 |
|  | Filter & search | By type, category, account, date range, amount | Phase 1 |
| Export & | Export to Excel (.xlsx) | Transactions \+ monthly summary \+ charts | Phase 2 |
| Backup | Export to CSV | Raw transaction data, all or filtered | Phase 2 |
|  | Export to PDF | Monthly or annual summary report | Phase 2 |
|  | Google Drive backup | Save full data as JSON to user's own Drive folder | Phase 3 |
|  | Restore from Drive | Pick backup file, restore all data on new device | Phase 3 |
| App & Settings | Currency selector | Default INR, user can change to any currency | Phase 1 |
|  | Light / dark theme | Toggle or follow system setting | Phase 1 |
|  | App lock / PIN | PIN or biometric lock on open | Phase 2 |
|  | Notifications & reminders | Daily log reminder, budget alerts | Phase 2 |
|  | Manage categories | Add, edit, delete income and expense categories | Phase 1 |
|  | Data wipe / reset | Clear all data with confirmation prompt | Phase 1 |

| 3\. Development Plan |
| :---- |

## **3.1 Phase 1 — MVP (Weeks 1–8)**

| Goal Ship a fully functional app where users can add income, expenses, savings, and investments across multiple accounts and view a basic home dashboard. This is the foundation everything else builds on. |
| :---- |

| Week | Focus | Deliverables |
| :---- | :---- | :---- |
| 1–2 | Project setup & DB | Expo project scaffold, SQLite schema, navigation shell, settings screen |
| 3 | Accounts module | Create/edit/archive accounts, account list, balance calculation |
| 4 | Income & Expense entry | Add transaction form (income \+ expense), category picker, account selector |
| 5 | Savings & Investments | Goals screen, contribution logging, investment log |
| 6 | Home dashboard | Net balance card, monthly summary, account balances, recent transactions list |
| 7 | Transaction history | List view, filter chips (All/Income/Expense/Savings/Investment), search |
| 8 | Polish & testing | Category management, data wipe, currency settings, theme toggle, bug fixes |

## **3.2 Phase 2 — Reports, Export & Trips (Weeks 9–16)**

| Goal Add intelligence and utility — charts, budgets, recurring entries, trip expense tracking with bill splitting, and export to Excel / PDF / CSV. |
| :---- |

| Week | Focus | Deliverables |
| :---- | :---- | :---- |
| 9–10 | Reports & charts | Monthly summary screen, category donut chart, income vs expense bar chart (6/12 month) |
| 11 | Budgets & alerts | Monthly budget per category, progress bars, push notification at 80% and 100% |
| 12 | Recurring entries | Mark income/expense as recurring, reminder notifications, auto-populate option |
| 13–14 | Trip expense tracker | Create trip, add participants, log expenses, split logic, settlement summary |
| 15 | Export — Excel & CSV | SheetJS integration, transactions sheet, monthly summary sheet, CSV export |
| 16 | Export — PDF & annual report | HTML-to-PDF report, annual summary, app lock / PIN, receipt photos |

## **3.3 Phase 3 — Google Drive Sync (Weeks 17–18)**

| Goal Allow users to back up their entire database to their own Google Drive and restore it on a new device. No user data ever touches Finio servers. |
| :---- |

| Week | Focus | Deliverables |
| :---- | :---- | :---- |
| 17 | Google OAuth & Drive API | expo-auth-session setup, Drive scope consent, connect/disconnect in settings |
| 18 | Backup & restore | Export full DB as JSON to Drive, restore picker, last backup date display |

## **3.4 App Screens Summary**

| Screen | Key Elements |
| :---- | :---- |
| Home / Dashboard | Net balance, monthly income vs expense, account cards, recent transactions, quick-add FAB |
| Add Transaction | Type tabs (Income/Expense/Savings/Investment), amount input, category, account, date, notes |
| Transaction History | Filter chips, search bar, grouped by date, swipe to edit/delete |
| Accounts | Account cards with balances, transfer button, add/edit account |
| Reports | Monthly picker, bar chart, donut chart, key stats, budget progress |
| Savings Goals | Goal cards with progress bars, days remaining, add contribution |
| Investments | Investment log list, total invested summary, add entry |
| Trips | Trip list, trip detail with expense list, split summary, settlement screen |
| Export | Export buttons (Excel/PDF/CSV), Drive backup status, last backup date |
| Settings | Currency, theme, categories, app lock, Drive link, data wipe |

| 4\. Database Design (SQLite) |
| :---- |

All data is stored locally using SQLite via the expo-sqlite library. The schema is designed to be normalised, efficient for mobile, and exportable as a single JSON backup file for Google Drive.

| Design Decisions All monetary amounts are stored as integers (paise/smallest unit) to avoid floating-point precision errors. Timestamps are stored as ISO 8601 strings. Soft deletes use an is\_deleted flag to preserve history integrity. |
| :---- |

## **4.1 settings**

Stores user preferences. Single row, key-value style.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | INTEGER | PRIMARY KEY | Always 1 (single row) |
| currency\_code | TEXT | NOT NULL DEFAULT "INR" | ISO 4217 currency code |
| currency\_symbol | TEXT | NOT NULL DEFAULT "₹" | Display symbol |
| theme | TEXT | DEFAULT "system" | "light" | "dark" | "system" |
| pin\_enabled | INTEGER | DEFAULT 0 | 0 \= off, 1 \= PIN, 2 \= biometric |
| pin\_hash | TEXT | NULLABLE | Hashed PIN value |
| drive\_connected | INTEGER | DEFAULT 0 | 1 if Drive is linked |
| last\_backup\_at | TEXT | NULLABLE | ISO 8601 timestamp of last backup |
| created\_at | TEXT | NOT NULL | ISO 8601 creation timestamp |
| updated\_at | TEXT | NOT NULL | ISO 8601 last updated timestamp |

## **4.2 accounts**

Represents a financial account such as a bank account, cash wallet, credit card, or digital wallet.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL | Account name (e.g. "HDFC Savings") |
| type | TEXT | NOT NULL | "bank" | "cash" | "wallet" | "credit" | "other" |
| icon | TEXT | NULLABLE | Icon identifier for UI display |
| color | TEXT | NULLABLE | Hex color string for UI display |
| opening\_balance | INTEGER | NOT NULL DEFAULT 0 | Opening balance in paise (smallest unit) |
| is\_archived | INTEGER | NOT NULL DEFAULT 0 | 1 if account is archived/closed |
| sort\_order | INTEGER | NOT NULL DEFAULT 0 | Display order on accounts screen |
| created\_at | TEXT | NOT NULL | ISO 8601 creation timestamp |
| updated\_at | TEXT | NOT NULL | ISO 8601 last updated timestamp |

## **4.3 categories**

User-defined and system default categories for income and expense transactions.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL | Category name (e.g. "Food & Dining") |
| type | TEXT | NOT NULL | "income" | "expense" |
| icon | TEXT | NOT NULL | Icon identifier |
| color | TEXT | NOT NULL | Hex color string |
| is\_system | INTEGER | NOT NULL DEFAULT 0 | 1 \= built-in category (cannot delete) |
| is\_deleted | INTEGER | NOT NULL DEFAULT 0 | Soft delete flag |
| sort\_order | INTEGER | NOT NULL DEFAULT 0 | Display order in category picker |
| created\_at | TEXT | NOT NULL | ISO 8601 creation timestamp |

## **4.4 transactions**

The core table. Records every income and expense entry across all accounts.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | TEXT | PRIMARY KEY | UUID v4 |
| type | TEXT | NOT NULL | "income" | "expense" | "transfer" |
| amount | INTEGER | NOT NULL | Amount in paise (multiply display by 100\) |
| account\_id | TEXT | NOT NULL, FK → accounts.id | Source account for this transaction |
| to\_account\_id | TEXT | NULLABLE, FK → accounts.id | Destination account (transfers only) |
| category\_id | TEXT | NULLABLE, FK → categories.id | Null for transfer type |
| description | TEXT | NULLABLE | Merchant name or note |
| notes | TEXT | NULLABLE | Additional notes |
| transaction\_date | TEXT | NOT NULL | Date of transaction (YYYY-MM-DD) |
| receipt\_photo\_uri | TEXT | NULLABLE | Local file URI for receipt image |
| is\_recurring | INTEGER | NOT NULL DEFAULT 0 | 1 if this is a recurring template |
| recurrence\_rule | TEXT | NULLABLE | "monthly" | "weekly" | "yearly" |
| trip\_id | TEXT | NULLABLE, FK → trips.id | Set if expense belongs to a trip |
| is\_deleted | INTEGER | NOT NULL DEFAULT 0 | Soft delete flag |
| created\_at | TEXT | NOT NULL | ISO 8601 creation timestamp |
| updated\_at | TEXT | NOT NULL | ISO 8601 last updated timestamp |

## **4.5 savings\_goals**

Savings goals that users are working toward (holiday fund, emergency fund, etc.).

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL | Goal name (e.g. "Goa Holiday Fund") |
| icon | TEXT | NULLABLE | Icon identifier |
| color | TEXT | NULLABLE | Hex color for progress bar |
| target\_amount | INTEGER | NOT NULL | Target in paise |
| target\_date | TEXT | NULLABLE | Target completion date (YYYY-MM-DD) |
| is\_completed | INTEGER | NOT NULL DEFAULT 0 | 1 when goal is reached |
| is\_deleted | INTEGER | NOT NULL DEFAULT 0 | Soft delete flag |
| created\_at | TEXT | NOT NULL | ISO 8601 creation timestamp |
| updated\_at | TEXT | NOT NULL | ISO 8601 last updated timestamp |

## **4.6 savings\_contributions**

Individual deposits made toward a savings goal.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | TEXT | PRIMARY KEY | UUID v4 |
| goal\_id | TEXT | NOT NULL, FK → savings\_goals.id | Parent goal |
| amount | INTEGER | NOT NULL | Contribution amount in paise |
| notes | TEXT | NULLABLE | Optional note for this deposit |
| contribution\_date | TEXT | NOT NULL | Date of contribution (YYYY-MM-DD) |
| created\_at | TEXT | NOT NULL | ISO 8601 creation timestamp |

## **4.7 investments**

A log of investment entries. Amount only — no live value tracking.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | TEXT | PRIMARY KEY | UUID v4 |
| asset\_name | TEXT | NOT NULL | Name of asset (e.g. "Zerodha — Nifty 50 ETF") |
| asset\_type | TEXT | NOT NULL | "stocks" | "mutual\_fund" | "crypto" | "fixed\_deposit" | "gold" | "real\_estate" | "other" |
| amount\_invested | INTEGER | NOT NULL | Amount invested in paise |
| investment\_date | TEXT | NOT NULL | Date of investment (YYYY-MM-DD) |
| notes | TEXT | NULLABLE | Optional notes |
| is\_deleted | INTEGER | NOT NULL DEFAULT 0 | Soft delete flag |
| created\_at | TEXT | NOT NULL | ISO 8601 creation timestamp |
| updated\_at | TEXT | NOT NULL | ISO 8601 last updated timestamp |

## **4.8 trips**

A trip or group event for shared expense tracking (e.g. Goa trip, office party, road trip).

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL | Trip name (e.g. "Goa Trip Jan 2026") |
| description | TEXT | NULLABLE | Optional description |
| start\_date | TEXT | NULLABLE | Trip start date (YYYY-MM-DD) |
| end\_date | TEXT | NULLABLE | Trip end date (YYYY-MM-DD) |
| is\_settled | INTEGER | NOT NULL DEFAULT 0 | 1 when all balances are cleared |
| is\_deleted | INTEGER | NOT NULL DEFAULT 0 | Soft delete flag |
| created\_at | TEXT | NOT NULL | ISO 8601 creation timestamp |
| updated\_at | TEXT | NOT NULL | ISO 8601 last updated timestamp |

## **4.9 trip\_participants**

Members of a trip. No user account needed — just a name.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | TEXT | PRIMARY KEY | UUID v4 |
| trip\_id | TEXT | NOT NULL, FK → trips.id | Parent trip |
| name | TEXT | NOT NULL | Participant name (e.g. "Raj", "Priya") |
| is\_self | INTEGER | NOT NULL DEFAULT 0 | 1 if this participant is the app user |
| created\_at | TEXT | NOT NULL | ISO 8601 creation timestamp |

## **4.10 trip\_expenses**

An expense logged within a trip, paid by one participant and split among others.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | TEXT | PRIMARY KEY | UUID v4 |
| trip\_id | TEXT | NOT NULL, FK → trips.id | Parent trip |
| paid\_by\_participant\_id | TEXT | NOT NULL, FK → trip\_participants.id | Who paid this expense |
| category\_id | TEXT | NULLABLE, FK → categories.id | Expense category |
| amount | INTEGER | NOT NULL | Total amount in paise |
| description | TEXT | NULLABLE | What was this expense for |
| split\_type | TEXT | NOT NULL DEFAULT "equal" | "equal" | "custom" | "percentage" |
| expense\_date | TEXT | NOT NULL | Date of expense (YYYY-MM-DD) |
| linked\_transaction\_id | TEXT | NULLABLE, FK → transactions.id | If logged to personal accounts too |
| created\_at | TEXT | NOT NULL | ISO 8601 creation timestamp |

## **4.11 trip\_expense\_splits**

The individual share of each participant for a given trip expense.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | TEXT | PRIMARY KEY | UUID v4 |
| trip\_expense\_id | TEXT | NOT NULL, FK → trip\_expenses.id | Parent expense |
| participant\_id | TEXT | NOT NULL, FK → trip\_participants.id | Participant owing this share |
| share\_amount | INTEGER | NOT NULL | This participant's share in paise |
| is\_excluded | INTEGER | NOT NULL DEFAULT 0 | 1 if participant is excluded from this split |

## **4.12 budgets**

Monthly spending limits set per expense category.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | TEXT | PRIMARY KEY | UUID v4 |
| category\_id | TEXT | NOT NULL, FK → categories.id | Category this budget applies to |
| monthly\_limit | INTEGER | NOT NULL | Monthly limit in paise |
| alert\_at\_percent | INTEGER | NOT NULL DEFAULT 80 | Send alert when % of budget used |
| is\_active | INTEGER | NOT NULL DEFAULT 1 | 1 if budget is active |
| created\_at | TEXT | NOT NULL | ISO 8601 creation timestamp |
| updated\_at | TEXT | NOT NULL | ISO 8601 last updated timestamp |

## **4.13 Entity Relationship Summary**

| Key Relationships accounts (1) → transactions (many) via account\_id and to\_account\_idcategories (1) → transactions (many) via category\_idsavings\_goals (1) → savings\_contributions (many) via goal\_idtrips (1) → trip\_participants (many) via trip\_idtrips (1) → trip\_expenses (many) via trip\_idtrip\_expenses (1) → trip\_expense\_splits (many) via trip\_expense\_idcategories (1) → budgets (many) via category\_idtransactions optionally links to trips via trip\_id (for personal account logging) |
| :---- |

## **4.14 Indexes**

The following indexes are recommended for performance on common queries:

| Index | Purpose |
| :---- | :---- |
| transactions(account\_id) | Fast balance calculation per account |
| transactions(transaction\_date) | Monthly/date range filtering |
| transactions(category\_id) | Category breakdown reports |
| transactions(type, transaction\_date) | Monthly income vs expense charts |
| transactions(trip\_id) | Trip expense lookups |
| savings\_contributions(goal\_id) | Goal progress calculation |
| trip\_expense\_splits(trip\_expense\_id) | Settlement calculation |
| budgets(category\_id) | Budget progress per category |

| 5\. Backup, Export & Data Structure |
| :---- |

## **5.1 Google Drive Backup Format**

The backup is a single JSON file named finio\_backup\_YYYY-MM-DD.json saved in a "Finio" folder in the user's Google Drive. It contains all tables serialised as arrays of objects.

| Backup file structure finio\_backup\_2026-05-19.json contains:{ "version": "1.0", "exported\_at": "2026-05-19T10:30:00Z", "settings": {...}, "accounts": \[...\], "categories": \[...\], "transactions": \[...\], "savings\_goals": \[...\], "savings\_contributions": \[...\], "investments": \[...\], "trips": \[...\], "trip\_participants": \[...\], "trip\_expenses": \[...\], "trip\_expense\_splits": \[...\], "budgets": \[...\] } |
| :---- |

## **5.2 Excel Export Structure**

| Sheet | Contents |
| :---- | :---- |
| Transactions | All transactions: date, type, category, account, amount, notes |
| Monthly Summary | Income, expenses, savings per month for the selected year |
| By Category | Total spent per expense category for selected period |
| Savings Goals | Goal name, target, contributed, % complete, days left |
| Investments | Asset name, type, amount, date, notes |
| Accounts | Account name, type, opening balance, current balance |

| 6\. Milestones & Risk Register |
| :---- |

## **6.1 Key Milestones**

| Week | Milestone | Success Criteria | Phase |
| :---- | :---- | :---- | :---- |
| 2 | DB schema live | All 12 tables created, seed data loads | Phase 1 |
| 4 | Transaction entry working | Add income and expense, appears in history | Phase 1 |
| 6 | Dashboard live | Correct balance, monthly figures shown | Phase 1 |
| 8 | MVP complete | All Phase 1 features pass QA on iOS and Android | Phase 1 |
| 12 | Reports & budgets | Charts render, budget alerts fire correctly | Phase 2 |
| 14 | Trip tracker | Create trip, split expense, see correct settlement | Phase 2 |
| 16 | Exports working | Excel, PDF, CSV download and open correctly | Phase 2 |
| 18 | Drive sync live | Backup saves to Drive, restore works on fresh install | Phase 3 |

## **6.2 Risk Register**

| Risk | Severity | Likelihood | Mitigation |
| :---- | :---- | :---- | :---- |
| SQLite migration issues when schema changes | High | Medium | Write migration scripts from day one; version the DB schema |
| Google Drive OAuth complexity on both platforms | Medium | Medium | Use expo-auth-session; build Drive module in Phase 3 with buffer time |
| SheetJS Excel file size on low-end devices | Low | Low | Limit export to last 12 months by default; allow full export optionally |
| Split calculation edge cases in trip tracker | Medium | Medium | Unit test all split types (equal, custom, percentage, exclude) |
| Biometric/PIN lock platform differences | Low | Medium | Use expo-local-authentication which abstracts both platforms |
| Data loss if user uninstalls before backup | High | Medium | Prompt user to enable Drive backup on first launch; show backup reminder |

| Document End This document covers the complete development plan and database design for Finio v1. Further documents will cover UI component design, API integration guides (for Drive), and the test plan. |
| :---- |

