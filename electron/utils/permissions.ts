import { appMetaService } from '../services/appMetaService.js';
import { getDb } from '../db/init.js';

export const verifyPermission = (permissionCode: string) => {
    const userId = appMetaService.get('current_user_id');
    if (!userId) throw new Error('NOT_LOGGED_IN: Authentication required.');

    const db = getDb();
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
    if (!user) throw new Error('USER_NOT_FOUND');

    // Admin has all permissions
    if (user.role === 'admin') return;

    // Check assigned permissions
    const perm = db.prepare(`
        SELECT 1 FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        WHERE up.user_id = ? AND p.code = ?
    `).get(userId, permissionCode);

    if (!perm) {
        console.warn(`[Permission Denied] User ${userId} tried ${permissionCode}`);
        throw new Error(`PERMISSION_DENIED: You do not have permission: ${permissionCode}`);
    }
};
