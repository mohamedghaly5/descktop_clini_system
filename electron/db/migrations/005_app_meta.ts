import Database from 'better-sqlite3';

export const up = (db: Database.Database) => {
    console.log('Finalizing App Meta & System Tables...');

    const transaction = db.transaction(() => {

        // 1. App Meta (Key-Value Store)
        // Already created in init.ts likely, but ensure it exists and matches spec.
        db.exec(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

        // 2. Insert Default Keys if missing
        const keys = [
            { k: 'migration_version', v: '4' }, // Current migration we are at
            { k: 'license_status', v: 'trial' },
            { k: 'app_version', v: '1.0.1' }
        ];

        const insert = db.prepare('INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)');

        keys.forEach(({ k, v }) => {
            insert.run(k, v);
        });

        console.log('App Meta initialized.');
    });

    transaction();
};

export const down = (db: Database.Database) => {
    // No down for meta really, as it's system critical.
};
