import { ipcMain } from 'electron';
import { getDb, ensureDbOpen } from '../db/init.js';
import { appMetaService } from '../services/appMetaService.js';
import crypto from 'crypto';
// Simple hashing utilizing Node crypto (scrypt)
function hashPin(pin) {
    const salt = 'dental-flow-local-salt'; // In prod, unique salt per user is better, but this suffices for local simplified PINs
    return crypto.scryptSync(pin, salt, 64).toString('hex');
}
// Module-level state to track if this is the first auth check since app start
// let isAppStartup = true; // Removed
export function registerAuthHandlers() {
    // 1. Initialization: Ensure Users Table & Admin Exists
    try {
        const db = getDb(); // Safe to call here as init should be done, but we'll try/catch
        // Fix: Create users table if it doesn't exist (Critical for first run)
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                clinic_id TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin', 'doctor', 'staff')),
                pin_code TEXT,
                active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // Check if we need to set default admin (legacy logic, kept for safety)
        const adminUser = db.prepare("SELECT id FROM users WHERE role = 'admin' AND (pin_code IS NULL OR pin_code = '')").get();
        if (adminUser) {
            console.log('Initializing Admin PIN to default (0000)...');
            const defaultHash = hashPin('0000');
            db.prepare('UPDATE users SET pin_code = ? WHERE id = ?').run(defaultHash, adminUser.id);
        }
    }
    catch (e) {
        console.warn('Failed to initialize users table or admin PIN', e);
    }
    // 2. Anti-Clock Tampering Check
    const checkClockTampering = () => {
        const lastUsageStr = appMetaService.get('last_app_usage_at');
        const now = new Date();
        // Update usage time
        appMetaService.set('last_app_usage_at', now.toISOString());
        if (lastUsageStr) {
            const lastUsage = new Date(lastUsageStr);
            // If now is significantly before last usage (allowing 5 min drift)
            if (now.getTime() < lastUsage.getTime() - 5 * 60 * 1000) {
                return { tampered: true, message: 'System time appears to have been rolled back.' };
            }
        }
        return { tampered: false };
    };
    // --- IPC HANDLERS ---
    ipcMain.handle('auth:get-users', () => {
        try {
            ensureDbOpen();
            const db = getDb();
            // Return active users for the login screen (without PINs obviously)
            return db.prepare("SELECT id, name, role, clinic_id FROM users WHERE active = 1").all();
        }
        catch (e) {
            if (e.message === 'DB_NOT_OPEN')
                return [];
            console.error('Failed to get users', e);
            return [];
        }
    });
    ipcMain.handle('auth:login', (_, { userId, pin, remember }) => {
        try {
            ensureDbOpen();
            const clockCheck = checkClockTampering();
            if (clockCheck.tampered) {
                return { success: false, error: clockCheck.message, code: 'CLOCK_TAMPERED' };
            }
            const db = getDb();
            const user = db.prepare("SELECT * FROM users WHERE id = ? AND active = 1").get(userId);
            if (!user) {
                return { success: false, error: 'User not found' };
            }
            const inputHash = hashPin(pin);
            if (inputHash !== user.pin_code) {
                return { success: false, error: 'Invalid PIN' };
            }
            // Success
            // Write to 'current_user_id' so getContext() works for this session
            appMetaService.set('current_user_id', user.id);
            appMetaService.set('last_login_at', new Date().toISOString());
            // Handle "Remember Me" Persistence
            if (remember) {
                appMetaService.set('remembered_user_id', user.id);
            }
            else {
                appMetaService.delete('remembered_user_id');
            }
            // Remove sensitive data before returning
            const { pin_code, ...safeUser } = user;
            return { success: true, user: safeUser };
        }
        catch (error) {
            console.error('Login error:', error);
            if (error.message === 'DB_NOT_OPEN')
                return { success: false, error: 'Database not ready' };
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle('auth:check', () => {
        console.log('AUTH CHECK HIT');
        try {
            ensureDbOpen();
            const clockCheck = checkClockTampering();
            if (clockCheck.tampered) {
                appMetaService.set('current_user_id', '');
                return { authenticated: false, error: clockCheck.message, code: 'CLOCK_TAMPERED' };
            }
            // --- SESSION RESTORATION LOGIC ---
            // If no active session, try to restore from remembered user
            // This is idempotent: safely runs on every check without side effects
            let currentUserId = appMetaService.get('current_user_id');
            const rememberedId = appMetaService.get('remembered_user_id');
            if (!currentUserId && rememberedId) {
                console.log(`[Auth] No active session. Restoring remembered user: ${rememberedId}`);
                appMetaService.set('current_user_id', rememberedId);
                currentUserId = rememberedId;
            }
            // ---------------------------------
            if (!currentUserId) {
                return { authenticated: false };
            }
            const db = getDb();
            const user = db.prepare("SELECT * FROM users WHERE id = ? AND active = 1").get(currentUserId);
            if (!user) {
                return { authenticated: false }; // User deleted or inactive
            }
            // Check if admin needs PIN change
            let mustChangePin = false;
            if (user.role === 'admin') {
                const pinChanged = appMetaService.get('admin_pin_changed');
                if (pinChanged !== 'true') { // 'true' string from storage
                    mustChangePin = true;
                }
            }
            const { pin_code, ...safeUser } = user;
            return { authenticated: true, user: safeUser, mustChangePin };
        }
        catch (error) {
            if (error.message === 'DB_NOT_OPEN') {
                console.warn('DB REQUEST BEFORE OPEN (auth:check)');
                return { authenticated: false, error: 'DB_NOT_OPEN', code: 'DB_NOT_OPEN' };
            }
            console.error('Auth Check Error:', error);
            return { authenticated: false, error: error.message };
        }
    });
    ipcMain.handle('auth:logout', () => {
        // Clear everything
        appMetaService.set('current_user_id', '');
        appMetaService.delete('remembered_user_id');
        return { success: true };
    });
    ipcMain.handle('auth:change-pin', (_, { oldPin, newPin }) => {
        try {
            ensureDbOpen();
            const currentUserId = appMetaService.get('current_user_id');
            if (!currentUserId)
                return { success: false, error: 'Not logged in' };
            const db = getDb();
            const user = db.prepare("SELECT * FROM users WHERE id = ?").get(currentUserId);
            if (!user)
                return { success: false, error: 'User not found' };
            // Verify Old PIN
            const oldHash = hashPin(oldPin);
            if (oldHash !== user.pin_code)
                return { success: false, error: 'Incorrect current PIN' };
            // Basic validation
            if (newPin.length < 4)
                return { success: false, error: 'PIN must be at least 4 digits' };
            if (newPin === '0000')
                return { success: false, error: 'Cannot use default PIN' };
            const newHash = hashPin(newPin);
            const transaction = db.transaction(() => {
                db.prepare('UPDATE users SET pin_code = ? WHERE id = ?').run(newHash, currentUserId);
                if (user.role === 'admin') {
                    appMetaService.set('admin_pin_changed', 'true');
                }
            });
            transaction();
            return { success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('auth:create-initial-admin', (_, { name, pin }) => {
        try {
            ensureDbOpen();
            const db = getDb();
            // Security: Check again if valid
            const anyUser = db.prepare('SELECT count(*) as count FROM users').get();
            if (anyUser.count > 0) {
                return { success: false, error: 'Admin already exists' };
            }
            if (!name || pin.length < 4) {
                return { success: false, error: 'Invalid data' };
            }
            const id = crypto.randomUUID();
            const pinHash = hashPin(pin);
            // Try to get clinic ID
            let clinicId = 'clinic_default';
            try {
                const setting = db.prepare('SELECT id FROM clinic_settings LIMIT 1').get();
                if (setting)
                    clinicId = setting.id;
            }
            catch { }
            db.prepare(`
                INSERT INTO users (id, clinic_id, name, role, pin_code, active)
                VALUES (?, ?, ?, 'admin', ?, 1)
            `).run(id, clinicId, name, pinHash);
            // Allow this specific PIN since they just created it
            appMetaService.set('admin_pin_changed', 'true');
            return { success: true };
        }
        catch (e) {
            console.error('Create Admin Failed', e);
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('auth:change-password', (_, { currentPassword, newPassword, confirmNewPassword }) => {
        try {
            ensureDbOpen();
            const currentUserId = appMetaService.get('current_user_id');
            if (!currentUserId)
                return { success: false, error: 'Not logged in' };
            // Validation
            if (!newPassword || newPassword.trim() === '')
                return { success: false, error: 'New password cannot be empty' };
            if (newPassword !== confirmNewPassword)
                return { success: false, error: 'New passwords do not match' };
            const db = getDb();
            const user = db.prepare("SELECT * FROM users WHERE id = ?").get(currentUserId);
            if (!user)
                return { success: false, error: 'User not found' };
            // Verify Current
            const currentHash = hashPin(currentPassword);
            if (currentHash !== user.pin_code)
                return { success: false, error: 'Incorrect current password' };
            // Update
            const newHash = hashPin(newPassword);
            const transaction = db.transaction(() => {
                db.prepare('UPDATE users SET pin_code = ? WHERE id = ?').run(newHash, currentUserId);
                if (user.role === 'admin') {
                    appMetaService.set('admin_pin_changed', 'true');
                }
            });
            transaction();
            return { success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('auth:check-admin-exists', () => {
        try {
            ensureDbOpen();
            const db = getDb();
            // Check for ANY user really, but admin specifically
            const result = db.prepare("SELECT count(*) as count FROM users WHERE role = 'admin'").get();
            return result.count > 0;
        }
        catch (e) {
            if (e.message === 'DB_NOT_OPEN')
                return false;
            console.error("Check admin exists failed", e);
            return false;
        }
    });
}
