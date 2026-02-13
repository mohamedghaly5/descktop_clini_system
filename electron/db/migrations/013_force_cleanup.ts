import Database from 'better-sqlite3';

export const up = (db: Database.Database) => {
    console.log('Running Migration 013: Force Cleanup Legacy Tables (Robust)...');

    const legacyTables = [
        'cities_legacy',
        'doctors_legacy',
        'services_legacy',
        'accounts_legacy',
        'patients_legacy',
        'treatment_cases_legacy',
        'appointments_legacy',
        'invoices_legacy',
        'staff_legacy'
    ];

    legacyTables.forEach(table => {
        try {
            // Disable FKs to allow dropping referenced tables
            db.exec('PRAGMA foreign_keys = OFF');

            // Try dropping as table
            db.exec(`DROP TABLE IF EXISTS ${table}`);
            console.log(`Dropped (Table): ${table}`);

            // Re-enable
            db.exec('PRAGMA foreign_keys = ON');

        } catch (e: any) {
            console.warn(`Failed to drop table ${table}: ${e.message}`);
            // Try dropping as view just in case
            try {
                db.exec(`DROP VIEW IF EXISTS ${table}`);
                console.log(`Dropped (View): ${table}`);
            } catch (e2) { }
        }
    });

    console.log('Legacy cleanup pass complete.');
};

export const down = (db: Database.Database) => {
    // Irreversible
};
