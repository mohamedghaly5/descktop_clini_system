import { Database } from 'better-sqlite3';

export function up(db: Database) {
    // 1. Create Stock Categories Table
    db.exec(`
    CREATE TABLE IF NOT EXISTS stock_categories (
      id TEXT PRIMARY KEY,
      clinic_id TEXT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // 2. Add category_id to stock_items
    // SQLite doesn't support IF NOT EXISTS for columns in ALTER TABLE easily, 
    // but better-sqlite3 exec will fail if column exists. We can wrap in try-catch or check `pragma table_info`.
    const columns = db.pragma('table_info(stock_items)') as any[];
    const hasCategoryId = columns.some((col: any) => col.name === 'category_id');

    if (!hasCategoryId) {
        db.exec(`ALTER TABLE stock_items ADD COLUMN category_id TEXT`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_items_category ON stock_items (category_id)`);
    }

    // 3. Ensure index logic is safe
    db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_categories_clinic ON stock_categories (clinic_id)`);
}
