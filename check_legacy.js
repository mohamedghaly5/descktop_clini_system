import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Dental Flow', 'dental.db');
const db = new Database(dbPath, { fileMustExist: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_legacy'").all();
console.log('LEGACY TABLES REMAINING:', tables.length);
if (tables.length > 0) {
    console.table(tables);
} else {
    console.log('✅ No legacy tables found.');
}
