import Database from 'better-sqlite3';
import crypto, { randomUUID } from 'crypto';

export const up = (db: Database.Database) => {
    console.log('Starting Users & Auth Migration...');

    const transaction = db.transaction(() => {

        // 1. Create Users Table (No Email)
        db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        clinic_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff', -- admin, doctor, staff
        active BOOLEAN DEFAULT 1,
        pin_code TEXT, -- For quick switching in future
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT 0
      );
    `);

        // 2. Identify Owner and Seed Admin User
        const clinic = db.prepare('SELECT * FROM clinics WHERE id = ?').get('clinic_001') as any;

        if (clinic) {
            // Check if ANY admin exists for this clinic to prevent duplicates
            const existingAdmin = db.prepare("SELECT id FROM users WHERE clinic_id = ? AND role = 'admin'").get(clinic.id);

            if (!existingAdmin) {
                console.log('Seeding Admin User from Clinic Owner...');
                const userId = randomUUID();
                const ownerName = clinic.owner_name || 'Admin Doctor';

                // Pre-hash default PIN '0000'
                const salt = 'dental-flow-local-salt';
                const defaultPinHash = crypto.scryptSync('0000', salt, 64).toString('hex');

                // Insert with pin_code
                db.prepare(`
                INSERT INTO users (id, clinic_id, name, role, active, pin_code)
                VALUES (?, ?, ?, 'admin', 1, ?)
            `).run(userId, clinic.id, ownerName, defaultPinHash);

                console.log(`Created Admin User: ${ownerName} with PIN 0000`);
            }
        } else {
            console.warn('Warning: No clinic_001 found. Skipping owner seeding.');
        }

    });

    transaction();
    console.log('Users table created and Owner seeded.');
};

export const down = (db: Database.Database) => {
    db.exec('DROP TABLE IF EXISTS users');
};
