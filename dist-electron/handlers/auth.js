import { ipcMain } from 'electron';
import { getDb, ensureDbOpen } from '../db/init.js';
import { appMetaService } from '../services/appMetaService.js';
import crypto from 'crypto';
import { z } from 'zod';
import { getCurrentClinicId } from '../db/getCurrentClinicId.js';
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
        const db = getDb();
        // Ensure table (idempotent)
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                clinic_id TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin', 'doctor', 'staff')),
                pin_code TEXT,
                username TEXT UNIQUE,
                password TEXT,
                active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS permissions (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_permissions (
                user_id TEXT NOT NULL,
                permission_id TEXT NOT NULL,
                PRIMARY KEY (user_id, permission_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            );

        `);
        // FIX: Explicitly check for Admin without PIN and fix it
        const adminUser = db.prepare("SELECT id, name, pin_code FROM users WHERE role = 'admin'").get();
        if (adminUser) {
            if (!adminUser.pin_code || adminUser.pin_code.trim() === '') {
                console.log(`[Auth] found Admin (${adminUser.name}) with missing PIN. Setting default '0000'...`);
                const defaultHash = hashPin('0000');
                db.prepare('UPDATE users SET pin_code = ? WHERE id = ?').run(defaultHash, adminUser.id);
            }
        }
        else {
            console.log('[Auth] No admin user found yet.');
        }
        // --- MIGRATION: Add username/password if missing ---
        const userCols = db.prepare('PRAGMA table_info(users)').all();
        if (!userCols.some(c => c.name === 'username')) {
            try {
                db.prepare('ALTER TABLE users ADD COLUMN username TEXT UNIQUE').run();
            }
            catch (e) { }
        }
        if (!userCols.some(c => c.name === 'password')) {
            try {
                db.prepare('ALTER TABLE users ADD COLUMN password TEXT').run();
            }
            catch (e) { }
        }
        // --- SEED PERMISSIONS ---
        const defaultPermissions = [
            // Patients
            { code: 'ADD_PATIENT', name: 'إضافة مريض جديد' },
            { code: 'EDIT_PATIENT', name: 'تعديل بيانات مريض' },
            { code: 'DELETE_PATIENT', name: 'حذف مريض' },
            { code: 'DELETE_PATIENT', name: 'حذف مريض' },
            // Appointments
            { code: 'ADD_APPOINTMENT', name: 'حجز موعد' },
            { code: 'EDIT_APPOINTMENT', name: 'تعديل موعد' },
            { code: 'DELETE_APPOINTMENT', name: 'حذف موعد' },
            { code: 'DELETE_APPOINTMENT', name: 'حذف موعد' },
            // Medical Actions
            { code: 'ADD_TREATMENT', name: 'إضافة خطة علاجية' },
            { code: 'DELETE_TREATMENT', name: 'حذف خطة علاجية' },
            { code: 'UPLOAD_XRAY', name: 'رفع أشعة وصور' },
            { code: 'DELETE_ATTACHMENT', name: 'حذف مرفقات' },
            // Financial
            { code: 'CREATE_INVOICE', name: 'إنشاء فاتورة' },
            { code: 'VIEW_FINANCIAL_REPORTS', name: 'عرض التقارير المالية' },
            { code: 'VIEW_PAYMENTS', name: 'عرض سجل الدفعات' },
            { code: 'VIEW_EXPENSES', name: 'عرض المصروفات' },
            { code: 'ADD_EXPENSE', name: 'إضافة مصروف' },
            { code: 'EDIT_EXPENSE', name: 'تعديل مصروف' },
            { code: 'DELETE_EXPENSE', name: 'حذف مصروف' },
            { code: 'MANAGE_EXPENSES', name: 'إدارة المصروفات' }, // Deprecated but kept for safety
            // Inventory
            { code: 'VIEW_STOCK', name: 'عرض المخزون' },
            { code: 'ADD_ITEM', name: 'إضافة صنف' },
            { code: 'SUBTRACT_ITEM', name: 'خصم مواد' },
            { code: 'VIEW_STOCK_REPORTS', name: 'تقارير المخزون' },
            // Lab
            { code: 'ADD_LAB_ORDER', name: 'إضافة طلب معمل' },
            { code: 'DELETE_LAB_ORDER', name: 'حذف طلب معمل' },
            { code: 'LAB_PAYMENT', name: 'تسجيل دفعة معمل' },
            { code: 'LAB_STATUS_UPDATE', name: 'استلام وتحديث حالة طلب' },
            // System
            { code: 'VIEW_SETTINGS', name: 'عرض الإعدادات' },
            { code: 'ADD_USER', name: 'إضافة مستخدمين' },
            { code: 'CLINIC_SETTINGS', name: 'إعدادات العيادة' },
            { code: 'MANAGE_LICENSE', name: 'إدارة الرخصة' }
        ];
        const insertPerm = db.prepare('INSERT OR IGNORE INTO permissions (id, code, name) VALUES (?, ?, ?)');
        const updatePerm = db.prepare('UPDATE permissions SET name = ? WHERE code = ?');
        defaultPermissions.forEach(p => {
            const existing = db.prepare('SELECT id FROM permissions WHERE code = ?').get(p.code);
            if (!existing) {
                insertPerm.run(crypto.randomUUID(), p.code, p.name);
            }
            else {
                updatePerm.run(p.name, p.code); // Update name if exists (to apply translations)
            }
        });
    }
    catch (e) {
        console.warn('Failed to initialize users table or permissions', e);
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
            const users = db.prepare("SELECT id, name, role, clinic_id FROM users WHERE active = 1").all();
            // Unify clinic_id for frontend representation
            const unifiedClinicId = getCurrentClinicId();
            return users.map(u => ({ ...u, clinic_id: unifiedClinicId }));
        }
        catch (e) {
            if (e.message === 'DB_NOT_OPEN')
                return [];
            console.error('Failed to get users', e);
            return [];
        }
    });
    ipcMain.handle('auth:get-permissions', () => {
        try {
            ensureDbOpen();
            return getDb().prepare("SELECT * FROM permissions ORDER BY name ASC").all();
        }
        catch (e) {
            console.error('Failed to get permissions', e);
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
            // Fetch Permissions
            const perms = db.prepare(`
                SELECT p.code 
                FROM permissions p 
                JOIN user_permissions up ON p.id = up.permission_id 
                WHERE up.user_id = ?
            `).all(user.id);
            const permissionCodes = perms.map(p => p.code);
            // Remove sensitive data before returning
            const { pin_code, password, ...safeUser } = user;
            // Unify clinic_id
            safeUser.clinic_id = getCurrentClinicId();
            return { success: true, user: { ...safeUser, permissions: permissionCodes } };
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
            const { pin_code, password, ...safeUser } = user;
            // Fetch Permissions
            const perms = db.prepare(`
                SELECT p.code 
                FROM permissions p 
                JOIN user_permissions up ON p.id = up.permission_id 
                WHERE up.user_id = ?
            `).all(user.id);
            const permissionCodes = perms.map(p => p.code);
            // Unify clinic_id
            safeUser.clinic_id = getCurrentClinicId();
            return { authenticated: true, user: { ...safeUser, permissions: permissionCodes }, mustChangePin };
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
            // Get proper clinic ID using unified method
            const clinicId = getCurrentClinicId();
            // (Old fallback logic removed to prevent using clinic_settings.id)
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
    ipcMain.handle('user:create', (_, data) => {
        try {
            ensureDbOpen();
            const currentUserId = appMetaService.get('current_user_id');
            if (!currentUserId)
                return { success: false, error: 'Not logged in' };
            const db = getDb();
            // 1. Verify Admin
            const adminUser = db.prepare("SELECT * FROM users WHERE id = ?").get(currentUserId);
            if (!adminUser || adminUser.role !== 'admin') {
                return { success: false, error: 'Unauthorized: Only Admins can create users.' };
            }
            // 2. Validate Input (Zod)
            const userSchema = z.object({
                name: z.string().min(2),
                role: z.enum(['doctor', 'staff']),
                pin: z.string().min(4),
                permissions: z.array(z.string()).optional()
            });
            const validation = userSchema.safeParse(data);
            if (!validation.success) {
                return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
            }
            const { name, role, pin, permissions } = validation.data;
            // 3. Hash Credentials
            const pinHash = hashPin(pin);
            // 4. Insert User
            const newId = crypto.randomUUID();
            const transaction = db.transaction(() => {
                db.prepare(`
                    INSERT INTO users (id, clinic_id, name, role, pin_code, active, created_at)
                    VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
                `).run(newId, adminUser.clinic_id, name, role, pinHash);
                // 5. Insert Permissions
                if (permissions && permissions.length > 0) {
                    const insertUserPerm = db.prepare('INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)');
                    const getPermId = db.prepare('SELECT id FROM permissions WHERE code = ?');
                    for (const code of permissions) {
                        const perm = getPermId.get(code);
                        if (perm) {
                            insertUserPerm.run(newId, perm.id);
                        }
                    }
                }
            });
            transaction();
            console.log(`[User Management] Admin ${adminUser.name} created user ${name} (${role})`);
            return { success: true };
        }
        catch (e) {
            console.error('Create User Failed:', e);
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('users:get-permissions', (_, userId) => {
        try {
            ensureDbOpen();
            const db = getDb();
            const perms = db.prepare(`
                SELECT p.code 
                FROM permissions p 
                JOIN user_permissions up ON p.id = up.permission_id 
                WHERE up.user_id = ?
            `).all(userId);
            return perms.map(p => p.code);
        }
        catch (e) {
            console.error('Get User Permissions Failed:', e);
            return [];
        }
    });
    ipcMain.handle('users:update-permissions', (_, { userId, permissions }) => {
        try {
            ensureDbOpen();
            const currentUserId = appMetaService.get('current_user_id');
            if (!currentUserId)
                return { success: false, error: 'Not logged in' };
            const db = getDb();
            // Check requester permissions 
            // (Strictly we should check if they represent an admin or have EDIT_PERMISSIONS, 
            // but for now we assume UI handles visibility and we double check role/permissions here if needed.
            // Let's check if requester is admin OR has EDIT_PERMISSIONS)
            const requester = db.prepare("SELECT * FROM users WHERE id = ?").get(currentUserId);
            if (!requester)
                return { success: false, error: 'Requester not found' };
            const requesterPerms = db.prepare(`
                SELECT p.code FROM permissions p 
                JOIN user_permissions up ON p.id = up.permission_id 
                WHERE up.user_id = ?
            `).all(requester.id);
            const requesterPermCodes = requesterPerms.map(p => p.code);
            if (requester.role !== 'admin' && !requesterPermCodes.includes('ADD_USER')) {
                return { success: false, error: 'Unauthorized' };
            }
            const transaction = db.transaction(() => {
                // Delete existing
                db.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(userId);
                // Insert new
                if (permissions && permissions.length > 0) {
                    const insertUserPerm = db.prepare('INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)');
                    const getPermId = db.prepare('SELECT id FROM permissions WHERE code = ?');
                    for (const code of permissions) {
                        const perm = getPermId.get(code);
                        if (perm) {
                            insertUserPerm.run(userId, perm.id);
                        }
                    }
                }
            });
            transaction();
            return { success: true };
        }
        catch (e) {
            console.error('Update User Permissions Failed:', e);
            return { success: false, error: e.message };
        }
    });
}
