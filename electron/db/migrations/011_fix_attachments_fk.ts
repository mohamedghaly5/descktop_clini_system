import Database from 'better-sqlite3';

export const up = (db: Database.Database) => {
    console.log('Running Migration 011: Fix Attachments Foreign Key (Deep Repair)...');

    try {
        // Check current FKs
        const fks = db.pragma('foreign_key_list(attachments)') as any[];
        const isBroken = fks.some(fk => fk.table === 'patients_legacy');

        if (isBroken) {
            console.log('CRITICAL: Attachments table references patients_legacy. Rebuilding...');

            const transaction = db.transaction(() => {
                // 1. Rename existing
                db.exec('ALTER TABLE attachments RENAME TO attachments_broken_fk');

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

                // 3. Migrate Data
                // Only keep attachments for patients that exist in the MAIN patients table
                console.log('Migrating valid attachments...');
                db.exec(`
                    INSERT INTO attachments (id, patient_id, file_name, file_url, file_type, notes, clinic_id, created_at, updated_at)
                    SELECT id, patient_id, file_name, file_url, file_type, notes, clinic_id, created_at, updated_at
                    FROM attachments_broken_fk
                    WHERE patient_id IN (SELECT id FROM patients)
                `);

                // 4. Drop broken
                db.exec('DROP TABLE attachments_broken_fk');
            });

            transaction();
            console.log('Attachments table rebuilt successfully. FK now points to patients.');
        } else {
            console.log('Attachments FK looks correct (does not point to patients_legacy). No action needed.');
        }

    } catch (error) {
        console.error('Migration 011 Failed:', error);
    }
};

export const down = (db: Database.Database) => {
    // No down migration
};
