import { getDb } from './init.js';

export function getCurrentClinicId(): string {
    const db = getDb();

    try {
        // 1. Primary Source of Truth: The UUID in clinic_settings
        const settings = db.prepare('SELECT id FROM clinic_settings LIMIT 1').get() as { id: string };
        if (settings && settings.id) {
            return String(settings.id).trim();
        }

        // 2. Fallback: 'clinic_001' (Legacy Default)
        return 'clinic_001';

    } catch (error) {
        console.warn('[getCurrentClinicId] Failed to resolve clinic_id, using fallback:', error);
        return 'clinic_001';
    }
}
