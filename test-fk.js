
const Database = require('better-sqlite3');
const path = require('path');
// const { app } = require('electron');

// Mock app.getPath for better-sqlite3 if needed, but here we hardcode path for testing script
// We can't easily import electron in pure node script.
// We'll just assume standard path or check if we can run it.
// Actually, we can just open the DB file directly.
const dbPath = path.join(process.env.APPDATA, 'dental-flow-app', 'dental-flow.db'); // Adjust roughly or use relative if known
// Better: user 'userData' is usually %APPDATA%/Name
// We know from logs: c:\Users\GHALY\Desktop\dental-flow-main
// The DB is typically in userData.
// Let's rely on the file existing.
// user rules say: The USER's OS version is windows.

// Let's assume we can try to connect to a temporary local DB to reproduce the schema logic
// instead of touching real DB.
const db = new Database(':memory:');

db.exec(`
    CREATE TABLE cities (
      id TEXT PRIMARY KEY,
      name TEXT
    );
    CREATE TABLE patients (
      id TEXT PRIMARY KEY,
      name TEXT,
      city_id TEXT,
      FOREIGN KEY (city_id) REFERENCES cities(id)
    );
`);

db.pragma('foreign_keys = ON');

try {
    console.log('Testing insert with empty string city_id...');
    db.prepare("INSERT INTO patients (id, name, city_id) VALUES ('1', 'Test', '')").run();
    console.log('Success (Unexpected if FK enforced on empty string)');
} catch (e) {
    console.log('Caught expected error:', e.message);
}

try {
    console.log('Testing insert with NULL city_id...');
    db.prepare("INSERT INTO patients (id, name, city_id) VALUES ('2', 'Test', NULL)").run();
    console.log('Success (Expected)');
} catch (e) {
    console.log('Caught error with NULL:', e.message);
}
