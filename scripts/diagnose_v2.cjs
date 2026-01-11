const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const userDataPath = path.join(process.env.APPDATA, 'Dental Flow');
const dbPath = path.join(userDataPath, 'dental.db');

console.log('--- Diagnostic Tool V2 ---');
console.log('DB Path:', dbPath);

try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });

    // Check app_settings
    const settings = db.prepare('SELECT * FROM app_settings').all();
    console.log('\n--- app_settings ---');
    settings.forEach(row => {
        let val = row.value;
        if (row.key === 'user_details') {
            console.log(`${row.key}:`);
            try {
                const json = JSON.parse(val);
                console.log('  ID:', json.id);
                console.log('  Email:', json.email);
                console.log('  Role:', json.role);
                console.log('  ClinicID:', json.clinic_id);
            } catch (e) {
                console.log('  (Invalid JSON)');
            }
        } else if (row.key === 'user_session') {
            console.log(`${row.key}: (Session Present)`);
        } else {
            console.log(`${row.key}: ${val}`);
        }
    });

    db.close();

} catch (e) {
    console.error('Error:', e.message);
}
