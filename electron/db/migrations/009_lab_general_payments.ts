import Database from 'better-sqlite3';

export const up = (db: Database.Database) => {
    console.log('Running Migration 009: Lab General Payments...');

    // Create lab_general_payments table
    // Note: We use 'lab_general_payments' strictly because 'lab_payments' already exists 
    // and is linked to specific orders. This table is for general/account-level payments to labs.
    db.exec(`
      CREATE TABLE IF NOT EXISTS lab_general_payments (
        id TEXT PRIMARY KEY,
        lab_id TEXT NOT NULL,
        amount REAL NOT NULL,
        expense_id TEXT,
        notes TEXT,
        payment_date TEXT NOT NULL,
        clinic_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE,
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL
      );
    `);

    // Indexes for performance
    db.exec(`CREATE INDEX IF NOT EXISTS idx_lab_general_payments_lab_id ON lab_general_payments(lab_id);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_lab_general_payments_date ON lab_general_payments(payment_date);`);

    console.log('Migration 009: Lab General Payments table created.');
};

export const down = (db: Database.Database) => {
    db.exec('DROP TABLE IF EXISTS lab_general_payments');
};
