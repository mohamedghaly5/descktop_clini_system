export const up = (db) => {
    console.log('Running Migration 006: Create Expenses Table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Expenses table created successfully.');
};
export const down = (db) => {
    db.exec('DROP TABLE IF EXISTS expenses');
};
