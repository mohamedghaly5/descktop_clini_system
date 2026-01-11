import { getDb } from './init.js';

export function validateSchema() {
    const db = getDb();
    const report: string[] = [];
    let allGood = true;

    console.log('--- STARTING SCHEMA VALIDATION ---');

    // 1. Check Tables
    const expectedTables = [
        'clinics', 'users', 'app_meta', 'payments', 'tooth_conditions',
        'patients', 'appointments', 'invoices', 'doctors', 'services', 'treatment_cases', 'staff', 'accounts', 'cities'
    ];

    expectedTables.forEach(table => {
        const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
        if (!exists) {
            report.push(`[CRITICAL] Table missing: ${table}`);
            allGood = false;
        } else {
            // Check clinic_id column for domain tables
            if (!['app_meta', 'clinics', 'users'].includes(table)) {
                const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
                const hasClinicId = cols.some(c => c.name === 'clinic_id');
                if (!hasClinicId) {
                    report.push(`[CRITICAL] Table ${table} matches creation checks but is missing 'clinic_id' column.`);
                    allGood = false;
                }
            }
        }
    });

    // 2. Data Integrity Checks
    try {
        if (allGood) {
            // Check financial sum consistency
            // This is just a sanity check: Sum of invoices paid amount (v2) vs Sum of invoices paid amount (legacy)
            // But legacy might be gone or renamed.
            const invoiceCount = db.prepare('SELECT COUNT(*) as c FROM invoices').get() as any;
            report.push(`[INFO] Invoice Recods: ${invoiceCount.c}`);

            const patientCount = db.prepare('SELECT COUNT(*) as c FROM patients').get() as any;
            report.push(`[INFO] Patient Records: ${patientCount.c}`);

            // Check orphans (invoices without valid clinic_id)
            const orphans = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE clinic_id IS NULL OR clinic_id = ''").get() as any;
            if (orphans.c > 0) {
                report.push(`[WARN] Found ${orphans.c} invoices with missing clinic_id.`);
                allGood = false;
            }
        }
    } catch (err: any) {
        report.push(`[ERROR] Validation query failed: ${err.message}`);
        allGood = false;
    }

    console.log('--- VALIDATION REPORT ---');
    console.log(report.join('\n'));

    return { success: allGood, report };
}
