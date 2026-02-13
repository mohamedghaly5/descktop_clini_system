import Database from 'better-sqlite3';

export const up = (db: Database.Database) => {
    console.log('Running Migration 014: Unify Clinic Settings...');

    try {
        const transaction = db.transaction(() => {
            // 1. Get all settings
            const rows = db.prepare('SELECT * FROM clinic_settings ORDER BY updated_at DESC').all() as any[];

            if (rows.length === 0) {
                console.log('No settings found. Inserting default.');
                db.prepare(`
                    INSERT INTO clinic_settings (id, clinic_name, created_at, updated_at) 
                    VALUES ('clinic_001', 'عيادتي', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `).run();
            } else {
                // 2. We keep the first one (most recently updated)
                const winner = rows[0];
                console.log(`Keeping settings row: ${winner.id} (${winner.clinic_name})`);

                // 3. Delete ALL rows
                db.prepare('DELETE FROM clinic_settings').run();

                // 4. Re-insert the winner with the CANONICAL ID 'clinic_001'
                // This ensures deterministic access forever.
                db.prepare(`
                    INSERT INTO clinic_settings (
                        id, clinic_name, owner_name, phone, whatsapp_number, address, 
                        email, clinic_logo, currency, is_setup_completed, created_at, updated_at
                    ) VALUES (
                        'clinic_001', @clinic_name, @owner_name, @phone, @whatsapp_number, @address,
                        @email, @clinic_logo, @currency, @is_setup_completed, @created_at, CURRENT_TIMESTAMP
                    )
                `).run({
                    clinic_name: winner.clinic_name,
                    owner_name: winner.owner_name,
                    phone: winner.phone,
                    whatsapp_number: winner.whatsapp_number,
                    address: winner.address,
                    email: winner.email,
                    clinic_logo: winner.clinic_logo,
                    currency: winner.currency,
                    is_setup_completed: winner.is_setup_completed,
                    created_at: winner.created_at || new Date().toISOString()
                });

                console.log('Unified clinic settings into ID: clinic_001');
            }
        });

        transaction();
    } catch (e) {
        console.error('Migration 014 Failed:', e);
    }
};

export const down = (db: Database.Database) => {
    // Irreversible
};
