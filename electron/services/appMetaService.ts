import { getDb } from '../db/init.js';

/**
 * Lightweight service for handling system-wide metadata.
 * Stores values as simple strings or JSON strings in `app_meta` table.
 */
export const appMetaService = {
    get(key: string): string | null {
        try {
            const db = getDb();
            const row = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as { value: string };
            return row ? row.value : null;
        } catch (error) {
            console.error(`appMetaService.get(${key}) failed:`, error);
            return null;
        }
    },

    /**
     * Typed getter for JSON values or Primitives
     */
    getJson<T>(key: string, defaultValue: T): T {
        const val = this.get(key);
        if (!val) return defaultValue;
        try {
            return JSON.parse(val) as T;
        } catch (e) {
            // If not JSON, maybe it was a simple string attempting to be parsed, return as is if T is string
            if (typeof defaultValue === 'string') return val as unknown as T;
            return defaultValue;
        }
    },

    set(key: string, value: string | number | boolean | object): void {
        try {
            const db = getDb();
            let storedValue = '';

            if (typeof value === 'object') {
                storedValue = JSON.stringify(value);
            } else {
                storedValue = String(value);
            }

            db.prepare('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)').run(key, storedValue);
        } catch (error) {
            console.error(`appMetaService.set(${key}) failed:`, error);
        }
    },

    delete(key: string): void {
        try {
            getDb().prepare('DELETE FROM app_meta WHERE key = ?').run(key);
        } catch (error) {
            console.error(`appMetaService.delete(${key}) failed:`, error);
        }
    },

    // --- Convenience Methods ---

    updateMigrationVersion(version: number) {
        this.set('migration_version', version);
    },

    getMigrationVersion(): number {
        return Number(this.get('migration_version')) || 0;
    },

    updateBackupTimestamp() {
        this.set('last_backup_at', new Date().toISOString());
    },

    getLastBackupTime(): string | null {
        return this.get('last_backup_at');
    },

    setLicenseStatus(isAuthorized: boolean, expiryDate?: string) {
        this.set('license_status', isAuthorized ? 'active' : 'expired');
        if (expiryDate) {
            this.set('license_expires_at', expiryDate);
        }
    }
};
