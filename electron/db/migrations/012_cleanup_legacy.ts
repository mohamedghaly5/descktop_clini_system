import Database from 'better-sqlite3';

export const up = (db: Database.Database) => {
    console.log('Running Migration 012: Cleanup Legacy Tables...');

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

    try {
        const transaction = db.transaction(() => {
            legacyTables.forEach(table => {
                console.log(`Dropping table: ${table}`);
                db.exec(`DROP TABLE IF EXISTS ${table}`);
            });
        });

        transaction();
        console.log('Legacy tables cleanup complete.');
    } catch (error) {
        console.error('Migration 012 Failed:', error);
    }
};

export const down = (db: Database.Database) => {
    // Cannot restore dropped tables
};
