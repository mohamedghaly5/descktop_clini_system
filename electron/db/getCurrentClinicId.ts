import { getDb } from './init.js';

export function getCurrentClinicId(): string {
    const db = getDb();

    try {
        // 1. Primary Source of Truth: app_meta (Explicit selection)
        const meta = db.prepare("SELECT value FROM app_meta WHERE key = 'current_clinic_id'").get() as { value: string };
        if (meta && meta.value) {
            return String(meta.value).trim();
        }

        // 2. Secondary Source: The 'clinics' table (V2 Domain Entity)
        // This table holds the ID that other tables reference via FK (e.g. 'clinic_001')
        const clinic = db.prepare('SELECT id FROM clinics LIMIT 1').get() as { id: string };
        if (clinic && clinic.id) {
            return String(clinic.id).trim();
        }

        // 3. Fallback: 'clinic_001' (Legacy Default)
        return 'clinic_001';

    } catch (error) {
        console.warn('[getCurrentClinicId] Failed to resolve clinic_id, using fallback:', error);
        return 'clinic_001';
    }
}
