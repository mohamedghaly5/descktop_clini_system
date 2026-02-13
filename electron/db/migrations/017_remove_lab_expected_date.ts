import Database from 'better-sqlite3';

export const up = (db: Database.Database) => {
    console.log('Running Migration 017: Remove Lab Expected Date...');

    // 1. Drop the View
    db.exec('DROP VIEW IF EXISTS lab_orders_overview');

    // 2. Drop Column from Table
    // Try native drop column, fallback to recreate if needed (though unlikely needed with modern sqlite)
    try {
        db.exec('ALTER TABLE lab_orders DROP COLUMN expected_receive_date');
    } catch (e) {
        console.warn('ALTER TABLE DROP COLUMN failed, attempting table recreation...', e);
        // Fallback: Create new table, copy data, drop old, rename
        db.transaction(() => {
            db.exec(`
                CREATE TABLE IF NOT EXISTS lab_orders_new (
                    id TEXT PRIMARY KEY,
                    patient_id TEXT NOT NULL,
                    doctor_id TEXT,
                    lab_service_id TEXT,
                    clinic_id TEXT,
                    sent_date TEXT,
                    received_date TEXT,
                    total_lab_cost REAL DEFAULT 0,
                    order_status TEXT DEFAULT 'in_progress',
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
                    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
                    FOREIGN KEY (lab_service_id) REFERENCES lab_services(id) ON DELETE SET NULL
                );
            `);
            // Copy data
            db.exec(`
                INSERT INTO lab_orders_new (id, patient_id, doctor_id, lab_service_id, clinic_id, sent_date, received_date, total_lab_cost, order_status, notes, created_at, updated_at)
                SELECT id, patient_id, doctor_id, lab_service_id, clinic_id, sent_date, received_date, total_lab_cost, order_status, notes, created_at, updated_at
                FROM lab_orders;
            `);
            db.exec('DROP TABLE lab_orders');
            db.exec('ALTER TABLE lab_orders_new RENAME TO lab_orders');
        })();
    }

    // 3. Recreate View without the column
    db.exec(`
      CREATE VIEW IF NOT EXISTS lab_orders_overview AS
      SELECT 
        lo.id AS order_id,
        lo.patient_id,
        p.full_name AS patient_name,
        lo.doctor_id,
        d.name AS doctor_name,
        lo.lab_service_id,
        ls.name AS service_name,
        lo.clinic_id,
        lo.sent_date,
        lo.received_date,
        lo.order_status,
        lo.total_lab_cost,
        COALESCE(SUM(lp.paid_amount), 0) AS total_paid,
        (lo.total_lab_cost - COALESCE(SUM(lp.paid_amount), 0)) AS remaining_balance,
        lo.created_at
      FROM lab_orders lo
      LEFT JOIN patients p ON lo.patient_id = p.id
      LEFT JOIN doctors d ON lo.doctor_id = d.id
      LEFT JOIN lab_services ls ON lo.lab_service_id = ls.id
      LEFT JOIN lab_payments lp ON lo.id = lp.lab_order_id
      GROUP BY lo.id;
    `);

    console.log('Migration 017 completed.');
};

export const down = (db: Database.Database) => {
    db.exec('ALTER TABLE lab_orders ADD COLUMN expected_receive_date TEXT');

    db.exec('DROP VIEW IF EXISTS lab_orders_overview');
    // Recreate original view
    db.exec(`
      CREATE VIEW IF NOT EXISTS lab_orders_overview AS
      SELECT 
        lo.id AS order_id,
        lo.patient_id,
        p.full_name AS patient_name,
        lo.doctor_id,
        d.name AS doctor_name,
        lo.lab_service_id,
        ls.name AS service_name,
        lo.clinic_id,
        lo.sent_date,
        lo.expected_receive_date,
        lo.received_date,
        lo.order_status,
        lo.total_lab_cost,
        COALESCE(SUM(lp.paid_amount), 0) AS total_paid,
        (lo.total_lab_cost - COALESCE(SUM(lp.paid_amount), 0)) AS remaining_balance,
        lo.created_at
      FROM lab_orders lo
      LEFT JOIN patients p ON lo.patient_id = p.id
      LEFT JOIN doctors d ON lo.doctor_id = d.id
      LEFT JOIN lab_services ls ON lo.lab_service_id = ls.id
      LEFT JOIN lab_payments lp ON lo.id = lp.lab_order_id
      GROUP BY lo.id;
    `);
};
