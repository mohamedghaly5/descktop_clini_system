import Database from 'better-sqlite3';

export const up = (db: Database.Database) => {
    console.log('Running Migration 018: Add Soft Delete Columns...');

    const addColumn = (table: string) => {
        try {
            const info = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
            const hasCol = info.some(c => c.name === 'is_deleted');
            if (!hasCol) {
                console.log(`Adding is_deleted to ${table}`);
                db.prepare(`ALTER TABLE ${table} ADD COLUMN is_deleted BOOLEAN DEFAULT 0`).run();
            }
        } catch (e) {
            console.error(`Failed to add is_deleted to ${table}`, e);
        }
    };

    addColumn('services');
    addColumn('doctors');
    addColumn('cities');
};
