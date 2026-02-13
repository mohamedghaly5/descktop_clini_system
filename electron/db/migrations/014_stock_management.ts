import { Database } from 'better-sqlite3';

export function up(db: Database) {
    // Stock Items Table
    db.exec(`
    CREATE TABLE IF NOT EXISTS stock_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id TEXT,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      min_quantity INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Stock Movements Table
    db.exec(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id TEXT,
      item_id INTEGER NOT NULL,
      change INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES stock_items(id) ON DELETE CASCADE
    )
  `);

    // Index for performance
    db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_items_clinic ON stock_items (clinic_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements (item_id)`);
}
