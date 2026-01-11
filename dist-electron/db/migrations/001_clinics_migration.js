export const up = (db) => {
    const transaction = db.transaction(() => {
        // 1. Create clinics table
        db.exec(`
      CREATE TABLE IF NOT EXISTS clinics (
        id TEXT PRIMARY KEY,
        name TEXT,
        owner_name TEXT,
        phone TEXT,
        address TEXT,
        email TEXT,
        whatsapp_number TEXT,
        currency TEXT,
        direction TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // 2. Check for existing settings
        const existingSettings = db.prepare('SELECT * FROM clinic_settings LIMIT 1').get();
        if (existingSettings) {
            // 3. Migrate data
            // Using a stable ID 'clinic_001' as requested for the single tenant migration
            const insert = db.prepare(`
        INSERT INTO clinics (
          id, name, owner_name, phone, address, email, 
          whatsapp_number, currency, direction, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, 
          ?, ?, ?, ?
        )
      `);
            insert.run('clinic_001', existingSettings.clinic_name, existingSettings.owner_name, existingSettings.phone, existingSettings.address, existingSettings.email, existingSettings.whatsapp_number, existingSettings.currency || 'EGP', existingSettings.direction || 'rtl', existingSettings.created_at || new Date().toISOString());
            console.log('Migrated clinic_settings to clinics table with ID: clinic_001');
        }
        else {
            console.log('No clinic_settings found to migrate.');
        }
    });
    transaction();
};
export const down = (db) => {
    db.exec('DROP TABLE IF EXISTS clinics');
};
