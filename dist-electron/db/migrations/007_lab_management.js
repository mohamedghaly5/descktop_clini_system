export const up = (db) => {
    console.log('Running Migration 007: Lab Management...');
    // 1. Lab Services
    db.exec(`
      CREATE TABLE IF NOT EXISTS lab_services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        default_cost REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        clinic_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // 2. Lab Orders
    db.exec(`
      CREATE TABLE IF NOT EXISTS lab_orders (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        doctor_id TEXT,
        lab_service_id TEXT,
        clinic_id TEXT,
        sent_date TEXT,
        expected_receive_date TEXT,
        received_date TEXT,
        total_lab_cost REAL DEFAULT 0,
        order_status TEXT DEFAULT 'in_progress', -- in_progress, received, late
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
        FOREIGN KEY (lab_service_id) REFERENCES lab_services(id) ON DELETE SET NULL
      );
    `);
    // 3. Lab Payments
    db.exec(`
      CREATE TABLE IF NOT EXISTS lab_payments (
        id TEXT PRIMARY KEY,
        lab_order_id TEXT NOT NULL,
        paid_amount REAL DEFAULT 0,
        payment_date TEXT DEFAULT CURRENT_DATE,
        expense_id TEXT,
        clinic_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lab_order_id) REFERENCES lab_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL
      );
    `);
    // 4. Lab Orders Overview View
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
    console.log('Lab Management tables and views created successfully.');
};
export const down = (db) => {
    db.exec('DROP VIEW IF EXISTS lab_orders_overview');
    db.exec('DROP TABLE IF EXISTS lab_payments');
    db.exec('DROP TABLE IF EXISTS lab_orders');
    db.exec('DROP TABLE IF EXISTS lab_services');
};
