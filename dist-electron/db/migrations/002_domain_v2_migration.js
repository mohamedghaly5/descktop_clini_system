export const up = (db) => {
    console.log('Starting Domain v2 Migration...');
    const CLINIC_ID = 'clinic_001';
    // Helper to ensure table exists in legacy form if it was created via migration/init
    // We assume the tables exist as per the schema dumps witnessed.
    const transaction = db.transaction(() => {
        // --- 1. Clean up potential previous failed runs ---
        const cleanup = [
            'patients', 'appointments', 'invoices', 'doctors', 'services', 'treatment_cases', 'accounts', 'cities', 'staff'
        ];
        cleanup.forEach(t => {
            db.exec(`DROP TABLE IF EXISTS ${t}_v2`);
        });
        // --- 2. Create V2 Tables ---
        // Cities V2
        db.exec(`
      CREATE TABLE cities_v2 (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        clinic_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT 0
      )
    `);
        // Doctors V2
        db.exec(`
      CREATE TABLE doctors_v2 (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'doctor',
        active INTEGER NOT NULL DEFAULT 1,
        commission_type TEXT DEFAULT 'percentage',
        commission_value REAL DEFAULT 0,
        clinic_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT 0
      )
    `);
        // Services V2
        db.exec(`
      CREATE TABLE services_v2 (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        time_hours REAL NOT NULL DEFAULT 1,
        profit_percent REAL NOT NULL DEFAULT 30,
        default_price REAL NOT NULL DEFAULT 0,
        clinic_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT 0
      )
    `);
        // Accounts V2
        db.exec(`
      CREATE TABLE accounts_v2 (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'expense',
        amount REAL NOT NULL DEFAULT 0,
        category TEXT,
        description TEXT,
        date TEXT NOT NULL DEFAULT CURRENT_DATE,
        clinic_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT 0
      )
    `);
        // Staff V2
        db.exec(`
      CREATE TABLE staff_v2 (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'assistant',
        phone TEXT,
        clinic_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT 0
      )
    `);
        // Patients V2
        db.exec(`
      CREATE TABLE patients_v2 (
        id TEXT PRIMARY KEY,
        display_id INTEGER,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        gender TEXT,
        birth_date TEXT, -- Replaces 'age'
        city_id TEXT,
        notes TEXT,
        medical_history TEXT,
        clinic_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT 0,
        FOREIGN KEY (city_id) REFERENCES cities_v2(id)
      )
    `);
        // Treatment Cases V2
        db.exec(`
      CREATE TABLE treatment_cases_v2 (
        id TEXT PRIMARY KEY,
        display_id INTEGER,
        patient_id TEXT,
        patient_name TEXT,
        name TEXT,
        total_cost REAL,
        total_paid REAL,
        balance REAL,
        status TEXT,
        clinic_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT 0,
        FOREIGN KEY (patient_id) REFERENCES patients_v2(id)
      )
    `);
        // Appointments V2
        db.exec(`
      CREATE TABLE appointments_v2 (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        doctor_id TEXT,
        service_id TEXT,
        treatment_case_id TEXT,
        invoice_id TEXT,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        notes TEXT,
        clinic_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT 0,
        FOREIGN KEY (patient_id) REFERENCES patients_v2(id) ON DELETE CASCADE,
        FOREIGN KEY (doctor_id) REFERENCES doctors_v2(id),
        FOREIGN KEY (service_id) REFERENCES services_v2(id),
        FOREIGN KEY (treatment_case_id) REFERENCES treatment_cases_v2(id)
      )
    `);
        // Invoices V2
        db.exec(`
      CREATE TABLE invoices_v2 (
        id TEXT PRIMARY KEY,
        display_id INTEGER,
        appointment_id TEXT,
        patient_id TEXT NOT NULL,
        doctor_id TEXT,
        service_id TEXT,
        treatment_case_id TEXT,
        amount REAL NOT NULL DEFAULT 0,
        paid_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        clinic_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT 0,
        FOREIGN KEY (appointment_id) REFERENCES appointments_v2(id) ON DELETE SET NULL,
        FOREIGN KEY (patient_id) REFERENCES patients_v2(id) ON DELETE CASCADE,
        FOREIGN KEY (doctor_id) REFERENCES doctors_v2(id),
        FOREIGN KEY (service_id) REFERENCES services_v2(id),
        FOREIGN KEY (treatment_case_id) REFERENCES treatment_cases_v2(id)
      )
    `);
        // --- 3. Data Migration ---
        console.log('Migrating Cities...');
        db.prepare(`
      INSERT INTO cities_v2 (id, name, clinic_id, created_at)
      SELECT id, name, ?, created_at FROM cities
    `).run(CLINIC_ID);
        console.log('Migrating Doctors...');
        db.prepare(`
      INSERT INTO doctors_v2 (id, user_id, name, role, active, commission_type, commission_value, clinic_id, created_at, updated_at)
      SELECT id, user_id, name, role, active, commission_type, commission_value, ?, created_at, updated_at FROM doctors
    `).run(CLINIC_ID);
        console.log('Migrating Services...');
        db.prepare(`
      INSERT INTO services_v2 (id, name, time_hours, profit_percent, default_price, clinic_id, created_at, updated_at)
      SELECT id, name, time_hours, profit_percent, default_price, ?, created_at, updated_at FROM services
    `).run(CLINIC_ID);
        console.log('Migrating Accounts...');
        db.prepare(`
        INSERT INTO accounts_v2 (id, name, type, amount, category, description, date, clinic_id, created_at)
        SELECT id, name, type, amount, category, description, date, ?, created_at FROM accounts
    `).run(CLINIC_ID);
        console.log('Migrating Staff...');
        db.prepare(`
        INSERT INTO staff_v2 (id, name, role, phone, clinic_id, created_at, updated_at)
        SELECT id, name, role, phone, ?, created_at, updated_at FROM staff
    `).run(CLINIC_ID);
        console.log('Migrating Patients (Age -> Birth Date)...');
        // Calculate estimated birthdate from age
        const currentYear = new Date().getFullYear();
        // Assuming 'age' is valid integer, if null use null. DOB = (Year - Age) - 01 - 01
        // SQLite doesn't have robust date math in pure SQL for this without extensions sometimes, but we can construct string.
        // If 'dob' column existed in source (it was in my init.ts view), prefer it.
        // I'll try to coalesce dob, or calc from age.
        // Since 'dob' was seen in init.ts, I will try to use it.
        // If age is present and dob is null, calc.
        // Check if dob column exists in source
        const patientCols = db.prepare('PRAGMA table_info(patients)').all();
        const hasDob = patientCols.some(c => c.name === 'dob');
        // Construct the SELECT statement dynamically based on source columns
        // Note: 'medical_history' and 'full_name' are standard.
        const birthDateSql = hasDob
            ? `COALESCE(dob, date('now', '-' || age || ' years'))`
            : `date('now', '-' || age || ' years')`;
        db.prepare(`
      INSERT INTO patients_v2 (
        id, display_id, full_name, phone, gender, birth_date, city_id, notes, medical_history, clinic_id, created_at, updated_at
      )
      SELECT 
        id, display_id, full_name, phone, gender, 
        CASE WHEN age IS NOT NULL THEN strftime('%Y-%m-%d', 'now', '-' || age || ' years') ELSE NULL END, -- Rough estimate
        city_id, notes, medical_history, ?, created_at, updated_at 
      FROM patients
    `).run(CLINIC_ID);
        console.log('Migrating Treatment Cases...');
        db.prepare(`
      INSERT INTO treatment_cases_v2 (id, display_id, patient_id, patient_name, name, total_cost, total_paid, balance, status, clinic_id, created_at, updated_at)
      SELECT id, display_id, patient_id, patient_name, name, total_cost, total_paid, balance, status, ?, created_at, updated_at FROM treatment_cases
    `).run(CLINIC_ID);
        console.log('Migrating Appointments...');
        db.prepare(`
      INSERT INTO appointments_v2 (id, patient_id, doctor_id, service_id, treatment_case_id, invoice_id, date, time, status, notes, clinic_id, created_at, updated_at)
      SELECT id, patient_id, doctor_id, service_id, treatment_case_id, invoice_id, date, time, status, notes, ?, created_at, updated_at FROM appointments
    `).run(CLINIC_ID);
        console.log('Migrating Invoices...');
        db.prepare(`
      INSERT INTO invoices_v2 (id, display_id, appointment_id, patient_id, doctor_id, service_id, treatment_case_id, amount, paid_amount, status, notes, clinic_id, created_at, updated_at)
      SELECT id, display_id, appointment_id, patient_id, doctor_id, service_id, treatment_case_id, amount, paid_amount, status, notes, ?, created_at, updated_at FROM invoices
    `).run(CLINIC_ID);
        // --- 4. Swap Tables strategy (Execution) ---
        // Rename old to _legacy, new to actual
        const tables = ['cities', 'doctors', 'services', 'accounts', 'patients', 'treatment_cases', 'appointments', 'invoices', 'staff'];
        tables.forEach(table => {
            db.exec(`ALTER TABLE ${table} RENAME TO ${table}_legacy`);
            db.exec(`ALTER TABLE ${table}_v2 RENAME TO ${table}`);
        });
        console.log('Migration Complete. Legacy tables renamed to *_legacy.');
    });
    transaction();
};
export const down = (db) => {
    // Rollback: Drop new tables (now named without suffix), rename legacy back
    const tables = ['cities', 'doctors', 'services', 'accounts', 'patients', 'treatment_cases', 'appointments', 'invoices', 'staff'];
    const transaction = db.transaction(() => {
        tables.forEach(table => {
            db.exec(`DROP TABLE IF EXISTS ${table}`); // Drop the v2 (now named normal)
            db.exec(`ALTER TABLE ${table}_legacy RENAME TO ${table}`);
        });
    });
    transaction();
};
