import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { getDb } from '../db/init.js';
import { getCurrentClinicId } from '../db/getCurrentClinicId.js';
import crypto from 'crypto';
import { networkInterfaces } from 'os';
import { licenseService } from '../license/license.service.js';
import path from 'path';
import { backupService } from '../services/backupService.js';
import { googleDriveService } from '../services/googleDriveService.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __localDirname = path.dirname(__filename);


export const startLocalServer = (port = 3000) => {
    const app = express();
    // Increase payload limit for large image/x-ray uploads
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));


    app.use(cors({
        origin: true, // Allow all origins for local network client
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    }));
    // body-parser is redundant with express.json usually, but if used:
    app.use(bodyParser.json({ limit: '50mb' }));

    // --- DEBUG LOGGING ---
    app.use((req, res, next) => {
        console.log(`[API REQUEST] ${req.method} ${req.path}`);
        next();
    });

    // --- SERVER HEALTH CHECK (Public) ---
    app.get('/api/health', (req, res) => {
        const startTime = Date.now();
        let dbStatus = 'unknown';
        let dbError = null;
        let dbStats = null;

        try {
            const db = getDb();
            // Quick DB check
            const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
            dbStatus = 'connected';
            dbStats = {
                usersCount: result?.count || 0,
            };

            // Get more stats
            try {
                const patients = db.prepare('SELECT COUNT(*) as count FROM patients WHERE is_deleted IS NULL OR is_deleted = 0').get() as any;
                const appointments = db.prepare('SELECT COUNT(*) as count FROM appointments').get() as any;
                dbStats = {
                    ...dbStats,
                    patientsCount: patients?.count || 0,
                    appointmentsCount: appointments?.count || 0
                };
            } catch (e) { /* Optional stats failed, continue */ }

        } catch (e: any) {
            dbStatus = 'error';
            dbError = e.message;
        }

        const responseTime = Date.now() - startTime;

        res.json({
            status: dbStatus === 'connected' ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            responseTime: `${responseTime}ms`,
            services: {
                api: {
                    status: 'online',
                    version: process.env.npm_package_version || '1.0.0'
                },
                database: {
                    status: dbStatus,
                    error: dbError,
                    stats: dbStats
                }
            },
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                memoryUsage: {
                    heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
                    heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
                }
            }
        });
    });

    // --- DEBUG: Permissions Dump (Public) ---
    app.get('/api/debug/permissions', (req, res) => {
        try {
            const db = getDb();
            const users = db.prepare("SELECT id, name, role FROM users").all();
            const userPerms = db.prepare(`
                SELECT u.name, p.code 
                FROM user_permissions up
                JOIN users u ON up.user_id = u.id
                JOIN permissions p ON up.permission_id = p.id
                ORDER BY u.name
            `).all();
            res.json({
                users,
                assignedPermissions: userPerms,
                allDefinedPermissions: db.prepare("SELECT * FROM permissions").all()
            });
        } catch (e: any) { res.json({ error: e.message }); }
    });

    // Middleware: Authentication & Context
    app.use((req, res, next) => {
        // Skip auth for non-API routes (Frontend Static Files)
        if (!req.path.startsWith('/api')) return next();

        // Skip auth for OPTIONS (Preflight), login, and public endpoints
        if (req.method === 'OPTIONS') return next();
        if (req.path === '/api/auth/login') return next();
        if (req.path === '/api/auth/check') return next();
        if (req.path.startsWith('/api/public/')) return next();
        if (req.path.startsWith('/api/settings/clinic-info')) return next();
        if (req.path === '/api/debug/permissions') return next();
        if (req.path === '/api/health') return next();

        // Allow public read access to shared metadata needed for UI initialization
        if (req.method === 'GET') {
            if (req.path === '/api/services') return next();
            if (req.path === '/api/cities') return next();
            if (req.path === '/api/doctors') return next();
            if (req.path === '/api/labs') return next();
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized: Missing token' });
            return;
        }

        const token = authHeader.split(' ')[1];

        const user = getSession(token);
        if (!user) {
            res.status(401).json({ error: 'Unauthorized: Invalid token' });
            return;
        }

        // AUTO-REFRESH PERMISSIONS FROM DB
        // This ensures that if admin changes permissions, the user gets them immediately without re-login
        try {
            const db = getDb();
            const perms = db.prepare(`
                SELECT p.code 
                FROM permissions p 
                JOIN user_permissions up ON p.id = up.permission_id 
                WHERE up.user_id = ?
            `).all(user.id) as any[];
            user.permissions = perms.map(p => p.code);
        } catch (e) {
            console.error("Failed to refresh permissions in middleware", e);
        }

        // Attach user to request
        (req as any).user = user;

        // --- LICENSE ENFORCEMENT ---
        // Block write operations if the license is expired/invalid (Read-Only Mode)
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
            // Exceptions: Allow specific routes if needed (e.g., license activation via API if implemented in future)
            const isExempt = req.path.startsWith('/api/license');

            if (!isExempt && !licenseService.isWriteAllowed()) {
                console.warn(`[API] ⛔ Blocked ${req.method} ${req.path} - License Expired/Read-Only`);
                res.status(403).json({ error: 'LICENSE_EXPIRED: Your subscription has expired. The system is in read-only mode.' });
                return;
            }
        }

        next();
    });

    // --- SECURED: Backup & Google Drive Routes ---
    // Link Google Drive
    app.post('/api/backup/google-drive/auth-url', async (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access Denied: Admins Only' });
        try {
            const { googleDriveService } = await import('../services/googleDriveService.js');
            const url = googleDriveService.getAuthUrl();
            res.json({ url });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/backup/google-drive/auth-callback', async (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access Denied: Admins Only' });
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: "Code required" });
        try {
            const { googleDriveService } = await import('../services/googleDriveService.js');
            await googleDriveService.verifyCode(code);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // --- Backup Status & Actions ---
    app.get('/api/backup/config', async (req, res) => {
        try {
            const schedule = backupService.getSchedule();
            const localPath = backupService.getLocalPath();
            const lastBackupDate = backupService.getLastBackupDate();
            res.json({ schedule, localPath, lastBackupDate });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/backup/create', async (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });
        const { password } = req.body;
        try {
            const result = await backupService.performBackup({ password, mode: 'local' });
            res.json(result);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/backup/cloud/user', async (req, res) => {
        try {
            const user = await googleDriveService.getUserInfo();
            res.json(user);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/backup/cloud/files', async (req, res) => {
        try {
            const files = await googleDriveService.listFiles();
            res.json(files);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/backup/cloud/create', async (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });
        const { password } = req.body;
        try {
            // Assuming mode: 'cloud' uploads current DB or triggers backup then upload
            const result = await backupService.performBackup({ password, mode: 'cloud' });
            res.json(result);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });



    // --- License ---
    app.get('/api/license/status', (req, res) => {
        try {
            const status = licenseService.getInternalState();
            res.json(status);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/backup/google-drive/user', async (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access Denied: Admins Only' });
        try {
            const { googleDriveService } = await import('../services/googleDriveService.js');
            const user = await googleDriveService.getUserInfo();
            res.json(user);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/backup/google-drive/files', async (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access Denied: Admins Only' });
        try {
            const { googleDriveService } = await import('../services/googleDriveService.js');
            const files = await googleDriveService.listFiles();
            res.json(files);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/backup/google-drive/files/:id', async (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access Denied: Admins Only' });
        const { id } = req.params;
        try {
            const { googleDriveService } = await import('../services/googleDriveService.js');
            await googleDriveService.deleteFile(id);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/backup/google-drive/unlink', async (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access Denied: Admins Only' });
        try {
            const { googleDriveService } = await import('../services/googleDriveService.js');
            await googleDriveService.logout();
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // Backup Settings
    app.get('/api/backup/local-path', async (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access Denied: Admins Only' });
        try {
            const { backupService } = await import('../services/backupService.js');
            const path = backupService.getLocalPath();
            res.json({ path });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/backup/local-path', async (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access Denied: Admins Only' });
        const { path } = req.body;
        try {
            const { backupService } = await import('../services/backupService.js');
            backupService.setLocalPath(path);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/backup/schedule', async (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access Denied: Admins Only' });
        try {
            const { backupService } = await import('../services/backupService.js');
            const frequency = backupService.getSchedule();
            res.json({ frequency });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/backup/schedule', async (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access Denied: Admins Only' });
        const { frequency } = req.body;
        try {
            const { backupService } = await import('../services/backupService.js');
            backupService.setSchedule(frequency);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/backup/last-date', async (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access Denied: Admins Only' });
        try {
            const { backupService } = await import('../services/backupService.js');
            const date = backupService.getLastBackupDate();
            res.json({ date });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // Perform Backup
    app.post('/api/backup/create', async (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access Denied: Admins Only' });
        const { mode, password } = req.body;
        try {
            const { backupService } = await import('../services/backupService.js');
            const result = await backupService.performBackup({ mode, password });
            res.json(result);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // --- Public: Get Users for Login Screen ---
    app.get('/api/public/users', (req, res) => {
        try {
            const db = getDb();
            // Return only safe fields needed for selection
            const users = db.prepare('SELECT id, name, role, clinic_id FROM users WHERE active = 1').all();
            res.json(users);
        } catch (e: any) {
            console.error("API Error /api/public/users:", e);
            res.status(500).json({ error: e.message });
        }
    });

    // --- Auth ---
    app.post('/api/auth/login', (req, res) => {
        const { userId, pin } = req.body;
        if (!pin) { res.status(400).json({ error: 'PIN required' }); return; }

        try {
            const salt = 'dental-flow-local-salt';
            const hash = crypto.scryptSync(pin, salt, 64).toString('hex');
            const db = getDb();

            let user;
            if (userId) {
                user = db.prepare('SELECT id, name, role, clinic_id, pin_code FROM users WHERE id = ? AND active = 1').get(userId) as any;
                if (user && user.pin_code !== hash) {
                    res.status(401).json({ error: 'Invalid PIN' });
                    return;
                }
                if (!user) {
                    res.status(401).json({ error: 'User not found' });
                    return;
                }
            } else {
                user = db.prepare('SELECT id, name, role, clinic_id FROM users WHERE pin_code = ? AND active = 1').get(hash) as any;
            }

            if (user) {
                // Fetch Permissions
                try {
                    const perms = db.prepare(`
                        SELECT p.code 
                        FROM permissions p 
                        JOIN user_permissions up ON p.id = up.permission_id 
                        WHERE up.user_id = ?
                    `).all(user.id) as any[];
                    user.permissions = perms.map(p => p.code);
                } catch (e) {
                    console.error("Failed to fetch permissions during login", e);
                    user.permissions = [];
                }

                const token = createSession(user);
                res.json({ token, user: { name: user.name, role: user.role, clinic_id: user.clinic_id, permissions: user.permissions } });
            } else {
                res.status(401).json({ error: 'Invalid PIN' });
            }
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // --- Middleware Exception for auth/check (Done below in replace_file_content 2/2) --- 

    app.get('/api/auth/check', (req, res) => {
        // Manually check token to avoid 401 logging in client console
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.json({ authenticated: false });
            return;
        }
        const token = authHeader.split(' ')[1];
        let user = getSession(token);

        if (user) {
            // REFRESH PERMISSIONS FROM DB
            try {
                const db = getDb();
                const perms = db.prepare(`
                    SELECT p.code 
                    FROM permissions p 
                    JOIN user_permissions up ON p.id = up.permission_id 
                    WHERE up.user_id = ?
                `).all(user.id) as any[];

                // Update user permissions in object and potentially in session store if mutable
                user.permissions = perms.map(p => p.code);

                // Note: getSession likely returns a reference to the stored object in memory (since sessions is a simple Map or object)
                // So updating 'user' here updates the session cache.
            } catch (e) {
                console.error("Failed to refresh permissions in auth check", e);
            }

            res.json({ authenticated: true, user: { name: user.name, role: user.role, clinic_id: user.clinic_id, permissions: user.permissions } });
        } else {
            res.json({ authenticated: false });
        }
    });

    app.get('/api/auth/permissions', (req, res) => {
        const user = (req as any).user;
        if (!user) return res.json([]);
        res.json(user.permissions || []);
    });

    // --- Patients ---
    app.get('/api/patients', (req, res) => {
        const user = (req as any).user;
        const db = getDb();
        try {
            const patients = db.prepare(`SELECT * FROM patients WHERE (is_deleted IS NULL OR is_deleted = 0) ORDER BY updated_at DESC LIMIT 50`).all();
            res.json(patients);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // Get single patient by ID (including soft-deleted to preserve name in records)
    app.get('/api/patients/:id', (req, res) => {
        const { id } = req.params;
        try {
            const db = getDb();
            // Return patient even if soft-deleted so name appears in appointments/invoices
            const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
            if (!patient) {
                return res.status(404).json({ error: 'Patient not found' });
            }
            res.json(patient);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/patients', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' && !user.permissions?.includes('ADD_PATIENT')) {
            return res.status(403).json({ error: 'Access Denied: You do not have permission to ADD_PATIENT' });
        }

        let { name, full_name, phone, gender } = req.body;
        // Handle mismatch
        if (!name && full_name) name = full_name;

        if (!name || !phone) { res.status(400).json({ error: 'Name and Phone required' }); return; }

        try {
            const db = getDb();
            const id = crypto.randomUUID();
            const maxId = (db.prepare('SELECT MAX(display_id) as max FROM patients').get() as any)?.max || 0;
            const displayId = maxId + 1;

            db.prepare(`
                INSERT INTO patients (id, display_id, clinic_id, full_name, phone, gender, created_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(id, displayId, user.clinic_id, name, phone, gender);

            res.json({ success: true, id });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.put('/api/patients/:id', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' && !user.permissions?.includes('EDIT_PATIENT')) {
            return res.status(403).json({ error: 'Access Denied: You do not have permission to EDIT_PATIENT' });
        }
        const { id } = req.params;
        const { full_name, phone, gender } = req.body;
        try {
            const db = getDb();
            db.prepare('UPDATE patients SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone), gender = COALESCE(?, gender), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(full_name, phone, gender, id);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/patients/:id', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' && !user.permissions?.includes('DELETE_PATIENT')) {
            return res.status(403).json({ error: 'Access Denied: You do not have permission to DELETE_PATIENT' });
        }
        const { id } = req.params;
        // Get deletion options from request body
        const { deleteAppointments, deleteTreatmentCases, deleteInvoices } = req.body || {};

        try {
            const db = getDb();

            db.transaction(() => {
                // Delete related data based on options
                if (deleteAppointments) {
                    db.prepare('DELETE FROM appointments WHERE patient_id = ?').run(id);
                }

                if (deleteTreatmentCases) {
                    // Delete invoices linked to treatment cases first (to avoid FK errors)
                    db.prepare('DELETE FROM invoices WHERE treatment_case_id IN (SELECT id FROM treatment_cases WHERE patient_id = ?)').run(id);
                    db.prepare('DELETE FROM treatment_cases WHERE patient_id = ?').run(id);
                }

                if (deleteInvoices) {
                    db.prepare('DELETE FROM invoices WHERE patient_id = ?').run(id);
                }

                // Soft delete the patient (keeps name visible in remaining records)
                db.prepare('UPDATE patients SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
            })();

            res.json({ success: true });
        } catch (e: any) {
            console.error('[API Error] DELETE /api/patients:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Get patient stats for delete dialog
    app.get('/api/patients/:id/stats', (req, res) => {
        const { id } = req.params;
        try {
            const db = getDb();

            // Count appointments
            const appointmentsCount = (db.prepare('SELECT COUNT(*) as count FROM appointments WHERE patient_id = ?').get(id) as any)?.count || 0;

            // Count invoices
            const invoicesCount = (db.prepare('SELECT COUNT(*) as count FROM invoices WHERE patient_id = ?').get(id) as any)?.count || 0;

            // Count treatment cases
            const treatmentCasesCount = (db.prepare('SELECT COUNT(*) as count FROM treatment_cases WHERE patient_id = ?').get(id) as any)?.count || 0;

            res.json({
                appointmentsCount,
                invoicesCount,
                treatmentCasesCount
            });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // --- Doctors ---
    // --- Doctors ---
    app.get('/api/doctors', (req, res) => {
        try {
            const db = getDb();
            // Exclude soft-deleted doctors
            const doctors = db.prepare('SELECT * FROM doctors WHERE is_deleted = 0 OR is_deleted IS NULL').all();
            res.json(doctors);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/doctors', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access Denied: Admins Only' });
        const { name, role, commission_type, commission_value } = req.body;

        console.log(`[API] Creating Doctor. User: ${user?.name} (${user?.role}), Clinic: ${user?.clinic_id}`);
        console.log(`[API] Payload:`, req.body);

        try {
            const db = getDb();
            const id = crypto.randomUUID();
            db.prepare(`
                INSERT INTO doctors (id, clinic_id, name, role, commission_type, commission_value, active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            `).run(id, user.clinic_id, name, role || 'doctor', commission_type || 'percentage', commission_value || 0);

            res.json({ success: true, id });
        } catch (e: any) {
            console.error("[API Error] Create Doctor Failed:", e);
            res.status(500).json({ error: e.message });
        }
    });

    app.put('/api/doctors/:id', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access Denied: Admins Only' });
        const { id } = req.params;
        const data = req.body; // Partial update

        try {
            const db = getDb();

            // Construct dynamic update query
            const keys = Object.keys(data);
            if (keys.length === 0) return res.json({ success: true });

            const setClause = keys.map(k => `${k} = ?`).join(', ');
            const values = keys.map(k => data[k]);

            // Add ID to values
            values.push(id);

            db.prepare(`UPDATE doctors SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/doctors/:id', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' && !user.permissions?.includes('CLINIC_SETTINGS')) return res.status(403).json({ error: 'Access Denied: Requires Admin or CLINIC_SETTINGS' });
        const { id } = req.params;
        try {
            const db = getDb();
            // Soft delete
            db.prepare('UPDATE doctors SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // --- Services ---
    app.get('/api/services', (req, res) => {
        try {
            const db = getDb();
            const services = db.prepare('SELECT * FROM services WHERE is_deleted IS NULL OR is_deleted = 0 ORDER BY name ASC').all();
            res.json(services);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/services', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' && !user.permissions?.includes('CLINIC_SETTINGS')) return res.status(403).json({ error: 'Access Denied: Requires Admin or CLINIC_SETTINGS' });
        const { name, default_price } = req.body;

        try {
            const db = getDb();
            const id = crypto.randomUUID();
            db.prepare(`
                INSERT INTO services (id, clinic_id, name, default_price, created_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(id, user.clinic_id, name, default_price || 0);

            res.json({ success: true, id });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.put('/api/services/:id', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' && !user.permissions?.includes('CLINIC_SETTINGS')) return res.status(403).json({ error: 'Access Denied: Requires Admin or CLINIC_SETTINGS' });
        const { id } = req.params;
        const data = req.body;
        try {
            const db = getDb();
            const keys = Object.keys(data);
            if (keys.length === 0) return res.json({ success: true });

            const setClause = keys.map(k => `${k} = ?`).join(', ');
            const values = keys.map(k => data[k]);
            values.push(id);

            db.prepare(`UPDATE services SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/services/:id', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' && !user.permissions?.includes('CLINIC_SETTINGS')) return res.status(403).json({ error: 'Access Denied: Requires Admin or CLINIC_SETTINGS' });
        const { id } = req.params;
        try {
            getDb().prepare('UPDATE services SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // --- Cities ---
    app.get('/api/cities', (req, res) => {
        try {
            const db = getDb();
            const cities = db.prepare('SELECT * FROM cities WHERE is_deleted IS NULL OR is_deleted = 0 ORDER BY name ASC').all();
            res.json(cities);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/cities', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' && !user.permissions?.includes('CLINIC_SETTINGS')) return res.status(403).json({ error: 'Access Denied: Requires Admin or CLINIC_SETTINGS' });
        const { name } = req.body;

        console.log('[API] Creating City for user:', user);

        try {
            const db = getDb();
            const id = crypto.randomUUID();

            let clinicId = user?.clinic_id;
            if (!clinicId) {
                console.warn('[API] Warning: user.clinic_id is missing. Fallback to default.');
                const clinic = db.prepare('SELECT id FROM clinics LIMIT 1').get() as { id: string };
                clinicId = clinic?.id || 'clinic_001';
            }

            db.prepare('INSERT INTO cities (id, name, clinic_id, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)').run(id, name, clinicId);

            res.json({ success: true, id });
        } catch (e: any) {
            console.error('[API Error] Create City:', e);
            res.status(500).json({ error: e.message });
        }
    });

    app.put('/api/cities/:id', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' && !user.permissions?.includes('CLINIC_SETTINGS')) return res.status(403).json({ error: 'Access Denied: Requires Admin or CLINIC_SETTINGS' });
        const { id } = req.params;
        const { name } = req.body;
        try {
            const db = getDb();
            db.prepare('UPDATE cities SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, id);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/cities/:id', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' && !user.permissions?.includes('CLINIC_SETTINGS')) return res.status(403).json({ error: 'Access Denied: Requires Admin or CLINIC_SETTINGS' });
        const { id } = req.params;
        try {
            const db = getDb();
            db.prepare('UPDATE cities SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // --- Appointments ---
    app.get('/api/appointments', (req, res) => {
        const user = (req as any).user;
        const db = getDb();
        try {
            // Simple daily view or all? Let's limit to recent/active for performance
            const apps = db.prepare(`
                SELECT a.*, p.full_name as patient_name 
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                ORDER BY a.date DESC
                LIMIT 100
            `).all();
            res.json(apps);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/appointments', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' && !user.permissions?.includes('ADD_APPOINTMENT')) {
            return res.status(403).json({ error: 'Access Denied: You do not have permission to ADD_APPOINTMENT' });
        }
        const { patient_id, doctor_id, date, time, status, service_id, notes } = req.body;
        if (!patient_id || !date || !time) return res.status(400).json({ error: "Missing fields: patient_id, date, and time are required" });

        try {
            const db = getDb();
            const id = crypto.randomUUID();
            db.prepare(`INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, date, time, status, service_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
                .run(id, user.clinic_id, patient_id, doctor_id, date, time, status || 'scheduled', service_id, notes);
            res.json({ success: true, id });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.put('/api/appointments/:id', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' && !user.permissions?.includes('EDIT_APPOINTMENT')) {
            return res.status(403).json({ error: 'Access Denied: You do not have permission to EDIT_APPOINTMENT' });
        }
        const { id } = req.params;
        const { date, status, notes, doctor_id, service_id } = req.body;
        try {
            const db = getDb();
            db.prepare(`UPDATE appointments SET date=COALESCE(?,date), status=COALESCE(?,status), notes=COALESCE(?,notes), doctor_id=COALESCE(?,doctor_id), service_id=COALESCE(?,service_id), updated_at=CURRENT_TIMESTAMP WHERE id=? AND clinic_id=?`)
                .run(date, status, notes, doctor_id, service_id, id, user.clinic_id);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/appointments/:id', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' && !user.permissions?.includes('DELETE_APPOINTMENT')) {
            return res.status(403).json({ error: 'Access Denied: You do not have permission to DELETE_APPOINTMENT' });
        }
        const { id } = req.params;
        try {
            const db = getDb();
            db.prepare('DELETE FROM appointments WHERE id = ? AND clinic_id = ?').run(id, user.clinic_id);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // --- Treatment Cases ---
    app.get('/api/treatment-cases', (req, res) => {
        const user = (req as any).user;
        const { patient_id } = req.query;

        try {
            const db = getDb();
            let query = 'SELECT * FROM treatment_cases WHERE (clinic_id = ? OR clinic_id = ?)';
            const params: any[] = [user.clinic_id, 'clinic_001'];

            if (patient_id) {
                query += ' AND patient_id = ?';
                params.push(patient_id);
            }

            query += ' ORDER BY created_at DESC';

            const cases = db.prepare(query).all(...params);
            res.json(cases);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // --- Complex Actions (Attended) ---
    app.post('/api/appointments/attended', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' && !user.permissions?.includes('EDIT_APPOINTMENT')) {
            return res.status(403).json({ error: 'Access Denied: You do not have permission to EDIT_APPOINTMENT' });
        }
        const {
            appointmentId,
            treatmentCaseId,
            serviceName,
            cost,
            amountPaid,
            doctorId,
            newCaseName
        } = req.body;

        try {
            const db = getDb();
            const result = db.transaction(() => {
                // 1. Get Appointment
                const appointment = db.prepare("SELECT * FROM appointments WHERE id = ?").get(appointmentId) as any;
                if (!appointment) throw new Error('Appointment not found');

                // 2. Check Invoice
                const existingInvoice = db.prepare('SELECT * FROM invoices WHERE appointment_id = ?').get(appointmentId);
                if (existingInvoice) throw new Error('Invoice already exists');

                // 3. Handle Treatment Case
                let resolvedTCaseId = treatmentCaseId;

                if (treatmentCaseId === 'new') {
                    resolvedTCaseId = crypto.randomUUID();
                    const patient = db.prepare('SELECT full_name FROM patients WHERE id = ?').get(appointment.patient_id) as any;
                    const pName = patient ? patient.full_name : 'Unknown';
                    const bal = cost - amountPaid;

                    const maxCaseId = (db.prepare('SELECT MAX(display_id) as max FROM treatment_cases').get() as any)?.max || 0;
                    const caseDisplayId = maxCaseId + 1;

                    db.prepare(`
                        INSERT INTO treatment_cases (id, display_id, clinic_id, patient_id, patient_name, name, total_cost, total_paid, balance, status, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `).run(resolvedTCaseId, caseDisplayId, user.clinic_id, appointment.patient_id, pName, newCaseName || serviceName, cost, amountPaid, bal, 'active');
                }

                const tCaseId = resolvedTCaseId;

                // 4. Create Invoice
                const invId = crypto.randomUUID();
                const isExisting = treatmentCaseId !== 'new';
                // If existing case, the cost is already accounted for in total_cost? 
                // Wait, logic from handlers.ts:
                // const invCost = isExisting ? amountPaid : cost; // This seems weird logic in handler but copying strict logic
                // Actually if I join an existing case, usually I am paying off balance? 
                // Or adding new service to case?
                // The handler logic says: if existing, invCost = amountPaid. 
                // This implies we are just recording a payment against the case, NOT adding new cost?
                // BUT appointments:markAttended usually implies a Service was performed.
                // If I am just paying, I use the payment modal.
                // If I mark appointment attended, I performed a service.
                // Re-reading handler logic:
                // const invCost = isExisting ? amountPaid : cost;
                // If I add to existing case, cost is effectively 0 for this invoice? That sounds wrong if I performed a service.
                // However, I will stick 100% to the handler logic to avoid regression.
                const invCost = isExisting ? amountPaid : cost;
                const invBal = isExisting ? 0 : (cost - amountPaid);
                const invStatus = invBal > 0 ? 'pending' : 'paid';

                const maxInvId = (db.prepare('SELECT MAX(display_id) as max FROM invoices').get() as any)?.max || 0;
                const invDisplayId = maxInvId + 1;

                db.prepare(`
                    INSERT INTO invoices (id, display_id, clinic_id, appointment_id, patient_id, doctor_id, service_id, treatment_case_id, amount, paid_amount, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).run(invId, invDisplayId, user.clinic_id, appointmentId, appointment.patient_id, doctorId, appointment.service_id, tCaseId, invCost, amountPaid, invStatus);

                // 5. Update Treatment Case
                const sumResult = db.prepare('SELECT SUM(paid_amount) as total FROM invoices WHERE treatment_case_id = ?').get(tCaseId) as any;
                const grandTotalPaid = sumResult?.total || 0;

                const currentCase = db.prepare('SELECT total_cost FROM treatment_cases WHERE id = ?').get(tCaseId) as any;
                const caseTotalCost = currentCase?.total_cost || 0;
                const caseBalance = caseTotalCost - grandTotalPaid;
                const caseStatus = caseBalance <= 0 ? 'closed' : 'active';

                db.prepare(`UPDATE treatment_cases SET total_paid = ?, balance = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
                    .run(grandTotalPaid, caseBalance, caseStatus, tCaseId);

                // 6. Update Appointment
                db.prepare(`UPDATE appointments SET status = 'attended', treatment_case_id = ?, invoice_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
                    .run(tCaseId, invId, appointmentId);

                return { success: true, invoiceId: invId, treatmentCaseId: tCaseId };
            })();

            res.json(result);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // --- Settings (Public) ---
    app.get('/api/settings/clinic-info', (req, res) => {
        try {
            const db = getDb();
            const settings = db.prepare('SELECT * FROM clinic_settings LIMIT 1').get();
            res.json(settings || null);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // --- License Status (New) ---
    app.get('/api/license/status', (req, res) => {
        try {
            const status = licenseService.getInternalState();
            res.json(status);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/license/activate', async (req, res) => {
        try {
            const result = await licenseService.activateLicense(req.body.key);
            res.json(result);
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    app.delete('/api/license', async (req, res) => {
        try {
            await licenseService.deleteLicense();
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    // --- Invoices (Strict Financials) ---
    const financialRouter = express.Router();

    // Middleware for Financial Role Check
    financialRouter.use((req, res, next) => {
        // We will check individual permissions in routes, 
        // but can keep a basic check if needed.
        // For now, removing the blanket doctor block and relying on specific permissions.
        next();
    });

    // LIST Invoices (Admin & Staff)
    financialRouter.get('/', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' &&
            !user.permissions?.includes('VIEW_FINANCIAL_REPORTS') &&
            !user.permissions?.includes('VIEW_PAYMENTS') // Add this
        ) {
            return res.status(403).json({ error: 'Access Denied: You do not have permission to VIEW_FINANCIAL_REPORTS or VIEW_PAYMENTS' });
        }
        const db = getDb();
        try {
            const invoices = db.prepare(`
                SELECT i.*, p.full_name as patient_name 
                FROM invoices i
                LEFT JOIN patients p ON i.patient_id = p.id
                ORDER BY i.created_at DESC LIMIT 50
            `).all();
            res.json(invoices);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // CREATE Invoice (Admin & Staff)
    financialRouter.post('/', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' && !user.permissions?.includes('CREATE_INVOICE')) {
            return res.status(403).json({ error: 'Access Denied: You do not have permission to CREATE_INVOICE' });
        }
        const { patient_id, doctor_id, amount, paid_amount, treatment_case_id, payment_method, notes } = req.body;

        if (!patient_id || amount === undefined) {
            res.status(400).json({ error: 'Missing required invoice fields' });
            return;
        }

        try {
            const db = getDb();
            const id = crypto.randomUUID();
            // Get proper doctor_id if not provided (maybe self if doctor? but doctors can't access this. So must be provided)

            // Generate display_id
            const max = (db.prepare('SELECT MAX(display_id) as max FROM invoices').get() as any)?.max || 0;
            const display_id = max + 1;

            db.prepare(`
                INSERT INTO invoices (id, display_id, clinic_id, patient_id, doctor_id, treatment_case_id, amount, paid_amount, payment_method, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(id, display_id, user.clinic_id, patient_id, doctor_id || null, treatment_case_id || null, amount, paid_amount || 0, payment_method || 'cash', notes || '');

            res.json({ success: true, id });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // UPDATE Invoice (Admin ONLY)
    financialRouter.put('/:id', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') {
            res.status(403).json({ error: 'Access Denied: Only Admins can edit invoices.' });
            return;
        }

        const { id } = req.params;
        const { amount, paid_amount, notes } = req.body;

        try {
            const db = getDb();
            const stmt = db.prepare(`
                UPDATE invoices 
                SET amount = COALESCE(?, amount), 
                    paid_amount = COALESCE(?, paid_amount), 
                    notes = COALESCE(?, notes),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND clinic_id = ?
            `);
            const result = stmt.run(amount, paid_amount, notes, id, user.clinic_id);

            if (result.changes === 0) res.status(404).json({ error: 'Invoice not found' });
            else res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // DELETE Invoice (Admin ONLY)
    financialRouter.delete('/:id', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') {
            res.status(403).json({ error: 'Access Denied: Only Admins can delete invoices.' });
            return;
        }

        const { id } = req.params;
        try {
            const db = getDb();
            const result = db.prepare('DELETE FROM invoices WHERE id = ? AND clinic_id = ?').run(id, user.clinic_id);
            if (result.changes === 0) res.status(404).json({ error: 'Invoice not found' });
            else res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.use('/api/invoices', financialRouter);

    // --- Financials Stats (Admin Only, Legacy Endpoint) ---
    app.get('/api/financials', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') {
            res.status(403).json({ error: 'Access Denied: Admins Only' });
            return;
        }

        const db = getDb();
        try {
            const revenue = db.prepare(`
                SELECT SUM(paid_amount) as total 
                FROM invoices 
                WHERE clinic_id = ?
            `).get(user.clinic_id);
            res.json(revenue);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // --- Labs (New for Client Mode) ---
    app.get('/api/labs', (req, res) => {
        try {
            const db = getDb();
            const labs = db.prepare('SELECT * FROM labs').all();
            res.json(labs);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/labs', (req, res) => {
        const user = (req as any).user;
        const { name, is_default } = req.body;
        try {
            const db = getDb();
            const id = crypto.randomUUID();
            db.prepare('INSERT INTO labs (id, name, is_default, clinic_id) VALUES (?, ?, ?, ?)').run(id, name, is_default ? 1 : 0, user.clinic_id);
            res.json({ success: true, id });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/labs/:id', (req, res) => {
        const { id } = req.params;
        try {
            const db = getDb();
            // Check dependency
            const orders = db.prepare('SELECT count(*) as count FROM lab_orders WHERE lab_id = ?').get(id) as { count: number };
            if (orders.count > 0) return res.status(400).json({ error: "Cannot delete lab with existing orders." });

            db.prepare('DELETE FROM labs WHERE id = ?').run(id);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/labs/services', (req, res) => {
        const user = (req as any).user;
        const { lab_id, name, default_cost, is_active } = req.body;
        try {
            const db = getDb();
            const id = crypto.randomUUID();
            db.prepare(`
                INSERT INTO lab_services (id, lab_id, name, default_cost, is_active, clinic_id) 
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(id, lab_id, name, default_cost, is_active !== undefined ? is_active : 1, user.clinic_id);
            res.json({ success: true, id });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.put('/api/labs/services/:id', (req, res) => {
        const { id } = req.params;
        const data = req.body;
        try {
            const db = getDb();
            const keys = Object.keys(data).filter(k => k !== 'id');
            if (keys.length === 0) return res.json({ success: true });
            const setClause = keys.map(k => `${k} = ?`).join(', ');
            const values = keys.map(k => data[k]);
            values.push(id);
            db.prepare(`UPDATE lab_services SET ${setClause} WHERE id = ?`).run(...values);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/labs/orders', (req, res) => {
        try {
            const db = getDb();
            // Fetch orders with lab name, service name, and calculated financial status
            const orders = db.prepare(`
                SELECT 
                    lo.id as order_id, 
                    lo.*, 
                    l.name as lab_name, 
                    p.full_name as patient_name, 
                    d.name as doctor_name,
                    ls.name as service_name,
                    (SELECT COALESCE(SUM(paid_amount), 0) FROM lab_payments lp WHERE lp.lab_order_id = lo.id) as total_paid,
                    (lo.total_lab_cost - (SELECT COALESCE(SUM(paid_amount), 0) FROM lab_payments lp WHERE lp.lab_order_id = lo.id)) as remaining_balance
                FROM lab_orders lo
                LEFT JOIN labs l ON lo.lab_id = l.id
                LEFT JOIN patients p ON lo.patient_id = p.id
                LEFT JOIN doctors d ON lo.doctor_id = d.id
                LEFT JOIN lab_services ls ON lo.lab_service_id = ls.id
                WHERE (lo.order_status IS NULL OR lo.order_status != 'deleted')
                ORDER BY lo.created_at DESC
                LIMIT 100
            `).all();
            res.json(orders);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/labs/:id/services', (req, res) => {
        try {
            const db = getDb();
            const { id } = req.params;
            console.log(`[API] Fetching services for lab ID: ${id}`);
            const services = db.prepare('SELECT * FROM lab_services WHERE lab_id = ? AND is_active = 1').all(id);
            res.json(services);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/labs/orders', (req, res) => {
        const user = (req as any).user;
        const data = req.body;
        try {
            const db = getDb();
            const id = crypto.randomUUID();
            // Match local handler: Do NOT insert total_paid/remaining_balance (they are computed or default)
            // Schema in image shows they don't exist as columns locally? or maybe they do?
            // Checking handlers.ts (lab.ipc.ts) -> it does NOT insert them.
            const stmt = db.prepare(`
                 INSERT INTO lab_orders (
                     id, clinic_id, lab_id, patient_id, doctor_id, 
                     lab_service_id, total_lab_cost, 
                     order_status, sent_date, expected_receive_date, notes
                 )
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?)
             `);

            stmt.run(
                id, user.clinic_id, data.lab_id, data.patient_id, data.doctor_id,
                data.lab_service_id, data.total_lab_cost,
                data.sent_date, data.expected_receive_date, data.notes
            );
            res.json({ success: true, id });
        } catch (e: any) {
            console.error('[API Error] POST /api/labs/orders:', e);
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/labs/general-payments', (req, res) => {
        const user = (req as any).user;
        const { labId, amount, notes, paymentDate } = req.body;

        try {
            const db = getDb();
            const id = crypto.randomUUID();
            const expenseId = crypto.randomUUID();

            // Get lab name
            const lab = db.prepare('SELECT name FROM labs WHERE id = ?').get(labId) as { name: string };
            const labName = lab?.name || 'Unknown Lab';
            const description = `Lab Payment - ${labName} ${notes ? `(${notes})` : ''}`;

            db.transaction(() => {
                // 1. Create Expense
                db.prepare(`
                    INSERT INTO expenses (id, amount, date, category, description)
                    VALUES (?, ?, ?, 'Lab', ?)
                `).run(expenseId, amount, paymentDate, description);

                // 2. Create Lab General Payment (Log)
                db.prepare(`
                    INSERT INTO lab_general_payments (id, lab_id, amount, expense_id, notes, payment_date, clinic_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(id, labId, amount, expenseId, notes, paymentDate, user.clinic_id);

                // 3. AUTO-DISTRIBUTE to Oldest Unpaid Orders
                let remainingToDistribute = amount;

                // Fetch unpaid orders
                // We must calculate 'paid' manually to find remaining balance, similar to local logic
                const unpaidOrders = db.prepare(`
                    SELECT lo.id, lo.total_lab_cost, COALESCE(SUM(lp.paid_amount), 0) as paid
                    FROM lab_orders lo
                    LEFT JOIN lab_payments lp ON lo.id = lp.lab_order_id
                    WHERE lo.lab_id = ?
                    GROUP BY lo.id
                    HAVING (lo.total_lab_cost - paid) > 0.1
                    ORDER BY lo.created_at ASC
                `).all(labId) as { id: string, total_lab_cost: number, paid: number }[];

                for (const order of unpaidOrders) {
                    if (remainingToDistribute <= 0) break;

                    const balance = order.total_lab_cost - order.paid;
                    const paymentForThisOrder = Math.min(balance, remainingToDistribute);

                    if (paymentForThisOrder > 0) {
                        db.prepare(`
                             INSERT INTO lab_payments (id, lab_order_id, paid_amount, payment_date, expense_id, clinic_id)
                             VALUES (?, ?, ?, ?, ?, ?)
                         `).run(crypto.randomUUID(), order.id, paymentForThisOrder, paymentDate, expenseId, user.clinic_id);

                        remainingToDistribute -= paymentForThisOrder;
                    }
                }
            })();

            res.json({ success: true, id });
        } catch (e: any) {
            console.error('[API Error] POST /api/labs/general-payments:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // --- Stock (New for Client Mode) ---
    // --- Settings ---
    app.get('/api/settings/clinic-info', (req, res) => {
        try {
            const db = getDb();
            // Match handlers.ts logic (Prioritize ID if auth, else LIMIT 1)
            let settings;
            const user = (req as any).user;

            if (user && user.clinic_id) {
                settings = db.prepare('SELECT * FROM clinic_settings WHERE id = ?').get(user.clinic_id);
            }

            if (!settings) {
                settings = db.prepare('SELECT * FROM clinic_settings LIMIT 1').get();
            }

            res.json(settings || {});
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // --- Metadata Endpoints (Synced with handlers.ts logic) ---
    app.get('/api/doctors', (req, res) => {
        try {
            // Match handlers.ts: WHERE (is_deleted IS NULL OR is_deleted = 0) AND (active IS NULL OR active = 1) ORDER BY name ASC
            const db = getDb();
            const doctors = db.prepare("SELECT * FROM doctors WHERE (is_deleted IS NULL OR is_deleted = 0) AND (active IS NULL OR active = 1) ORDER BY name ASC").all();
            res.json(doctors);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/cities', (req, res) => {
        try {
            // Match handlers.ts: WHERE (is_deleted IS NULL OR is_deleted = 0) ORDER BY name ASC
            const db = getDb();
            const cities = db.prepare("SELECT * FROM cities WHERE (is_deleted IS NULL OR is_deleted = 0) ORDER BY name ASC").all();
            res.json(cities);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/services', (req, res) => {
        try {
            // Match handlers.ts: WHERE (is_deleted IS NULL OR is_deleted = 0) ORDER BY name ASC
            const db = getDb();
            const services = db.prepare("SELECT * FROM services WHERE (is_deleted IS NULL OR is_deleted = 0) ORDER BY name ASC").all();
            res.json(services);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/labs', (req, res) => {
        try {
            const db = getDb();
            const labs = db.prepare("SELECT * FROM labs WHERE (is_deleted IS NULL OR is_deleted = 0) ORDER BY name ASC").all();
            res.json(labs);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });






    // --- Expenses (Synced) ---
    app.get('/api/expenses', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' &&
            !user.permissions?.includes('VIEW_FINANCIAL_REPORTS') &&
            !user.permissions?.includes('VIEW_EXPENSES') &&
            !user.permissions?.includes('MANAGE_EXPENSES')
        ) {
            return res.status(403).json({
                error: 'Access Denied: You do not have permission to view expenses',
                debug: {
                    userId: user.id,
                    role: user.role,
                    permissions: user.permissions || []
                }
            });
        }
        try {
            const db = getDb();
            const expenses = db.prepare('SELECT * FROM expenses ORDER BY date DESC, created_at DESC').all();
            res.json(expenses);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/expenses', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' &&
            !user.permissions?.includes('VIEW_FINANCIAL_REPORTS') &&
            !user.permissions?.includes('MANAGE_EXPENSES')
        ) {
            return res.status(403).json({
                error: 'Access Denied: You do not have permission to manage expenses',
                debug: {
                    userId: user.id,
                    role: user.role,
                    permissions: user.permissions || []
                }
            });
        }
        const { id, amount, date, category, description } = req.body;
        try {
            const db = getDb();
            const expenseId = id || crypto.randomUUID();
            db.prepare(`
                INSERT INTO expenses (id, amount, date, category, description)
                VALUES (?, ?, ?, ?, ?)
            `).run(expenseId, amount, date, category, description);
            res.json({ success: true, id: expenseId });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.put('/api/expenses/:id', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' &&
            !user.permissions?.includes('VIEW_FINANCIAL_REPORTS') &&
            !user.permissions?.includes('MANAGE_EXPENSES')
        ) {
            return res.status(403).json({
                error: 'Access Denied: You do not have permission to manage expenses',
                debug: {
                    userId: user.id,
                    role: user.role,
                    permissions: user.permissions || []
                }
            });
        }
        const { id } = req.params;
        const { amount, date, category, description } = req.body;
        try {
            const db = getDb();
            db.prepare(`
                UPDATE expenses 
                SET amount = ?, date = ?, category = ?, description = ?
                WHERE id = ?
            `).run(amount, date, category, description, id);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/expenses/:id', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' &&
            !user.permissions?.includes('VIEW_FINANCIAL_REPORTS') &&
            !user.permissions?.includes('MANAGE_EXPENSES')
        ) {
            return res.status(403).json({
                error: 'Access Denied: You do not have permission to manage expenses',
                debug: {
                    userId: user.id,
                    role: user.role,
                    permissions: user.permissions || []
                }
            });
        }
        const { id } = req.params;
        try {
            const db = getDb();
            db.transaction(() => {
                db.prepare('DELETE FROM lab_payments WHERE expense_id = ?').run(id);
                db.prepare('DELETE FROM lab_general_payments WHERE expense_id = ?').run(id);
                db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
            })();
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });


    app.get('/api/stock/items', (req, res) => {
        try {
            const db = getDb();
            // Join with categories to get category_name for grouping in UI
            const items = db.prepare(`
                SELECT si.*, sc.name as category_name
                FROM stock_items si
                LEFT JOIN stock_categories sc ON si.category_id = sc.id
                ORDER BY si.name ASC
            `).all();
            res.json(items);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/stock/categories', (req, res) => {
        try {
            const db = getDb();
            const categories = db.prepare('SELECT * FROM stock_categories ORDER BY name ASC').all();
            res.json(categories);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/stock/categories', (req, res) => {
        const user = (req as any).user;
        const { name } = req.body;
        try {
            const db = getDb();
            const id = crypto.randomUUID();
            db.prepare("INSERT INTO stock_categories (id, clinic_id, name) VALUES (?, ?, ?)").run(id, user.clinic_id, name);
            res.json({ success: true, id });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/stock/categories/:id', (req, res) => {
        const { id } = req.params;
        try {
            const db = getDb();
            // Optional: Unlink items first (match local logic)
            db.prepare("UPDATE stock_items SET category_id = NULL WHERE category_id = ?").run(id);
            db.prepare("DELETE FROM stock_categories WHERE id = ?").run(id);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/stock/items', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin' && !user.permissions?.includes('ADD_ITEM')) {
            return res.status(403).json({ error: 'Access Denied: You do not have permission to ADD_ITEM' });
        }
        // Accept payload matching local handler: { name, quantity, min_quantity, category_id }
        // Note: handlers.ts also does `stock:create-item`.
        const { name, quantity, min_quantity, category_id } = req.body;

        try {
            const db = getDb();
            const id = crypto.randomUUID();
            const now = new Date().toISOString();

            let newId: number | bigint = 0;

            db.transaction(() => {
                // 1. Insert Item
                const stmt = db.prepare(`
                    INSERT INTO stock_items (clinic_id, name, quantity, min_quantity, category_id)
                    VALUES (?, ?, ?, ?, ?)
                `);

                const info = stmt.run(user.clinic_id, name, quantity || 0, min_quantity || 0, category_id || null);
                newId = info.lastInsertRowid;
                console.log(`[API] Created stock item. Name: ${name}, NewID: ${newId} (Type: ${typeof newId})`);

                // 2. Record Initial Movement if needed
                if (quantity > 0) {
                    console.log(`[API] Inserting initial movement. ItemID: ${newId}, Qty: ${quantity}`);
                    db.prepare(`
                        INSERT INTO stock_movements (clinic_id, item_id, change, reason)
                        VALUES (?, ?, ?, 'Initial Stock')
                    `).run(user.clinic_id, newId, quantity); // Pass raw newId (BigInt is supported)
                }
            })();

            // Return ID as string to be safe (JSON handles numbers fine, but explicit string matches UUID expectation if any)
            res.json({ success: true, id: newId.toString() });
            return; // Exit function, don't fallback to old res.json


            res.json({ success: true });
        } catch (e: any) {
            console.error('[API Error] POST /api/stock/items:', e);
            res.status(500).json({ error: e.message });
        }
    });

    app.delete('/api/stock/items/:id', (req, res) => {
        const user = (req as any).user;
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Access Denied: Admins Only' });
        }
        const { id } = req.params;
        try {
            const db = getDb();
            // Delete movements first
            db.prepare("DELETE FROM stock_movements WHERE item_id = ?").run(id);
            db.prepare("DELETE FROM stock_items WHERE id = ?").run(id);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/stock/movement', (req, res) => {
        const user = (req as any).user;
        const { id, amount, reason } = req.body; // amount can be positive (add) or negative (subtract)

        if (user.role !== 'admin') {
            const requiredPerm = amount > 0 ? 'ADD_ITEM' : 'SUBTRACT_ITEM';
            if (!user.permissions?.includes(requiredPerm)) {
                return res.status(403).json({ error: `Access Denied: You do not have permission to ${requiredPerm}` });
            }
        }

        try {
            const db = getDb();
            db.transaction(() => {
                // 1. Update Quantity
                db.prepare('UPDATE stock_items SET quantity = quantity + ? WHERE id = ?').run(amount, id);

                // 2. Record Movement
                db.prepare(`
                    INSERT INTO stock_movements (clinic_id, item_id, change, reason)
                    VALUES (?, ?, ?, ?)
                `).run(user.clinic_id, id, amount, reason);

                // 3. Check for Low Stock (Simplified for API - can expand if needed)
                // Note: Notifications are complex to sync, keeping simple for now.
            })();

            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });


    // --- Attachments ---
    app.get('/api/attachments', (req, res) => {
        const { patient_id } = req.query;
        if (!patient_id) return res.json([]);
        const db = getDb();
        try {
            const data = db.prepare('SELECT * FROM attachments WHERE patient_id = ? ORDER BY created_at DESC').all(patient_id);
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/attachments', (req, res) => {
        const user = (req as any).user;
        const data = req.body;
        const db = getDb();
        try {
            // Generate UUID if not present
            if (!data.id) {
                data.id = crypto.randomUUID();
            }

            // Allow 'id' to be inserted
            const keys = Object.keys(data).filter(k => k !== 'created_at');
            const cols = keys.join(', ');
            const placeholders = keys.map(() => '?').join(', ');
            const values = keys.map(k => data[k]);

            db.prepare(`INSERT INTO attachments (${cols}) VALUES (${placeholders})`).run(...values);
            res.json({ success: true, id: data.id });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/attachments/:id', (req, res) => {
        const { id } = req.params;
        const db = getDb();
        try {
            db.prepare('DELETE FROM attachments WHERE id = ?').run(id);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // DATA REPAIR: Fix null IDs in attachments if any
    try {
        const db = getDb();
        // Check if table exists first
        const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='attachments'").get();
        if (tableExists) {
            const nullIds = db.prepare('SELECT rowid FROM attachments WHERE id IS NULL').all() as any[];
            if (nullIds.length > 0) {
                console.log(`[Fix] Found ${nullIds.length} attachments with NULL ID. Fixing...`);
                // Cleanup using transaction
                const updateStmt = db.prepare('UPDATE attachments SET id = ? WHERE rowid = ?');
                const transaction = db.transaction((rows) => {
                    for (const row of rows) updateStmt.run(crypto.randomUUID(), row.rowid);
                });
                transaction(nullIds);
            }
        }
    } catch (e) { console.warn('Data repair warning:', e); }

    // --- SERVE STATIC FRONTEND (For Mobile/Web Access) ---
    // Serve the 'dist' folder which contains the built React app
    // ==========================================
    // MOBILE API EXTENSIONS (REST)
    // ==========================================

    app.get('/api/patients', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const sql = `SELECT * FROM patients WHERE clinic_id = ? AND deleted = 0 ORDER BY created_at DESC`;
            const data = getDb().prepare(sql).all(clinicId);
            res.json(data);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // POST - Create Patient
    app.post('/api/patients', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const data = { ...req.body, clinic_id: clinicId };

            if (!data.full_name) throw new Error("Name is required");

            const keys = Object.keys(data);
            const placeholders = keys.map(() => '?').join(',');
            const values = Object.values(data);

            const sql = `INSERT INTO patients (${keys.join(',')}) VALUES (${placeholders})`;
            const result = getDb().prepare(sql).run(...values);

            res.json({ success: true, id: result.lastInsertRowid });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // POST - Create Appointment
    app.post('/api/appointments', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const data = { ...req.body, clinic_id: clinicId };

            if (!data.patient_id) throw new Error("Patient ID required");

            const keys = Object.keys(data);
            const placeholders = keys.map(() => '?').join(',');
            const values = Object.values(data);

            const sql = `INSERT INTO appointments (${keys.join(',')}) VALUES (${placeholders})`;
            const result = getDb().prepare(sql).run(...values);

            res.json({ success: true, id: result.lastInsertRowid });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/appointments', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const sql = `
                SELECT A.*, TC.name as service_name
                FROM appointments A
                LEFT JOIN treatment_cases TC ON A.treatment_case_id = TC.id
                WHERE (A.clinic_id = ? OR A.clinic_id = 'clinic_001')
                ORDER BY A.date DESC, A.time ASC
            `;
            const data = getDb().prepare(sql).all(clinicId);
            res.json(data);
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    });

    // Invoices
    app.get('/api/invoices', (req, res) => {
        const user = (req as any).user;
        const requiredPerm = 'VIEW_FINANCIAL_REPORTS';
        // Note: Ideally invoices might rely on CREATE_INVOICE or VIEW_FINANCIAL_REPORTS. 
        // Let's assume VIEW_FINANCIAL_REPORTS for the Listing.
        if (user.role !== 'admin' && !user.permissions?.includes(requiredPerm)) {
            return res.status(403).json({
                error: `Access Denied: You do not have permission to ${requiredPerm}`,
                debug: {
                    userId: user.id,
                    role: user.role,
                    permissions: user.permissions || []
                }
            });
        }
        try {
            const clinicId = getCurrentClinicId();
            const sql = `
                SELECT i.*, 
                       tc.name as plan_name, 
                       s.name as service_item_name
                FROM invoices i
                LEFT JOIN treatment_cases tc ON i.treatment_case_id = tc.id
                LEFT JOIN services s ON i.service_id = s.id
                WHERE (i.clinic_id = ? OR i.clinic_id = 'clinic_001')
                ORDER BY i.created_at DESC
            `;
            const rows = getDb().prepare(sql).all(clinicId);
            const data = rows.map((row: any) => ({
                ...row,
                service_name: row.plan_name || row.service_item_name
            }));
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // Expenses
    // Expenses


    app.post('/api/stock/items', (req, res) => {
        try {
            const { name, quantity, min_quantity, category_id } = req.body;
            const clinicId = getCurrentClinicId();

            const insertItem = getDb().prepare(`
                INSERT INTO stock_items (name, quantity, min_quantity, category_id, clinic_id)
                VALUES (?, ?, ?, ?, ?)
            `);

            const insertMove = getDb().prepare(`
                INSERT INTO stock_movements (item_id, change, reason, clinic_id)
                VALUES (?, ?, ?, ?)
            `);

            let newItemId: number | bigint = 0;

            getDb().transaction(() => {
                const info = insertItem.run(name, quantity, min_quantity, category_id, clinicId);
                newItemId = info.lastInsertRowid;
                if (quantity > 0) {
                    insertMove.run(newItemId, quantity, 'Initial Stock', clinicId);
                }
            })();

            res.json({ success: true, id: Number(newItemId) });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/stock/movements', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const startDate = req.query.startDate as string;
            const endDate = req.query.endDate as string;
            // Correct column name is 'change'
            const sql = `
                SELECT sm.id, si.name as item_name, sm.change as change, sm.reason, sm.created_at
                FROM stock_movements sm
                JOIN stock_items si ON sm.item_id = si.id
                WHERE sm.clinic_id = ?
                ${startDate ? 'AND date(sm.created_at) >= ?' : ''}
                ${endDate ? 'AND date(sm.created_at) <= ?' : ''}
                ORDER BY sm.created_at DESC
            `;

            const params: any[] = [clinicId];
            if (startDate) params.push(startDate);
            if (endDate) params.push(endDate);

            const data = getDb().prepare(sql).all(...params);
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/stock/categories', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const data = getDb().prepare('SELECT * FROM stock_categories WHERE clinic_id = ? ORDER BY name ASC').all(clinicId);
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/reports/daily', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const date = req.query.date as string;

            const revenue = getDb().prepare(`
                SELECT SUM(paid_amount) as total 
                FROM invoices 
                WHERE date(created_at) = ? AND clinic_id = ?
            `).get(date, clinicId) as any;

            const patients = getDb().prepare(`
                SELECT COUNT(DISTINCT patient_id) as count 
                FROM appointments 
                WHERE date = ? AND clinic_id = ?
            `).get(date, clinicId) as any;

            const completed = getDb().prepare(`
                SELECT COUNT(*) as count 
                FROM appointments 
                WHERE date = ? AND (status='attended' OR status='completed') AND clinic_id = ?
            `).get(date, clinicId) as any;

            res.json({
                totalRevenue: revenue?.total || 0,
                patientCount: patients?.count || 0,
                completedAppointments: completed?.count || 0
            });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/stock/categories', (req, res) => {
        try {
            const { name } = req.body;
            const id = crypto.randomUUID();
            const clinicId = getCurrentClinicId();
            getDb().prepare('INSERT INTO stock_categories (id, name, clinic_id) VALUES (?, ?, ?)').run(id, name, clinicId);
            res.json({ success: true, id });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // Treatment Cases by Patient
    app.get('/api/treatment-cases', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const data = getDb().prepare("SELECT * FROM treatment_cases WHERE clinic_id = ? OR clinic_id = 'clinic_001' ORDER BY created_at DESC").all(clinicId);
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/treatment-cases/by-patient/:patientId', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const { patientId } = req.params;
            const data = getDb().prepare(`
                SELECT * FROM treatment_cases 
                WHERE patient_id = ? AND (clinic_id = ? OR clinic_id = 'clinic_001') 
                AND status = 'active'
                ORDER BY created_at DESC
            `).all(patientId, clinicId);
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // Mark Appointment Attended (Complex Transaction)
    app.post('/api/appointments/mark-attended', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const {
                appointmentId,
                treatmentCaseId,
                serviceName,
                cost,
                amountPaid,
                doctorId,
                newCaseName,
            } = req.body;

            getDb().transaction(() => {
                // 1. Get Appointment
                const appointment = getDb().prepare("SELECT * FROM appointments WHERE id = ? AND (clinic_id = ? OR clinic_id = 'clinic_001')").get(appointmentId, clinicId) as any;
                if (!appointment) throw new Error('Appointment not found');

                // 2. Check Invoice
                const existingInvoice = getDb().prepare('SELECT * FROM invoices WHERE appointment_id = ?').get(appointmentId);
                if (existingInvoice) throw new Error('Invoice already exists');

                // 3. Handle Treatment Case
                let resolvedTCaseId = treatmentCaseId;
                if (treatmentCaseId === 'new') {
                    resolvedTCaseId = crypto.randomUUID();
                    const patient = getDb().prepare('SELECT full_name FROM patients WHERE id = ?').get(appointment.patient_id) as any;
                    const pName = patient ? patient.full_name : 'Unknown';
                    const bal = cost - amountPaid;
                    const maxCaseId = (getDb().prepare('SELECT MAX(display_id) as max FROM treatment_cases').get() as any)?.max || 0;

                    getDb().prepare(`
                        INSERT INTO treatment_cases (id, display_id, clinic_id, patient_id, patient_name, name, total_cost, total_paid, balance, status, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `).run(resolvedTCaseId, maxCaseId + 1, clinicId, appointment.patient_id, pName, newCaseName || serviceName, cost, amountPaid, bal, 'active');
                }

                const tCaseId = resolvedTCaseId;

                // 4. Create Invoice
                const invId = crypto.randomUUID();
                const isExisting = treatmentCaseId !== 'new';
                const invCost = isExisting ? amountPaid : cost;
                const invBal = isExisting ? 0 : (cost - amountPaid);
                const invStatus = invBal > 0 ? 'pending' : 'paid';
                const maxInvId = (getDb().prepare('SELECT MAX(display_id) as max FROM invoices').get() as any)?.max || 0;

                getDb().prepare(`
                    INSERT INTO invoices (id, display_id, clinic_id, appointment_id, patient_id, doctor_id, service_id, treatment_case_id, amount, paid_amount, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).run(invId, maxInvId + 1, clinicId, appointmentId, appointment.patient_id, doctorId, appointment.service_id, tCaseId, invCost, amountPaid, invStatus);

                // 5. Update Treatment Case Totals
                const sumResult = getDb().prepare('SELECT SUM(paid_amount) as total FROM invoices WHERE treatment_case_id = ?').get(tCaseId) as any;
                const grandTotalPaid = sumResult?.total || 0;
                const currentCase = getDb().prepare('SELECT total_cost FROM treatment_cases WHERE id = ?').get(tCaseId) as any;
                const caseTotalCost = currentCase?.total_cost || 0;
                const caseBalance = caseTotalCost - grandTotalPaid;
                const caseStatus = caseBalance <= 0 ? 'closed' : 'active';

                getDb().prepare(`
                    UPDATE treatment_cases 
                    SET total_paid = ?, balance = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(grandTotalPaid, caseBalance, caseStatus, tCaseId);

                // 6. Update Appointment
                getDb().prepare(`
                    UPDATE appointments 
                    SET status = 'attended', treatment_case_id = ?, invoice_id = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(tCaseId, invId, appointmentId);
            })();

            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });



    // Stock Items
    app.get('/api/stock/items', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const sql = `
                SELECT si.*, sc.name as category_name
                FROM stock_items si
                LEFT JOIN stock_categories sc ON si.category_id = sc.id
                WHERE si.clinic_id = ?
                ORDER BY si.name ASC
             `;
            const data = getDb().prepare(sql).all(clinicId);
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/patients', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            console.log(`[API] /api/patients - ClinicId: ${clinicId}`);
            const data = getDb().prepare(`
                SELECT * FROM patients 
                WHERE (clinic_id = ? OR clinic_id = 'clinic_001' OR clinic_id IS NULL)
                AND is_deleted = 0
                ORDER BY full_name ASC
            `).all(clinicId);
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/doctors', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const data = getDb().prepare(`
                SELECT * FROM doctors 
                WHERE (clinic_id = ? OR clinic_id = 'clinic_001' OR clinic_id IS NULL)
                AND is_deleted = 0
            `).all(clinicId);
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/labs/orders', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const sql = `
                SELECT 
                    LO.id as order_id,
                    LO.patient_id,
                    P.full_name as patient_name,
                    LO.doctor_id,
                    D.name as doctor_name,
                    LO.lab_service_id,
                    LS.name as service_name,
                    L.id as lab_id,
                    L.name as lab_name,
                    LO.clinic_id,
                    LO.sent_date,
                    LO.expected_receive_date,
                    LO.received_date,
                    LO.status as order_status,
                    LO.cost as total_lab_cost,
                    (SELECT COALESCE(SUM(amount), 0) FROM lab_payments WHERE expenses_id IN (SELECT id FROM expenses WHERE related_lab_order_id = LO.id)) as total_paid,
                    LO.created_at
                FROM lab_orders LO
                LEFT JOIN patients P ON LO.patient_id = P.id
                LEFT JOIN doctors D ON LO.doctor_id = D.id
                LEFT JOIN lab_services LS ON LO.lab_service_id = LS.id
                LEFT JOIN labs L ON LO.lab_id = L.id
                WHERE (LO.clinic_id = ? OR LO.clinic_id = 'clinic_001' OR LO.clinic_id IS NULL)
                ORDER BY LO.created_at DESC
             `;
            const data = getDb().prepare(sql).all(clinicId);
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/labs/orders', (req, res) => {
        try {
            const { patient_id, doctor_id, lab_service_id, sent_date, expected_receive_date, total_lab_cost, notes, lab_id } = req.body;
            const clinicId = getCurrentClinicId();
            const id = crypto.randomUUID();

            getDb().prepare(`
                INSERT INTO lab_orders (
                    id, patient_id, doctor_id, lab_service_id, clinic_id, 
                    sent_date, expected_receive_date, total_lab_cost, notes, 
                    order_status, created_at, lab_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', CURRENT_TIMESTAMP, ?)
            `).run(id, patient_id, doctor_id, lab_service_id, clinicId, sent_date, expected_receive_date, total_lab_cost || 0, notes || '', lab_id);

            res.json({ success: true, id });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/labs/orders/:id/receive', (req, res) => {
        try {
            const { id } = req.params;
            const { receivedDate, paidAmount } = req.body;
            const clinicId = getCurrentClinicId();

            getDb().transaction(() => {
                // 1. Update Order Status
                getDb().prepare(`
                    UPDATE lab_orders 
                    SET order_status = 'received', received_date = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND (clinic_id = ? OR clinic_id IS NULL)
                `).run(receivedDate, id, clinicId);

                // 2. Handle Payment if amount > 0
                if (paidAmount > 0) {
                    const expenseId = crypto.randomUUID();
                    const paymentId = crypto.randomUUID();
                    const dateStr = new Date().toISOString().split('T')[0];

                    // Fetch details for description
                    const orderDetails = getDb().prepare(`
                        SELECT p.full_name as patient_name, ls.name as service_name
                        FROM lab_orders lo
                        LEFT JOIN patients p ON lo.patient_id = p.id
                        LEFT JOIN lab_services ls ON lo.lab_service_id = ls.id
                        WHERE lo.id = ?
                    `).get(id) as any;

                    const description = `${orderDetails?.service_name || 'Service'} - ${orderDetails?.patient_name || 'Patient'}`;

                    // Create Expense (Include clinic_id if schema supports it, safe if column exists)
                    // Checking if column exists is hard dynamically. 
                    // But standard migration adds it.
                    // I'll stick to what lab.ipc.ts does but ADD clinic_id if I am sure.
                    // api.ts uses clinic_id in SELECT. So it MUST exist.
                    getDb().prepare(`
                        INSERT INTO expenses (id, amount, date, category, description)
                        VALUES (?, ?, ?, 'Lab', ?)
                    `).run(expenseId, paidAmount, dateStr, description);

                    // Create Lab Payment
                    getDb().prepare(`
                         INSERT INTO lab_payments (id, lab_order_id, paid_amount, payment_date, expense_id, clinic_id)
                         VALUES (?, ?, ?, ?, ?, ?)
                    `).run(paymentId, id, paidAmount, dateStr, expenseId, clinicId);
                }
            })();

            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/labs/orders/:id', (req, res) => {
        try {
            const { id } = req.params;
            const shouldDeleteExpenses = req.query.deleteExpenses === 'true';
            const clinicId = getCurrentClinicId();

            getDb().transaction(() => {
                if (shouldDeleteExpenses) {
                    const payments = getDb().prepare(`SELECT expense_id FROM lab_payments WHERE lab_order_id = ? AND expense_id IS NOT NULL`).all(id) as any[];
                    const expenseIds = payments.map(p => p.expense_id);
                    if (expenseIds.length > 0) {
                        const placeholders = expenseIds.map(() => '?').join(',');
                        getDb().prepare(`DELETE FROM expenses WHERE id IN (${placeholders})`).run(...expenseIds);
                    }
                }
                getDb().prepare(`DELETE FROM lab_orders WHERE id = ? AND (clinic_id = ? OR clinic_id IS NULL)`).run(id, clinicId);
            })();
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/labs/payments', (req, res) => {
        try {
            const { labId, amount, notes, paymentDate } = req.body;
            const clinicId = getCurrentClinicId();
            const id = crypto.randomUUID();
            const expenseId = crypto.randomUUID();

            const lab = getDb().prepare('SELECT name FROM labs WHERE id = ?').get(labId) as any;
            const labName = lab?.name || 'Unknown Lab';
            const description = `Lab Payment - ${labName} ${notes ? `(${notes})` : ''}`;

            getDb().transaction(() => {
                // 1. Expense
                getDb().prepare(`INSERT INTO expenses (id, amount, date, category, description) VALUES (?, ?, ?, 'Lab', ?)`).run(expenseId, amount, paymentDate, description);

                // 2. Lab General Payment
                getDb().prepare(`INSERT INTO lab_general_payments (id, lab_id, amount, expense_id, notes, payment_date, clinic_id) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, labId, amount, expenseId, notes, paymentDate, clinicId);

                // 3. Auto Distribute
                let remaining = amount;
                const unpaidOrders = getDb().prepare(`
                    SELECT lo.id, lo.total_lab_cost, COALESCE(SUM(lp.paid_amount), 0) as paid
                    FROM lab_orders lo
                    LEFT JOIN lab_payments lp ON lo.id = lp.lab_order_id
                    WHERE lo.lab_id = ? AND (lo.clinic_id = ? OR lo.clinic_id = 'clinic_001' OR lo.clinic_id IS NULL)
                    GROUP BY lo.id
                    HAVING (lo.total_lab_cost - paid) > 0.1
                    ORDER BY lo.created_at ASC
                `).all(labId, clinicId) as any[];

                for (const order of unpaidOrders) {
                    if (remaining <= 0) break;
                    const balance = order.total_lab_cost - order.paid;
                    const payment = Math.min(balance, remaining);
                    if (payment > 0) {
                        getDb().prepare(`INSERT INTO lab_payments (id, lab_order_id, paid_amount, payment_date, expense_id, clinic_id) VALUES (?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), order.id, payment, paymentDate, expenseId, clinicId);
                        remaining -= payment;
                    }
                }
            })();
            res.json({ success: true, id });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });
    app.get('/api/labs/list', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            // Match Desktop Logic: Allow NULL or 'clinic_001'
            const data = getDb().prepare(`
                SELECT * FROM labs 
                WHERE (clinic_id = ? OR clinic_id = 'clinic_001' OR clinic_id IS NULL)
                ORDER BY is_default DESC, name ASC
            `).all(clinicId);

            // Diagnostics (Keep for verification)
            const total = getDb().prepare('SELECT count(*) as c FROM labs').get() as any;
            const sample = getDb().prepare('SELECT clinic_id FROM labs LIMIT 1').get() as any;
            console.log(`[API] /api/labs/list - Target: ${clinicId}, Found: ${data.length}, TotalInDB: ${total?.c}, SampleID: ${sample?.clinic_id}`);

            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/labs/services', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const { labId } = req.query;
            console.log(`[API] /api/labs/services - ClinicId: ${clinicId}, LabId: ${labId}`);

            let sql = `
                SELECT * FROM lab_services 
                WHERE (clinic_id = ? OR clinic_id = 'clinic_001' OR clinic_id IS NULL) 
                AND is_active = 1
            `;
            const args: any[] = [clinicId];

            if (labId) {
                sql += ` AND lab_id = ?`;
                args.push(labId);
            }

            sql += ` ORDER BY name ASC`;

            const data = getDb().prepare(sql).all(...args);
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // Services
    app.get('/api/services', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const data = getDb().prepare('SELECT * FROM services WHERE clinic_id = ?').all(clinicId);
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // Cities
    app.get('/api/cities', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const data = getDb().prepare('SELECT * FROM cities WHERE clinic_id = ?').all(clinicId);
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // Staff
    app.get('/api/staff', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();
            const data = getDb().prepare(`
                SELECT * FROM doctors 
                WHERE (clinic_id = ? OR clinic_id = 'clinic_001' OR clinic_id IS NULL) 
                AND is_deleted = 0
            `).all(clinicId);
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // Clinic Info
    app.get('/api/settings/clinic-info', (req, res) => {
        try {
            const clinicId = getCurrentClinicId();

            // Strategy 1: Exact ID match
            let info = getDb().prepare('SELECT * FROM clinic_settings WHERE id = ?').get(clinicId) as any;

            // Strategy 2: Most recently updated record with data (bypasses ID mismatch or empty default)
            if (!info || !info.owner_name) {
                console.log(`[API] ClinicInfo: ID ${clinicId} missing/empty, searching for valid record...`);
                // Try to find ANY record that has owner_name set
                let candidate = getDb().prepare('SELECT * FROM clinic_settings WHERE owner_name IS NOT NULL AND owner_name != "" ORDER BY updated_at DESC LIMIT 1').get() as any;

                // If still nothing, try just most recent (maybe they only set clinic name?)
                if (!candidate) {
                    candidate = getDb().prepare('SELECT * FROM clinic_settings ORDER BY updated_at DESC LIMIT 1').get() as any;
                }

                if (candidate) info = candidate;
            } else {
                console.log(`[API] ClinicInfo: Found by ID ${clinicId}. Owner: ${info.owner_name}`);
            }

            if (info) {
                res.json({ success: true, data: { ...info, id: clinicId } });
            } else {
                res.json({ success: false, data: null });
            }
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // In production (packaged), __dirname is .../resources/app/dist-electron/server
    // We want .../resources/app/dist
    const isDev = process.env.NODE_ENV === 'development';
    const frontendPath = isDev
        ? path.join(process.cwd(), 'dist')
        : path.join(__localDirname, '../../dist');
    app.use(express.static(frontendPath));

    // (Moved to end of file)


    // --- DEBUG: Permissions Dump (Public) ---


    // --- LAB ENDPOINTS ---

    // 1. Get Labs
    app.get('/api/labs/list', (req, res) => {
        try {
            const db = getDb();
            const labs = db.prepare("SELECT * FROM labs WHERE (is_deleted IS NULL OR is_deleted = 0)").all();
            res.json(labs);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // 2. Create Lab
    app.post('/api/labs', (req, res) => {
        try {
            const { name, is_default } = req.body;
            const db = getDb();
            const id = crypto.randomUUID();
            db.prepare("INSERT INTO labs (id, name, is_default, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))").run(id, name, is_default ? 1 : 0);
            res.json({ success: true, id });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // 3. Delete Lab
    app.delete('/api/labs/:id', (req, res) => {
        try {
            const db = getDb();
            db.prepare("UPDATE labs SET is_deleted = 1 WHERE id = ?").run(req.params.id);
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // 4. Get Lab Services
    app.get('/api/labs/services', (req, res) => {
        try {
            const db = getDb();
            let query = "SELECT * FROM lab_services WHERE (is_deleted IS NULL OR is_deleted = 0)";
            const params: any[] = [];

            if (req.query.labId) {
                query += " AND lab_id = ?";
                params.push(req.query.labId);
            }
            const services = db.prepare(query).all(...params);
            res.json(services);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // 5. Create Lab Service
    app.post('/api/labs/services', (req, res) => {
        try {
            const { name, default_cost, lab_id } = req.body;
            const db = getDb();
            const id = crypto.randomUUID();
            db.prepare("INSERT INTO lab_services (id, name, default_cost, lab_id, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))")
                .run(id, name, default_cost, lab_id);
            res.json({ success: true, id });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // 6. Update Lab Service (PUT /api/labs/services is not standard REST used by labService? No, labService uses updateLabService -> invokes 'lab:update-service')
    // labService client fallback isn't implemented. I will implement PUT /api/labs/services/:id
    app.put('/api/labs/services/:id', (req, res) => {
        try {
            const keys = Object.keys(req.body).filter(k => k !== 'id');
            if (keys.length > 0) {
                const sets = keys.map(k => `${k} = ?`).join(', ');
                const values = keys.map(k => req.body[k]);
                const db = getDb();
                db.prepare(`UPDATE lab_services SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...values, req.params.id);
            }
            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // 7. Lab Orders
    app.get('/api/labs/orders', (req, res) => {
        try {
            const db = getDb();
            const sql = `
                SELECT 
                    LO.*,
                    P.name as patient_name,
                    D.name as doctor_name,
                    LS.name as service_name,
                    L.name as lab_name
                FROM lab_orders LO
                LEFT JOIN patients P ON LO.patient_id = P.id
                LEFT JOIN doctors D ON LO.doctor_id = D.id
                LEFT JOIN lab_services LS ON LO.lab_service_id = LS.id
                LEFT JOIN labs L ON LO.lab_id = L.id
                ORDER BY LO.created_at DESC
            `;
            const orders = db.prepare(sql).all();
            res.json(orders);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/labs/orders', (req, res) => {
        try {
            const data = req.body;
            const db = getDb();
            const id = crypto.randomUUID();
            db.prepare(`
                INSERT INTO lab_orders (
                    id, patient_id, doctor_id, lab_service_id, lab_id, clinic_id,
                    sent_date, expected_receive_date,
                    total_lab_cost, total_paid, remaining_balance,
                    order_status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `).run(
                id, data.patient_id, data.doctor_id, data.lab_service_id, data.lab_id, 1,
                data.sent_date, data.expected_receive_date,
                data.total_lab_cost, data.total_paid || 0, (data.total_lab_cost - (data.total_paid || 0)),
                'in_progress'
            );
            res.json({ success: true, id });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/labs/orders/:id', (req, res) => {
        try {
            const { id } = req.params;
            const { deleteExpenses } = req.query; // Check if expenses deletion is requested
            const db = getDb();

            // Transaction?
            const deleteOrder = db.transaction(() => {
                // If we also delete expenses related to this order? (Implementation dependent on how expenses are linked)
                // For now, just delete order.
                db.prepare('DELETE FROM lab_orders WHERE id = ?').run(id);
            });
            deleteOrder();

            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/labs/orders/:id/receive', (req, res) => {
        try {
            const { receivedDate, paidAmount } = req.body;
            const db = getDb();
            const order = db.prepare('SELECT * FROM lab_orders WHERE id = ?').get(req.params.id) as any;
            if (!order) throw new Error('Order not found');

            const newTotalPaid = (order.total_paid || 0) + (paidAmount || 0);
            const newBalance = (order.total_lab_cost || 0) - newTotalPaid;

            db.prepare(`
                UPDATE lab_orders 
                SET order_status = 'received', received_date = ?, total_paid = ?, remaining_balance = ?, updated_at = datetime('now')
                WHERE id = ?
            `).run(receivedDate, newTotalPaid, newBalance, req.params.id);

            res.json({ success: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/labs/payments', (req, res) => {
        try {
            // General lab payments logic
            res.json({ success: true, message: "General payment implementation pending" });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // Handle React Routing (SPA) - Catch-all middleware
    // Moved here to avoid blocking API routes
    app.use((req, res) => {
        // Skip API routes (though they should be handled above)
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: `API Endpoint not found: ${req.path}` });
        }
        res.sendFile(path.join(frontendPath, 'index.html'));
    });

    const server = app.listen(port, '0.0.0.0', () => {
        console.log(`🚀 API Server running on port ${port}`);
        console.log(`Network Interfaces:`);
        const nets = networkInterfaces();
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]!) {
                if (net.family === 'IPv4' && !net.internal) {
                    console.log(`  - ${name}: ${net.address}`);
                }
            }
        }
    });

    return server;
};

// --- Simple Session Store ---
const sessions: Record<string, any> = {};

function createSession(user: any) {
    const token = crypto.randomUUID();
    sessions[token] = user;
    // Expire in 24 hours
    setTimeout(() => delete sessions[token], 24 * 60 * 60 * 1000);
    return token;
}

function getSession(token: string) {
    return sessions[token];
}
