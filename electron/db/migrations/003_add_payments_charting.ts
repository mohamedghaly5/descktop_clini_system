import Database from 'better-sqlite3';

export const up = (db: Database.Database) => {
  console.log('Creating new financial and charting tables...');

  const transaction = db.transaction(() => {

    // 1. Payments Table
    // Purpose: Granular tracking of partial payments against invoices.
    // Replaces potentially simple 'paid_amount' columns in legacy systems.
    db.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        clinic_id TEXT NOT NULL,
        invoice_id TEXT NOT NULL,
        amount REAL NOT NULL CHECK(amount >= 0),
        method TEXT NOT NULL DEFAULT 'cash', -- cash, card, bank_transfer, insurance
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT 0,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      );
    `);

    // 2. Tooth Conditions Table (Dental Charting)
    // Purpose: Detailed dental history per tooth/surface.
    db.exec(`
      CREATE TABLE IF NOT EXISTS tooth_conditions (
        id TEXT PRIMARY KEY,
        clinic_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        tooth_number INTEGER NOT NULL, -- FDI Notation (11-48, 51-85)
        surface TEXT, 
        condition TEXT NOT NULL, -- caries, filling, extracted, crown, etc.
        notes TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT 0,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );
    `);

    // --- Indexes for Performance ---

    // Payments: Frequent lookups by invoice (to calculate total paid) and date (reports)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_clinic ON payments(clinic_id)`);

    // Charting: Frequent lookups by patient (load chart)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tooth_patient ON tooth_conditions(patient_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tooth_condition ON tooth_conditions(condition)`);
  });

  transaction();
  console.log('New tables (payments, tooth_conditions) created successfully.');
};

export const down = (db: Database.Database) => {
  db.exec('DROP TABLE IF EXISTS payments');
  db.exec('DROP TABLE IF EXISTS tooth_conditions');
};
