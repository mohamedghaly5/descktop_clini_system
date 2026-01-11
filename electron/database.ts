import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import crypto from 'crypto';

const dbPath = path.join(app.getPath('userData'), 'dental-flow.db');
const db = new Database(dbPath);

export function getDb() {
  return db;
}

export function closeConnection() {
  try {
    if (db.open) {
      db.close();
      console.log('Database connection closed.');
    }
  } catch (err) {
    console.error('Error closing database:', err);
  }
}

export function initializeDatabase() {
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create tables
  const schema = `
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

    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'assistant',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, role)
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      full_name TEXT,
      phone TEXT,
      avatar_url TEXT,
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
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      gender TEXT,
      age INTEGER,
      city_id TEXT,
      notes TEXT,
      clinic_id TEXT, 
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

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      cases_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS service_products (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (service_id, product_id),
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS service_includes (
      id TEXT PRIMARY KEY,
      parent_service_id TEXT NOT NULL,
      included_service_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (parent_service_id, included_service_id),
      FOREIGN KEY (parent_service_id) REFERENCES services(id) ON DELETE CASCADE,
      FOREIGN KEY (included_service_id) REFERENCES services(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      doctor_id TEXT,
      service_id TEXT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id),
      FOREIGN KEY (service_id) REFERENCES services(id)
    );

    CREATE TABLE IF NOT EXISTS treatment_cases (
      id TEXT PRIMARY KEY,
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

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      file_name TEXT,
      file_url TEXT, -- Base64 or path
      file_type TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    -- Ensure invoices has treatment_case_id
    -- Note: Since we are using better-sqlite3 without migration system for this MVP, 
    -- if the table exists it won't change. User starts fresh, so it's fine.
    
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
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

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `;

  db.exec(schema);

  // Check and add missing columns for appointments (Migration)
  const appointmentCols = db.prepare('PRAGMA table_info(appointments)').all() as any[];
  const hasTreatmentCaseId = appointmentCols.some(c => c.name === 'treatment_case_id');
  const hasInvoiceId = appointmentCols.some(c => c.name === 'invoice_id');

  if (!hasTreatmentCaseId) {
    try {
      db.prepare('ALTER TABLE appointments ADD COLUMN treatment_case_id TEXT REFERENCES treatment_cases(id)').run();
      console.log('Added treatment_case_id column to appointments');
    } catch (e) {
      console.error('Failed to add treatment_case_id column', e);
    }
  }

  if (!hasInvoiceId) {
    try {
      db.prepare('ALTER TABLE appointments ADD COLUMN invoice_id TEXT REFERENCES invoices(id)').run();
      console.log('Added invoice_id column to appointments');
    } catch (e) {
      console.error('Failed to add invoice_id column', e);
    }
  }

  // Check and add missing columns for invoices (Migration)
  const invoiceCols = db.prepare('PRAGMA table_info(invoices)').all() as any[];
  const invoiceHasTreatmentCaseId = invoiceCols.some(c => c.name === 'treatment_case_id');

  if (!invoiceHasTreatmentCaseId) {
    try {
      db.prepare('ALTER TABLE invoices ADD COLUMN treatment_case_id TEXT REFERENCES treatment_cases(id)').run();
      console.log('Added treatment_case_id column to invoices');
    } catch (e) {
      console.error('Failed to add treatment_case_id column to invoices', e);
    }
  }

  // Seed initial data if empty
  const clinicSettings = db.prepare('SELECT count(*) as count FROM clinic_settings').get() as { count: number };
  if (clinicSettings.count === 0) {
    db.prepare(`
      INSERT INTO clinic_settings (id, clinic_name, owner_name, currency, direction)
      VALUES (?, 'عيادة دينتا كير', 'د. أحمد', 'EGP', 'rtl')
    `).run(crypto.randomUUID());
  }
  // --- Display ID Migrations and Backfill ---

  // 1. Patients
  const patientCols = db.prepare('PRAGMA table_info(patients)').all() as any[];
  if (!patientCols.some(c => c.name === 'display_id')) {
    try {
      db.prepare('ALTER TABLE patients ADD COLUMN display_id INTEGER').run();
      console.log('Added display_id to patients');
    } catch (e) {
      console.error('Failed to add display_id to patients', e);
    }
  }

  // Backfill Patients
  const patientsWithoutId = db.prepare('SELECT id FROM patients WHERE display_id IS NULL ORDER BY created_at ASC').all() as any[];
  if (patientsWithoutId.length > 0) {
    let maxId = (db.prepare('SELECT MAX(display_id) as max FROM patients').get() as any)?.max || 0;
    const stmt = db.prepare('UPDATE patients SET display_id = ? WHERE id = ?');
    const updateTransaction = db.transaction((rows) => {
      for (const row of rows) {
        maxId++;
        stmt.run(maxId, row.id);
      }
    });
    updateTransaction(patientsWithoutId);
    console.log(`Backfilled ${patientsWithoutId.length} patients with display_id`);
  }

  // 2. Treatment Cases
  const caseCols = db.prepare('PRAGMA table_info(treatment_cases)').all() as any[];
  if (!caseCols.some(c => c.name === 'display_id')) {
    try {
      db.prepare('ALTER TABLE treatment_cases ADD COLUMN display_id INTEGER').run();
      console.log('Added display_id to treatment_cases');
    } catch (e) {
      console.error('Failed to add display_id to treatment_cases', e);
    }
  }

  // Backfill Treatment Cases
  const casesWithoutId = db.prepare('SELECT id FROM treatment_cases WHERE display_id IS NULL ORDER BY created_at ASC').all() as any[];
  if (casesWithoutId.length > 0) {
    let maxId = (db.prepare('SELECT MAX(display_id) as max FROM treatment_cases').get() as any)?.max || 0;
    const stmt = db.prepare('UPDATE treatment_cases SET display_id = ? WHERE id = ?');
    const updateTransaction = db.transaction((rows) => {
      for (const row of rows) {
        maxId++;
        stmt.run(maxId, row.id);
      }
    });
    updateTransaction(casesWithoutId);
    console.log(`Backfilled ${casesWithoutId.length} treatment cases with display_id`);
  }

  // 3. Invoices
  const invCols = db.prepare('PRAGMA table_info(invoices)').all() as any[];
  if (!invCols.some(c => c.name === 'display_id')) {
    try {
      db.prepare('ALTER TABLE invoices ADD COLUMN display_id INTEGER').run();
      console.log('Added display_id to invoices');
    } catch (e) {
      console.error('Failed to add display_id to invoices', e);
    }
  }

  // Backfill Invoices
  const invoicesWithoutId = db.prepare('SELECT id FROM invoices WHERE display_id IS NULL ORDER BY created_at ASC').all() as any[];
  if (invoicesWithoutId.length > 0) {
    let maxId = (db.prepare('SELECT MAX(display_id) as max FROM invoices').get() as any)?.max || 0;
    const stmt = db.prepare('UPDATE invoices SET display_id = ? WHERE id = ?');
    const updateTransaction = db.transaction((rows) => {
      for (const row of rows) {
        maxId++;
        stmt.run(maxId, row.id);
      }
    });
    updateTransaction(invoicesWithoutId);
    console.log(`Backfilled ${invoicesWithoutId.length} invoices with display_id`);
  }

  // 4. Setup Status (Migration)
  const settingsCols = db.prepare('PRAGMA table_info(clinic_settings)').all() as any[];
  if (!settingsCols.some(c => c.name === 'is_setup_completed')) {
    try {
      db.prepare('ALTER TABLE clinic_settings ADD COLUMN is_setup_completed INTEGER DEFAULT 0').run();
      console.log('Added is_setup_completed to clinic_settings');
    } catch (e) {
      console.error('Failed to add is_setup_completed to clinic_settings', e);
    }
  }

  // 6. Email (Migration) - Critical for backup security
  if (!settingsCols.some(c => c.name === 'email')) {
    try {
      db.prepare('ALTER TABLE clinic_settings ADD COLUMN email TEXT').run();
      console.log('Added email to clinic_settings');
    } catch (e) {
      console.error('Failed to add email to clinic_settings', e);
    }
  }

  // 5. Create Staff Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'assistant',
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // 7. Multi-Tenancy (Clinic ID) - Critical for data isolation
  // Note: owner_email is deprecated and removed in V2. clinic_id is now the key.
  // The migration to clinic_id is handled by 001_clinics_migration.ts
  /* 
  const tablesToMigrate = [
    'patients',
    'appointments',
    'invoices',
    'doctors',
    'services',
    'treatment_cases',
    'accounts',
    'cities'
  ];

  tablesToMigrate.forEach(table => {
    try {
      const colInfo = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
      if (!colInfo.some(c => c.name === 'clinic_id')) {
        // We rely on 001_clinics_migration.ts to add this, but we can double check or just skip.
        // db.prepare(`ALTER TABLE ${table} ADD COLUMN clinic_id TEXT`).run();
      }
    } catch (e) {
      console.error(`Failed to migrate ${table} for clinic_id`, e);
    }
  });
  */

  // 8. Accounts table check (Ensure it exists in code - added above in CREATE TABLE but just safe check)

}
