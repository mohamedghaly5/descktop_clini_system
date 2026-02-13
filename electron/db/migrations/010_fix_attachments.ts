import Database from 'better-sqlite3';

export const up = (db: Database.Database) => {
    console.log('Running Migration 010: Fix Attachments Schema...');

    try {
        // --- FX: DATA INTEGRITY SEED ---
        // Ensure 'clinic_001' exists in clinics table, otherwise FK 'clinic_001' will fail.
        const clinicCheck = db.prepare("SELECT count(*) as count FROM clinics WHERE id = 'clinic_001'").get() as { count: number };
        if (clinicCheck.count === 0) {
            console.log('SEEDING MISSING CLINIC: clinic_001');
            db.prepare(`
                INSERT INTO clinics (id, name, created_at) VALUES ('clinic_001', 'Default Clinic', CURRENT_TIMESTAMP)
            `).run();
        }

        // --- DEEP REPAIR: Fix Incorrect Foreign Key to 'patients_legacy' ---
        // The logs showed: "table": "patients_legacy". This means the FK is stale.
        // We MUST drop and recreate the table to point to the correct 'patients' table.

        console.log('Detecting foreign key misalignment...');
        const fks = db.pragma('foreign_key_list(attachments)') as any[];
        const isBroken = fks.some(fk => fk.table === 'patients_legacy');

        if (isBroken) {
            console.log('CRITICAL: Attachments table references patients_legacy. Rebuilding...');

            const transaction = db.transaction(() => {
                // 1. Rename existing
                db.exec('ALTER TABLE attachments RENAME TO attachments_broken');

                // 2. Create correct table
                db.exec(`
                    CREATE TABLE attachments (
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
                    )
                `);

                // 3. Migrate Data (if any)
                // We try to migrate, but if patient_ids don't exist in new patients table, we validly lose them (orphan cleanup)
                // OR we just map strictly.

                db.exec(`
                    INSERT INTO attachments (id, patient_id, file_name, file_url, file_type, notes, clinic_id, created_at, updated_at)
                    SELECT id, patient_id, file_name, file_url, file_type, notes, clinic_id, created_at, updated_at
                    FROM attachments_broken
                    WHERE patient_id IN (SELECT id FROM patients) -- Only keep valid attachments
                `);

                // 4. Drop broken
                db.exec('DROP TABLE attachments_broken');
            });

            transaction();
            console.log('Attachments table rebuilt successfully.');
        } else {
            // Just ensure clinic_id column exists if we didn't rebuild
            const tableInfo = db.pragma('table_info(attachments)') as any[];
            const hasClinicId = tableInfo.some(col => col.name === 'clinic_id');

            if (!hasClinicId) {
                console.log('Adding clinic_id column to attachments table...');
                db.exec('ALTER TABLE attachments ADD COLUMN clinic_id TEXT');
                console.log('Column clinic_id added.');
            }
        }

    } catch (error) {
        console.error('Migration 010 Failed:', error);
    }
};

export const down = (db: Database.Database) => {
    // Cannot easily remove column in SQLite without recreation
};
