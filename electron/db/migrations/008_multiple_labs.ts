import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export const up = (db: Database.Database) => {
    console.log('Running Migration 008: Multiple Labs Support...');

    // 1. Create labs table
    db.exec(`
        CREATE TABLE IF NOT EXISTS labs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            is_default INTEGER DEFAULT 0,
            clinic_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 2. Insert default lab
    // We check if a default lab exists to avoid duplicates on re-runs
    const existing = db.prepare("SELECT id FROM labs WHERE is_default = 1").get() as { id: string } | undefined;

    let defaultLabId: string;

    if (existing) {
        defaultLabId = existing.id;
        console.log('Default lab already exists:', defaultLabId);
    } else {
        defaultLabId = randomUUID();
        db.prepare(`
            INSERT INTO labs (id, name, is_default) VALUES (?, 'Future Lab', 1)
        `).run(defaultLabId);
        console.log('Default "Future Lab" inserted with ID:', defaultLabId);
    }

    // 3. Modify lab_services
    // Check if column exists
    const servicesCols = db.prepare("PRAGMA table_info(lab_services)").all() as any[];
    if (!servicesCols.some(col => col.name === 'lab_id')) {
        console.log('Adding lab_id to lab_services...');
        db.exec(`ALTER TABLE lab_services ADD COLUMN lab_id TEXT REFERENCES labs(id) ON DELETE SET NULL`);

        // Backfill
        const info = db.prepare(`UPDATE lab_services SET lab_id = ? WHERE lab_id IS NULL`).run(defaultLabId);
        console.log(`Backfilled ${info.changes} lab_services rows.`);
    }

    // 4. Modify lab_orders
    const ordersCols = db.prepare("PRAGMA table_info(lab_orders)").all() as any[];
    if (!ordersCols.some(col => col.name === 'lab_id')) {
        console.log('Adding lab_id to lab_orders...');
        db.exec(`ALTER TABLE lab_orders ADD COLUMN lab_id TEXT REFERENCES labs(id) ON DELETE SET NULL`);

        // Backfill
        const info = db.prepare(`UPDATE lab_orders SET lab_id = ? WHERE lab_id IS NULL`).run(defaultLabId);
        console.log(`Backfilled ${info.changes} lab_orders rows.`);
    }

    // UPDATE VIEW to include lab_id and lab_name
    // We need to drop and recreate the view to include the new column
    console.log('Updating lab_orders_overview view...');
    db.exec('DROP VIEW IF EXISTS lab_orders_overview');
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
        lo.lab_id,
        l.name AS lab_name,
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
      LEFT JOIN labs l ON lo.lab_id = l.id
      LEFT JOIN lab_payments lp ON lo.id = lp.lab_order_id
      GROUP BY lo.id;
    `);

    console.log('Migration 008 completed.');
};

export const down = (db: Database.Database) => {
    // Reverting is complex due to SQLite limitations on dropping columns. 
    // We strictly follow the "up" logic for now.
    // To strictly revert, we'd drop the view, drop the table labs, 
    // but removing columns from lab_services/lab_orders requires creating new tables and copying data.
};
