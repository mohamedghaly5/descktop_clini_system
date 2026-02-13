import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import crypto from 'crypto';
// @ts-ignore
import { up as migrateClinics } from './migrations/001_clinics_migration.js';
// @ts-ignore
import { up as migrateDomainV2 } from './migrations/002_domain_v2_migration.js';
// @ts-ignore
import { up as migratePayments } from './migrations/003_add_payments_charting.js';
// @ts-ignore
import { up as migrateUsers } from './migrations/004_create_users.js';
// @ts-ignore
import { up as migrateAppMeta } from './migrations/005_app_meta.js';
// @ts-ignore
import { up as migrateExpenses } from './migrations/006_create_expenses.js';
// @ts-ignore
import { up as migrateLabManagement } from './migrations/007_lab_management.js';
// @ts-ignore
import { up as migrateMultipleLabs } from './migrations/008_multiple_labs.js';
// @ts-ignore
import { up as migrateLabGeneralPayments } from './migrations/009_lab_general_payments.js';
// @ts-ignore
import { up as migrateFixAttachments } from './migrations/010_fix_attachments.js';
// @ts-ignore
import { up as migrateFixAttachmentsFK } from './migrations/011_fix_attachments_fk.js';
// @ts-ignore
import { up as migrateCleanupLegacy } from './migrations/012_cleanup_legacy.js';
// @ts-ignore
import { up as migrateForceCleanup } from './migrations/013_force_cleanup.js';
// @ts-ignore
import { up as migrateStockManagement } from './migrations/014_stock_management.js';
// @ts-ignore
import { up as migrateUnifySettings } from './migrations/015_unify_settings.js';
// @ts-ignore
import { up as migrateStockCategories } from './migrations/016_stock_categories.js';
// @ts-ignore
import { up as migrateRemoveLabExpectedDate } from './migrations/017_remove_lab_expected_date.js';
// @ts-ignore
import { up as migrateSoftDelete } from './migrations/018_add_soft_delete.js';

let db: Database.Database | null = null;

// ...


let isOpen = false;

export async function openDatabase(): Promise<Database.Database> {
  if (db && isOpen) return db;

  const dbPath = path.join(app.getPath('userData'), 'dental.db');
  console.log('[DB] Opening connection to:', dbPath);

  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    isOpen = true;
    console.log('[DB] Connection opened successfully');
    return db;
  } catch (error) {
    console.error('[DB] Failed to open database:', error);
    isOpen = false;
    throw error;
  }
}

export function getDb(): Database.Database {
  if (!db || !isOpen) {
    // Attempt synchronous reopen if possible, or throw
    try {
      const dbPath = path.join(app.getPath('userData'), 'dental.db');
      if (!db) {
        console.warn('[DB] Connection was closed/null. Reopening synchronously...');
        db = new Database(dbPath);
        isOpen = true;
        console.log('[DB] Reopened synchronously.');
      } else if (!db.open) {
        console.warn('[DB] Connection found closed property. Reopening...');
        db = new Database(dbPath);
        isOpen = true;
      }
    } catch (e) {
      console.error('[DB] CRITICAL: Failed to synchronous reopen:', e);
      throw new Error('The database connection is not open and cannot be reopened.');
    }
  }
  return db!;
}

export function ensureDbOpen() {
  if (!db || !isOpen) {
    throw new Error('DB_NOT_OPEN');
  }
}


function runMigrations(database: Database.Database) {
  try {
    // Ensure migration tracking table
    database.exec('CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT)');

    const row = database.prepare("SELECT value FROM app_meta WHERE key = 'last_migration'").get() as { value: string };
    const lastMigration = row ? parseInt(row.value) : 0;

    // Migration 1: Clinics Table
    if (lastMigration < 1) {
      console.log('Running Migration 001: Clinics Table...');
      migrateClinics(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '1')").run();
    }

    // Migration 2: Domain V2 (Clinic ID)
    if (lastMigration < 2) {
      console.log('Running Migration 002: Domain V2 (Clinic ID)...');
      migrateDomainV2(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '2')").run();
    }

    // Migration 3: Payments & Charting
    if (lastMigration < 3) {
      console.log('Running Migration 003: Payments & Charting...');
      migratePayments(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '3')").run();
    }

    // Migration 4: Users
    if (lastMigration < 4) {
      console.log('Running Migration 004: Users...');
      migrateUsers(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '4')").run();
    }

    // Migration 5: App Meta
    if (lastMigration < 5) {
      console.log('Running Migration 005: App Meta...');
      migrateAppMeta(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '5')").run();
    }

    // Migration 6: Expenses
    if (lastMigration < 6) {
      console.log('Running Migration 006: Expenses...');
      migrateExpenses(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '6')").run();
    }

    // Migration 7: Lab Management
    if (lastMigration < 7) {
      console.log('Running Migration 007: Lab Management...');
      migrateLabManagement(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '7')").run();
    }

    // Migration 8: Multiple Labs
    if (lastMigration < 8) {
      console.log('Running Migration 008: Multiple Labs...');
      migrateMultipleLabs(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '8')").run();
    }



    // ...

    // Migration 9: Lab General Payments
    if (lastMigration < 9) {
      console.log('Running Migration 009: Lab General Payments...');
      migrateLabGeneralPayments(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '9')").run();
    }

    // Migration 10: Fix Attachments
    if (lastMigration < 10) {
      console.log('Running Migration 010: Fix Attachments...');
      migrateFixAttachments(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '10')").run();
    }

    // Migration 11: Fix Attachments FK (Legacy Table Issue)
    if (lastMigration < 11) {
      console.log('Running Migration 011: Fix Attachments FK...');
      migrateFixAttachmentsFK(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '11')").run();
    }

    // Migration 12: Cleanup Legacy Tables
    if (lastMigration < 12) {
      console.log('Running Migration 012: Cleanup Legacy Tables...');
      migrateCleanupLegacy(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '12')").run();
    }

    // Migration 13: Force Cleanup (Retry)
    if (lastMigration < 13) {
      console.log('Running Migration 013: Force Cleanup...');
      migrateForceCleanup(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '13')").run();
    }

    // Migration 14: Stock Management
    if (lastMigration < 14) {
      console.log('Running Migration 014: Stock Management...');
      migrateStockManagement(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '14')").run();
    }

    // Migration 15: Unify Settings (Fix Reverting Issue)
    if (lastMigration < 15) {
      console.log('Running Migration 015: Unify Settings...');
      migrateUnifySettings(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '15')").run();
    }

    // Migration 16: Stock Categories
    // Logic updated to "Repair" if table is missing, even if migration version says 16
    const stockCategoriesTable = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_categories'").get();
    if (lastMigration < 16 || !stockCategoriesTable) {
      console.log('Running Migration 016 (or Repair): Stock Categories...');
      try {
        migrateStockCategories(database);
        database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '16')").run();
        console.log('Migration 016 completed.');
      } catch (err: any) {
        // Ignore "table already exists" error if we are repairing mixed state
        if (!err.message.includes('already exists')) {
          throw err;
        }
      }
    }


    // Migration 17: Remove Lab Expected Date
    if (lastMigration < 17) {
      console.log('Running Migration 017: Remove Lab Expected Date...');
      migrateRemoveLabExpectedDate(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '17')").run();
    }

    // Migration 18: Add Soft Delete Columns
    if (lastMigration < 18) {
      console.log('Running Migration 018: Add Soft Delete Columns...');
      migrateSoftDelete(database);
      database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_migration', '18')").run();
    }


    // Repair: Notifications Table
    const notificationsTable = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'").get();
    if (!notificationsTable) {
      console.log('Creating Notifications Table...');
      database.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            clinic_id TEXT NOT NULL,
            user_id TEXT,
            title TEXT NOT NULL,
            message TEXT,
            type TEXT DEFAULT 'info',
            is_read BOOLEAN DEFAULT 0,
            link TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Notifications Table Created.');
    }

  } catch (e) {

    console.error('Migration Error:', e);
  }
}

// ...




export function closeConnection() {
  try {
    if (db && db.open) {
      db.close();
      db = null; // Reset so getDb reopens it
      console.log('Database connection closed.');
    }
  } catch (err) {
    console.error('Error closing database:', err);
  }
}

// --- Pre-Migration Safety Layer ---

export function createPreMigrationBackup() {
  try {
    const dbPath = path.join(app.getPath('userData'), 'dental.db');
    if (!fs.existsSync(dbPath)) return; // No DB to backup

    const backupDir = path.join(app.getPath('userData'), 'backups', 'system');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = Date.now();
    const backupName = `clinic_pre_migration_${timestamp}.db`;
    const backupPath = path.join(backupDir, backupName);

    // Using copyFileSync for atomic-like local copy
    console.log(`Creating pre-migration backup at: ${backupPath}`);
    fs.copyFileSync(dbPath, backupPath);
    return backupPath;
  } catch (error) {
    console.error('Failed to create pre-migration backup:', error);
    throw error; // Critical failure
  }
}

export function setSystemReadOnly(isReadOnly: boolean) {
  const database = getDb();
  // Ensure table exists
  database.exec('CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT)');

  const stmt = database.prepare('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)');
  stmt.run('migration_lock', isReadOnly ? 'true' : 'false');
  console.log(`System Read-Only Mode set to: ${isReadOnly}`);
}

export function isSystemReadOnly(): boolean {
  try {
    const database = getDb();
    // Check if table exists first to avoid error on fresh start before init
    const tableExists = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_meta'").get();
    if (!tableExists) return false;

    const row = database.prepare("SELECT value FROM app_meta WHERE key = 'migration_lock'").get() as { value: string };
    return row?.value === 'true';
  } catch (error) {
    console.error('Error checking system read-only status:', error);
    return false;
  }
}

// ----------------------------------

export async function initializeDatabase() {
  try {
    const database = await openDatabase();

    // Run Migrations FIRST
    runMigrations(database);


    // Initialize app_meta logic for Multi-Tenancy / Clinic ID
    try {
      const meta = database.prepare("SELECT value FROM app_meta WHERE key = 'current_clinic_id'").get() as { value: string };
      if (!meta) {
        // Auto-detect if single clinic
        const clinics = database.prepare('SELECT id FROM clinics').all() as { id: string }[];
        if (clinics.length === 1) {
          const clinicId = clinics[0].id;
          console.log(`[Init] Auto-detected single clinic. Setting current_clinic_id = ${clinicId}`);
          database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('current_clinic_id', ?)").run(clinicId);
        } else if (clinics.length === 0) {
          console.log('[Init] No clinics found in V2 table. Waiting for setup/migration.');
        } else {
          console.log('[Init] Multiple clinics found. Waiting for explicit selection (not auto-setting).');
        }
      }
    } catch (e) {
      console.warn('[Init] Failed to initialize current_clinic_id:', e);
    }

    const schema = `
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS clinic_settings (
      id TEXT PRIMARY KEY,
      clinic_name TEXT NOT NULL DEFAULT 'عيادة',
      clinic_logo TEXT,
      owner_name TEXT NOT NULL DEFAULT '',
      whatsapp_number TEXT,
      currency TEXT NOT NULL DEFAULT 'EGP',
      direction TEXT NOT NULL DEFAULT 'rtl',
      address TEXT,
      phone TEXT,
      email TEXT,
      is_setup_completed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      display_id INTEGER,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      gender TEXT,
      age INTEGER,
      city_id TEXT,
      notes TEXT,
      clinic_id TEXT, 
      medical_history TEXT,
      dob TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (city_id) REFERENCES cities(id)
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'doctor',
      active INTEGER NOT NULL DEFAULT 1,
      commission_type TEXT DEFAULT 'percentage',
      commission_value REAL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      time_hours REAL NOT NULL DEFAULT 1,
      profit_percent REAL NOT NULL DEFAULT 30,
      default_price REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS treatment_cases (
      id TEXT PRIMARY KEY,
      display_id INTEGER,
      patient_id TEXT,
      patient_name TEXT,
      name TEXT,
      total_cost REAL,
      total_paid REAL,
      balance REAL,
      status TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      doctor_id TEXT,
      service_id TEXT,
      treatment_case_id TEXT,
      invoice_id TEXT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id),
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (treatment_case_id) REFERENCES treatment_cases(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      display_id INTEGER,
      appointment_id TEXT,
      patient_id TEXT NOT NULL,
      doctor_id TEXT,
      service_id TEXT,
      treatment_case_id TEXT,
      amount REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id),
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (treatment_case_id) REFERENCES treatment_cases(id)
    );
        
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'assistant',
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      file_name TEXT,
      file_url TEXT,
      file_type TEXT,
      notes TEXT,
      clinic_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      amount REAL NOT NULL DEFAULT 0,
      category TEXT,
      description TEXT,
      date TEXT NOT NULL DEFAULT CURRENT_DATE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;

    database.exec(schema);

    // Initialize App Settings if empty (for new installs)
    const settings = database.prepare('SELECT count(*) as count FROM app_settings').get() as { count: number };
    if (settings.count === 0) {
      const now = new Date().toISOString();
      const insert = database.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)');
      insert.run('last_verified_date', now);
    }

    // Initialize Clinic Settings if empty (critical for Setup flow)
    const clinicSettings = database.prepare('SELECT count(*) as count FROM clinic_settings').get() as { count: number };
    if (clinicSettings.count === 0) {
      const id = crypto.randomUUID();
      const insert = database.prepare('INSERT INTO clinic_settings (id, is_setup_completed) VALUES (?, 0)');
      insert.run(id);
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}
