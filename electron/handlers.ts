import { ipcMain, dialog, app, shell } from 'electron';
import path from 'path';
import { getDb, initializeDatabase, closeConnection, isSystemReadOnly } from './db/init.js';
import { getCurrentClinicId } from './db/getCurrentClinicId.js';
import { registerAuthHandlers } from './handlers/auth.js';
import { appMetaService } from './services/appMetaService.js';
// @ts-ignore
import { up as migrateClinics } from './db/migrations/001_clinics_migration.js';
import { validateSchema } from './db/validate_schema.js';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { supabase } from './services/supabaseClient.js';
import { backupService } from './services/backupService.js';
import { googleDriveService } from './services/googleDriveService.js';
import { registerLicenseHandlers } from './ipc/license.ipc.js';
import { registerLabHandlers } from './ipc/lab.ipc.js';
import { licenseService } from './license/license.service.js';
import { logger } from './utils/logger.js';
import { verifyPermission } from './utils/permissions.js';

export function registerHandlers() {
    initializeDatabase();
    registerAuthHandlers();
    registerLicenseHandlers();
    registerLabHandlers();

    // NOTE: We do NOT capture 'const db = getDb()' here anymore.
    // All handlers must call getDb() inside them to ensure they get the current active connection,
    // especially after a restore operation closes the old one.

    // --- System Status ---
    ipcMain.handle('system:get-status', () => {
        return { isReadOnly: isSystemReadOnly() };
    });

    ipcMain.handle('system:migrate-clinics', () => {
        try {
            logger.info('Starting clinics migration...');
            migrateClinics(getDb());
            return { success: true };
        } catch (error: any) {
            logger.error('Migration failed:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('system:validate-schema', () => {
        return validateSchema();
    });


    const checkReadOnly = () => {
        if (isSystemReadOnly()) {
            throw new Error('SYSTEM_READ_ONLY: The system is currently in read-only mode for maintenance.');
        }
        if (!licenseService.isWriteAllowed()) {
            throw new Error('LICENSE_EXPIRED: Your subscription has expired. The system is in read-only mode.');
        }
    };

    // --- Helper to get current clinic_id from user ---
    // --- Permission Helper moved to utils/permissions.ts ---

    const getContext = (): { clinicId: string } | null => {
        const userId = appMetaService.get('current_user_id');
        if (!userId) {
            // Fallback: Try to get default clinic if no user logged in (e.g. during simple setup or single tenant mode)
            try {
                // Check clinics (V2)
                const clinicV2 = getDb().prepare('SELECT id FROM clinics LIMIT 1').get() as { id: string };
                if (clinicV2) return { clinicId: clinicV2.id };
            } catch (e) { /* ignore */ }
            return null;
        }

        try {
            const user = getDb().prepare('SELECT clinic_id FROM users WHERE id = ?').get(userId) as { clinic_id: string };
            if (user && user.clinic_id) {
                return { clinicId: user.clinic_id };
            }
        } catch (e) { /* ignore */ }

        // Final Fallback
        try {
            const clinic = getDb().prepare('SELECT id FROM clinic_settings LIMIT 1').get() as { id: string };
            if (clinic) return { clinicId: clinic.id };

            // Check clinics (V2)
            const clinicV2 = getDb().prepare('SELECT id FROM clinics LIMIT 1').get() as { id: string };
            if (clinicV2) return { clinicId: clinicV2.id };
        } catch (e) { /* ignore */ }

        return null;
    };



    // --- Financial Export ---
    ipcMain.handle('financials:export', async () => {
        try {
            const ctx = getContext();
            if (!ctx) throw new Error('No active clinic context found');

            // 1. Execute Query (Fetch Raw Data)
            const query = `
                SELECT
                  invoices.display_id as invoice_no,
                  invoices.paid_amount,
                  date(invoices.created_at) as created_date,
                  patients.display_id as patient_code,
                  patients.full_name as patient_name,
                  treatment_cases.display_id as plan_code,
                  treatment_cases.name as plan_name,
                  doctors.name as doctor_name
                FROM invoices
                LEFT JOIN patients ON invoices.patient_id = patients.id
                LEFT JOIN treatment_cases ON invoices.treatment_case_id = treatment_cases.id
                LEFT JOIN doctors ON invoices.doctor_id = doctors.id
                WHERE (invoices.clinic_id = ? OR invoices.clinic_id = 'clinic_001')
                ORDER BY invoices.created_at ASC
            `;
            const rows = getDb().prepare(query).all(ctx.clinicId);

            // 2. Transform Data (Use Persistent IDs)
            const transformedRows = rows.map((row: any, index: number) => {
                return {
                    '#': index + 1,
                    'رقم الفاتورة': row.invoice_no,
                    'التاريخ': row.created_date,
                    'المبلغ': row.paid_amount,
                    'كود المريض': row.patient_code || '-',
                    'اسم المريض': row.patient_name || 'غير معروف',
                    'كود الخدمة': row.plan_code || '-',
                    'اسم الخدمة': row.plan_name || '-',
                    'الطبيب': row.doctor_name || '-'
                };
            });

            // 3. Generate Excel Buffer
            const worksheet = XLSX.utils.json_to_sheet(transformedRows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Financials");
            // Auto-width columns roughly
            const wscols = [
                { wch: 5 },  // #
                { wch: 10 }, // Invoice No
                { wch: 15 }, // Date
                { wch: 10 }, // Amount
                { wch: 10 }, // Patient Code
                { wch: 25 }, // Patient Name
                { wch: 10 }, // Plan Code
                { wch: 25 }, // Plan Name
                { wch: 20 }  // Doctor
            ];
            worksheet['!cols'] = wscols;

            const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

            // 4. Save Dialog
            const { canceled, filePath } = await dialog.showSaveDialog({
                title: 'تصدير التقرير المالي',
                defaultPath: `Financial_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
                filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
            });

            if (canceled || !filePath) {
                return { success: false, reason: 'canceled' };
            }

            // 5. Write File
            fs.writeFileSync(filePath, buffer);
            return { success: true, filePath };

        } catch (error: any) {
            console.error('Export Error:', error);
            return { success: false, error: error.message };
        }
    });

    // --- Patients ---
    ipcMain.handle('patients:getAll', () => {
        try {
            const clinicId = getCurrentClinicId();
            // Exclude soft-deleted patients from the list
            const query = "SELECT * FROM patients WHERE (clinic_id = ? OR clinic_id = 'clinic_001') AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY created_at DESC";
            return getDb().prepare(query).all(clinicId);
        } catch (e) {
            console.error('[patients:getAll] Error:', e);
            return [];
        }
    });

    ipcMain.handle('patients:getById', (_, id) => {
        try {
            const patient = getDb().prepare('SELECT * FROM patients WHERE id = ?').get(id);
            return patient || null;
        } catch (error: any) {
            console.error('Error fetching patient:', error);
            return null;
        }
    });

    ipcMain.handle('patients:getStatsForDelete', (_, { id }) => {
        try {
            const db = getDb();
            const appointmentsCount = (db.prepare('SELECT COUNT(*) as count FROM appointments WHERE patient_id = ?').get(id) as any)?.count || 0;
            const invoicesCount = (db.prepare('SELECT COUNT(*) as count FROM invoices WHERE patient_id = ?').get(id) as any)?.count || 0;
            const treatmentCasesCount = (db.prepare('SELECT COUNT(*) as count FROM treatment_cases WHERE patient_id = ?').get(id) as any)?.count || 0;
            return { appointmentsCount, invoicesCount, treatmentCasesCount };
        } catch (error: any) {
            console.error('Error fetching patient stats:', error);
            return { appointmentsCount: 0, invoicesCount: 0, treatmentCasesCount: 0 };
        }
    });

    ipcMain.handle('patients:create', (_, data) => {
        checkReadOnly();
        verifyPermission('ADD_PATIENT');
        const id = randomUUID();
        // Strict Single Source of Truth
        try {
            const clinicId = getCurrentClinicId();

            // whitelist allowed columns only
            const allowedColumns = ['full_name', 'phone', 'gender', 'city_id', 'notes', 'medical_history'];
            const dbData: any = {};

            // Map known fields if they exist
            if (data.full_name) dbData.full_name = data.full_name;
            if (data.name) dbData.full_name = data.name; // Fallback mapping

            if (data.phone) dbData.phone = data.phone;
            if (data.gender) dbData.gender = data.gender;
            if (data.city_id) dbData.city_id = data.city_id;
            if (data.cityId) dbData.city_id = data.cityId; // Fallback
            if (data.notes) dbData.notes = data.notes;

            // Map medical history (snake_case or camelCase input)
            if (data.medical_history) dbData.medical_history = data.medical_history;
            else if (data.medicalHistory) dbData.medical_history = data.medicalHistory;

            // Map birth_date (birth_date or birthDate input)
            if (data.birth_date) dbData.birth_date = data.birth_date;
            else if (data.birthDate) dbData.birth_date = data.birthDate;

            // Construct Insert
            const keys = Object.keys(dbData);
            const values = keys.map(k => dbData[k]);

            const placeholders = keys.map(() => '?');

            const maxId = (getDb().prepare('SELECT MAX(display_id) as max FROM patients').get() as any)?.max || 0;
            const displayId = maxId + 1;

            // Force clinic_id insert
            const cols = ['id', 'display_id', 'clinic_id', ...keys].join(',');
            const vals = [id, displayId, clinicId, ...values];
            const phs = ['?', '?', '?', ...placeholders].join(',');

            const stmt = getDb().prepare(`INSERT INTO patients (${cols}) VALUES (${phs})`);
            stmt.run(...vals);
            return { data: { ...dbData, id, clinicId }, error: null };
        } catch (err: any) {
            console.error('[patients:create] Error:', err);
            return { data: null, error: err.message };
        }
    });

    ipcMain.handle('patients:delete', (_, { id, deleteAppointments, deleteTreatmentCases, deleteInvoices }) => {
        checkReadOnly();
        verifyPermission('DELETE_PATIENT');

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

            return { success: true };
        } catch (err: any) {
            console.error('[patients:delete] Error:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('patients:import', async (_, { buffer }) => {
        checkReadOnly();
        // Strict Single Source of Truth
        const effectiveClinicId = getCurrentClinicId();

        try {
            const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

            let successCount = 0;
            let failedCount = 0;
            const errors: string[] = [];
            const sanitizePhone = (p: any) => String(p).replace(/[\s\-\(\)\.]/g, '').trim();
            const genderMap: any = { 'ذكر': 'male', 'أنثى': 'female', 'انثى': 'female', 'male': 'male', 'female': 'female' };

            const insertStmt = getDb().prepare(`
                INSERT INTO patients (id, display_id, clinic_id, full_name, phone, gender, created_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            const checkStmt = getDb().prepare("SELECT id FROM patients WHERE phone = ? AND (clinic_id = ? OR clinic_id = 'clinic_001')");
            const maxIdStmt = getDb().prepare('SELECT MAX(display_id) as max FROM patients');

            const transaction = getDb().transaction((rows) => {
                let currentDisplayId = (maxIdStmt.get() as any)?.max || 0;

                for (const row of rows) {
                    const name = row['الاسم'] || row['name'] || row['full_name'] || row['Name'];
                    const phoneRaw = row['رقم الهاتف'] || row['phone'] || row['Phone'];
                    // const ageRaw = row['السن'] || row['age'] || row['Age']; // Age cannot be stored
                    const genderRaw = row['النوع'] || row['gender'] || row['Gender'];
                    if (!name || !phoneRaw) { failedCount++; continue; }

                    const phone = sanitizePhone(phoneRaw);
                    const gender = genderMap[genderRaw] || genderMap[String(genderRaw).toLowerCase()] || null;
                    // const age = parseInt(ageRaw) || null;

                    if (checkStmt.get(phone, effectiveClinicId)) { continue; } // Duplicate check

                    currentDisplayId++;

                    try {
                        insertStmt.run(randomUUID(), currentDisplayId, effectiveClinicId, name, phone, gender);
                        successCount++;
                    } catch (e: any) {
                        failedCount++;
                        errors.push(`Error adding ${name}: ${e.message}`);
                    }
                }
            });
            transaction(jsonData);
            return { successCount, failedCount, errors };
        } catch (error: any) {
            return { successCount: 0, failedCount: 0, errors: [error.message] };
        }
    });

    // --- Appointments ---
    ipcMain.handle('appointments:getAll', () => {
        try {
            // Strict Single Source of Truth
            const effectiveClinicId = getCurrentClinicId();

            return getDb().prepare(`
                SELECT A.*, TC.name as service_name
                FROM appointments A
                LEFT JOIN treatment_cases TC ON A.treatment_case_id = TC.id
                WHERE (A.clinic_id = ? OR A.clinic_id = 'clinic_001')
                ORDER BY 
                    CASE WHEN A.date >= DATE('now', 'localtime') THEN 0 ELSE 1 END ASC,
                    CASE WHEN A.date >= DATE('now', 'localtime') THEN A.date END ASC,
                    CASE WHEN A.date >= DATE('now', 'localtime') THEN A.time END ASC,
                    CASE WHEN A.date < DATE('now', 'localtime') THEN A.date END DESC,
                    CASE WHEN A.date < DATE('now', 'localtime') THEN A.time END DESC
            `).all(effectiveClinicId);
        } catch (e) {
            console.error('[appointments:getAll] Error:', e);
            return [];
        }
    });

    ipcMain.handle('appointments:create', (_, data) => {
        checkReadOnly();
        verifyPermission('ADD_APPOINTMENT');
        // Strict Single Source of Truth
        const clinicId = getCurrentClinicId();

        const { ownerEmail, ...cleanData } = data; // strip old field

        const id = randomUUID();
        const keys = Object.keys(cleanData).filter(k => k !== 'clinicId');
        const values = keys.map(k => cleanData[k]);

        const placeholders = keys.map(() => '?');
        const cols = ['id', 'clinic_id', ...keys].join(',');
        const vals = [id, clinicId, ...values];
        const phs = ['?', '?', ...placeholders].join(',');
        try {
            getDb().prepare(`INSERT INTO appointments (${cols}) VALUES (${phs})`).run(...vals);
            return { data: { ...cleanData, id }, error: null };
        } catch (err: any) { return { data: null, error: err.message }; }
    });

    // --- Doctors ---
    // --- Doctors ---
    ipcMain.handle('doctors:getAll', () => {
        try {
            const clinicId = getCurrentClinicId();
            // User requested filtering by active=1 and is_deleted=0
            // Assuming default active=1 and is_deleted=0 if not set, but query should be explicit.
            return getDb().prepare("SELECT * FROM doctors WHERE (clinic_id = ? OR clinic_id = 'clinic_001') AND (is_deleted IS NULL OR is_deleted = 0) AND (active IS NULL OR active = 1) ORDER BY name ASC").all(clinicId);
        } catch (e) {
            console.error('[doctors:getAll] Error:', e);
            return [];
        }
    });

    ipcMain.handle('staff:get-all', () => {
        try {
            const clinicId = getCurrentClinicId();
            return getDb().prepare("SELECT * FROM doctors WHERE (clinic_id = ? OR clinic_id = 'clinic_001') AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY id DESC").all(clinicId);
        } catch (e) {
            console.error('[staff:get-all] Error:', e);
            return [];
        }
    });

    // --- Services ---
    ipcMain.handle('services:getAll', () => {
        try {
            const clinicId = getCurrentClinicId();
            // User requested filtering by is_deleted=0
            const rows = getDb().prepare("SELECT * FROM services WHERE (clinic_id = ? OR clinic_id = 'clinic_001') AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY name ASC").all(clinicId);
            return rows;
        } catch (e) {
            console.error('[services:getAll] Error:', e);
            return [];
        }
    });

    // --- Cities ---
    ipcMain.handle('cities:getAll', () => {
        try {
            const clinicId = getCurrentClinicId();
            // Filter by clinic_id (strict) and is_deleted=0
            const rows = getDb().prepare("SELECT * FROM cities WHERE clinic_id = ? AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY name ASC").all(clinicId);
            return rows;
        } catch (e) {
            console.error('[cities:getAll] Error:', e);
            return [];
        }
    });

    // --- Settings (Clinic Info) --- 
    // --- Settings (Clinic Info) --- 
    ipcMain.handle('settings:getClinicInfo', () => {
        try {
            const clinicId = getCurrentClinicId();

            // Prioritize 'clinic_settings' because that's where the user saves data
            // Attempt to get by ID
            let info = getDb().prepare('SELECT * FROM clinic_settings WHERE id = ?').get(clinicId) as any;

            if (!info) {
                // Fallback: If ID mismatch or single tenant, just get the one row
                info = getDb().prepare('SELECT * FROM clinic_settings LIMIT 1').get() as any;
            }

            if (info) {
                // Return normalized data structure
                // Unify Identity: Return the CANONICAL clinicId, not existing UUID in table
                return {
                    data: {
                        id: clinicId, // Force canonical ID
                        _internal_id: info.id, // Keep internal UUID if needed for debug but hide from primary logic
                        clinic_name: info.clinic_name,
                        owner_name: info.owner_name,
                        phone: info.phone,
                        address: info.address,
                        email: info.email, // might be null
                        whatsapp_number: info.whatsapp_number,
                        currency: info.currency,
                        clinic_logo: info.clinic_logo
                    },
                    error: null
                };
            }

            // If absolutely nothing in clinic_settings, try clinics table as last resort
            // ... (legacy logic omitted for simplicity unless requested)

            return { data: null, error: 'No clinic settings found' };

        } catch (error: any) {
            console.error('[settings:getClinicInfo] Error:', error);
            return { data: null, error: error.message };
        }
    });

    ipcMain.handle('settings:save-clinic-info', (_, data) => {
        checkReadOnly();
        verifyPermission('CLINIC_SETTINGS');
        try {
            console.log('[settings:save-clinic-info] Receiving:', {
                name: data.name,
                hasLogo: !!data.logo,
                logoLength: data.logo?.length
            });

            const existing = getDb().prepare('SELECT id FROM clinic_settings LIMIT 1').get() as { id: string };

            if (existing) {
                const stmt = getDb().prepare(`
                    UPDATE clinic_settings 
                    SET clinic_name = @name,
                        owner_name = @ownerName,
                        phone = @phone,
                        whatsapp_number = @whatsappNumber,
                        address = @address,
                        clinic_logo = @logo,
                        currency = @currency,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = @id
                `);

                const res = stmt.run({
                    name: data.name,
                    ownerName: data.ownerName,
                    phone: data.phone,
                    whatsappNumber: data.whatsappNumber || data.whatsapp,
                    address: data.address,
                    logo: data.logo,
                    currency: data.currency,
                    id: existing.id
                });
                console.log('[settings:save-clinic-info] Update result:', res.changes);
                return { success: res.changes > 0 };
            } else {
                // Insert new if missing
                const newId = randomUUID();
                console.log('[settings:save-clinic-info] No settings found. Inserting new row:', newId);
                const stmt = getDb().prepare(`
                    INSERT INTO clinic_settings (id, clinic_name, owner_name, phone, whatsapp_number, address, clinic_logo, currency, is_setup_completed)
                    VALUES (@id, @name, @ownerName, @phone, @whatsappNumber, @address, @logo, @currency, 1)
                `);

                stmt.run({
                    id: newId,
                    name: data.name,
                    ownerName: data.ownerName,
                    phone: data.phone,
                    whatsappNumber: data.whatsappNumber || data.whatsapp,
                    address: data.address,
                    logo: data.logo,
                    currency: data.currency
                });
                return { success: true };
            }
        } catch (error: any) {
            console.error('Save Clinic Info Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('settings:syncClinicInfo', (_, settings) => {
        checkReadOnly();
        verifyPermission('CLINIC_SETTINGS');
        try {
            const existing = getDb().prepare('SELECT id FROM clinic_settings LIMIT 1').get() as any;

            if (existing) {
                const stmt = getDb().prepare(`
                    UPDATE clinic_settings 
                    SET 
                        clinic_name = @name,
                        owner_name = @ownerName,
                        address = @address,
                        phone = @phone,
                        whatsapp_number = @whatsappNumber,
                        email = @email,
                        clinic_logo = @logo,
                        currency = @currency,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = @id
                `);
                stmt.run({
                    ...settings,
                    id: existing.id
                });
            } else {
                const stmt = getDb().prepare(`
                    INSERT INTO clinic_settings (id, clinic_name, owner_name, address, phone, whatsapp_number, email, clinic_logo, currency)
                    VALUES (@id, @name, @ownerName, @address, @phone, @whatsappNumber, @email, @logo, @currency)
                `);
                stmt.run({
                    ...settings,
                    id: settings.id || randomUUID()
                });
            }
            return { success: true };
        } catch (error: any) {
            console.error('Settings Sync Error:', error);
            return { success: false, error: error.message };
        }
    });



    // generic insert helper for other tables to save code space
    ipcMain.handle('db:insert', (_, { table, data }) => {
        checkReadOnly();

        // --- Permission Checks ---
        if (table === 'patients') verifyPermission('ADD_PATIENT');
        if (table === 'appointments') verifyPermission('ADD_APPOINTMENT');
        if (table === 'invoices') verifyPermission('CREATE_INVOICE');
        if (table === 'items' || table === 'inventory') verifyPermission('ADD_ITEM');
        if (table === 'doctors' || table === 'services' || table === 'cities') verifyPermission('CLINIC_SETTINGS');
        // -------------------------

        const id = randomUUID();

        // AUTO-INJECT CLINIC_ID Logic
        // Trusted tables that require clinic_id
        const domainTables = ['cities', 'services', 'doctors', 'staff', 'appointments', 'invoices', 'treatment_cases', 'patients', 'attachments'];

        let finalData = { ...data };

        if (domainTables.includes(table)) {
            try {
                const clinicId = getCurrentClinicId();
                if (!clinicId) throw new Error('Clinic ID not found');

                // Force overwrite/inject
                finalData['clinic_id'] = clinicId;

                console.log(`[db:insert] Injecting clinic_id=${clinicId} into ${table}`);
            } catch (e: any) {
                console.error(`[db:insert] Failed to inject clinic_id for ${table}:`, e);
                return { data: null, error: 'Database Context Error: ' + e.message };
            }
        }

        const keys = Object.keys(finalData);
        const values = Object.values(finalData);
        const placeholders = keys.map(() => '?');
        const cols = ['id', ...keys].join(',');
        const vals = [id, ...values];
        const phs = ['?', ...placeholders].join(',');
        try {
            if (table === 'attachments' && finalData.patient_id) {
                const pExists = getDb().prepare('SELECT id FROM patients WHERE id = ?').get(finalData.patient_id);
                console.log(`[db:insert] Debug Attachment: Patient ${finalData.patient_id} exists? ${!!pExists}`);
            }

            getDb().prepare(`INSERT INTO ${table} (${cols}) VALUES (${phs})`).run(...vals);
            return { data: { ...finalData, id }, error: null };
        } catch (err: any) {
            console.error(`[db:insert] Insert Error (${table}):`, err);



            // console.error('Payload:', JSON.stringify(finalData));
            return { data: null, error: err.message };
        }
    });

    // generic update helper
    ipcMain.handle('db:update', (_, { table, id, data }) => {
        checkReadOnly();
        // --- Permission Checks ---
        if (table === 'patients') verifyPermission('EDIT_PATIENT');
        if (table === 'appointments') verifyPermission('EDIT_APPOINTMENT');
        if (table === 'doctors' || table === 'services' || table === 'cities' || table === 'clinic_settings') verifyPermission('CLINIC_SETTINGS');
        // -------------------------
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map(k => `${k} = ?`).join(',');
        const vals = [...values, id];
        try {
            getDb().prepare(`UPDATE ${table} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...vals);
            return { data: { ...data, id }, error: null };
        } catch (err: any) { return { data: null, error: err.message }; }
    });

    // generic delete helper
    ipcMain.handle('db:delete', (_, { table, id }) => {
        checkReadOnly();

        // --- Permission Checks ---
        // --- Permission Checks ---
        if (table === 'patients') verifyPermission('DELETE_PATIENT');
        if (table === 'appointments') verifyPermission('DELETE_APPOINTMENT');
        if (table === 'invoices') verifyPermission('CREATE_INVOICE'); // Assuming create implies manage/delete for invoices or add separate permission if needed
        if (table === 'doctors' || table === 'services' || table === 'cities') verifyPermission('CLINIC_SETTINGS');
        if (table === 'stock_items') verifyPermission('ADD_ITEM');
        // -------------------------

        // SPECIAL HANDLING: If deleting an expense, must reverse Lab Payments
        if (table === 'expenses') {
            try {
                getDb().transaction(() => {
                    // 1. Delete linked lab_payments (Detailed distribution)
                    getDb().prepare('DELETE FROM lab_payments WHERE expense_id = ?').run(id);
                    // 2. Delete linked lab_general_payments (The overall payment record)
                    getDb().prepare('DELETE FROM lab_general_payments WHERE expense_id = ?').run(id);
                })();
            } catch (e) {
                console.error('Failed to clean up lab payments for expense:', e);
                // Continue to try deleting validation expense anyway? Or fail? 
                // Better to throw if transaction failed to ensure consistency.
                throw e;
            }
        }

        try {
            // Soft Delete Handlers
            if (['services', 'doctors', 'cities'].includes(table)) {
                getDb().prepare(`UPDATE ${table} SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
                return { data: true, error: null };
            }

            getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
            return { data: true, error: null };
        } catch (err: any) { return { data: null, error: err.message }; }
    });

    // generic SQL query
    ipcMain.handle('db:query', (_, { sql, params = [] }) => {
        try {
            return getDb().prepare(sql).all(...params);
        } catch (err: any) { console.error(err); throw err; }
    });

    // --- Specific Queries if needed ---
    // --- Specific Queries if needed ---
    ipcMain.handle('dashboard:stats', (_, data) => {
        const ctx = getContext();
        const effectiveClinicId = (data && data.clinicId) || ctx?.clinicId;

        // Return zeros if no context context
        if (!effectiveClinicId) return {
            totalPatients: 0,
            totalAppointments: 0,
            todayAppointments: 0
        };

        const totalPatients = getDb().prepare("SELECT COUNT(*) as count FROM patients WHERE (clinic_id = ? OR clinic_id = 'clinic_001') AND (is_deleted IS NULL OR is_deleted = 0)").get(effectiveClinicId) as any;
        const totalAppointments = getDb().prepare("SELECT COUNT(*) as count FROM appointments WHERE (clinic_id = ? OR clinic_id = 'clinic_001')").get(effectiveClinicId) as any;
        const todayAppointments = getDb().prepare("SELECT COUNT(*) as count FROM appointments WHERE date = CURRENT_DATE AND (clinic_id = ? OR clinic_id = 'clinic_001')").get(effectiveClinicId) as any;
        return {
            totalPatients: totalPatients.count,
            totalAppointments: totalAppointments.count,
            todayAppointments: todayAppointments.count
        };
    });

    ipcMain.handle('treatment_cases:recalculate', () => {
        try {
            const cases = getDb().prepare('SELECT id, total_cost FROM treatment_cases').all() as any[];
            let updatedCount = 0;
            const transaction = getDb().transaction((allCases) => {
                for (const c of allCases) {
                    const sumResult = getDb().prepare('SELECT SUM(paid_amount) as total FROM invoices WHERE treatment_case_id = ?').get(c.id) as any;
                    const grandTotalPaid = sumResult?.total || 0;
                    const balance = (c.total_cost || 0) - grandTotalPaid;

                    // Allow small float margin
                    const status = balance <= 1.0 ? 'closed' : 'active';

                    // Re-evaluate without owner_email check as strict ID lookup is safe, 
                    // but we should ideally update updated_at
                    getDb().prepare(`
                        UPDATE treatment_cases 
                        SET total_paid = ?, balance = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(grandTotalPaid, balance, status, c.id);
                    updatedCount++;
                }
            });
            transaction(cases);
            return { success: true, count: updatedCount };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    // --- Reports ---
    // --- Reports ---
    // --- Reports ---
    ipcMain.handle('reports:daily', (_, data) => {
        const ctx = getContext();
        const effectiveClinicId = (data && data.clinicId) || ctx?.clinicId;
        const date = data.date;

        if (!effectiveClinicId) return { totalRevenue: 0, patientCount: 0, completedAppointments: 0 };

        try {
            // 1. Total Revenue (Sum of paid_amount in invoices created ON that date)
            const revenueResult = getDb().prepare(`
                SELECT SUM(paid_amount) as total 
                FROM invoices 
                WHERE date(created_at) = ? AND (clinic_id = ? OR clinic_id = 'clinic_001')
            `).get(date, effectiveClinicId) as any;

            // 2. Patient Count (Distinct patients who had appointments today)
            const patientsResult = getDb().prepare(`
                SELECT COUNT(DISTINCT patient_id) as count 
                FROM appointments 
                WHERE date = ? AND (clinic_id = ? OR clinic_id = 'clinic_001')
            `).get(date, effectiveClinicId) as any;

            // 3. Completed Appointments (Status = 'attended' or 'completed')
            const completedResult = getDb().prepare(`
                SELECT COUNT(*) as count 
                FROM appointments 
                WHERE date = ? AND (status = 'attended' OR status = 'completed') AND (clinic_id = ? OR clinic_id = 'clinic_001')
            `).get(date, effectiveClinicId) as any;

            return {
                totalRevenue: revenueResult?.total || 0,
                patientCount: patientsResult?.count || 0,
                completedAppointments: completedResult?.count || 0
            };
        } catch (err: any) {
            console.error('Report Error:', err);
            return { totalRevenue: 0, patientCount: 0, completedAppointments: 0, error: err.message };
        }
    });

    // --- VCF Export ---
    ipcMain.handle('patients:export-vcf', async (_, { months }) => {
        try {
            const ctx = getContext();
            const clinicId = ctx?.clinicId;
            if (!clinicId) throw new Error('No active clinic context found');

            if (!months || !Array.isArray(months) || months.length === 0) {
                return { success: false, error: 'No months selected' };
            }

            // Build query conditions dynamically
            const conditions: string[] = [];
            const params: any[] = [clinicId];

            months.forEach((monthStr: string) => {
                // monthStr format: YYYY-MM
                const [year, month] = monthStr.split('-').map(Number);

                // Calculate Start Date (First day of selected month)
                // SQLite string format: YYYY-MM-DD HH:MM:SS
                const startDate = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;

                // Calculate End Date (First day of NEXT month)
                let nextYear = year;
                let nextMonth = month + 1;

                if (nextMonth > 12) {
                    nextMonth = 1;
                    nextYear += 1;
                }

                const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01 00:00:00`;

                // Condition: created_at >= Start AND created_at < End
                conditions.push(`(created_at >= ? AND created_at < ?)`);
                params.push(startDate, endDate);
            });

            // Combine with OR since we want patients from ANY of the selected months
            const whereClause = conditions.length > 0 ? `AND (${conditions.join(' OR ')})` : '';

            const query = `
                SELECT full_name, phone 
                FROM patients 
                WHERE (clinic_id = ? OR clinic_id = 'clinic_001') 
                ${whereClause}
            `;

            console.log('VCF Export Query:', query, params);
            const patients = getDb().prepare(query).all(...params) as any[];

            if (patients.length === 0) {
                return { success: false, error: 'No patients found for selected months' };
            }

            // Generate VCF Content
            const vcfContent = patients.map(p =>
                `BEGIN:VCARD\nVERSION:3.0\nFN:${p.full_name}\nTEL:${p.phone}\nEND:VCARD`
            ).join('\n');

            // Save Dialog
            const { canceled, filePath } = await dialog.showSaveDialog({
                title: 'Save VCF Contacts',
                defaultPath: `patients_${months.join('_')}.vcf`,
                filters: [{ name: 'VCard', extensions: ['vcf'] }]
            });

            if (canceled || !filePath) {
                return { success: false, cancelled: true };
            }

            fs.writeFileSync(filePath, vcfContent);
            return { success: true, filePath };

        } catch (error: any) {
            console.error('VCF Export Error:', error);
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle('appointments:markAttended', (_, payload) => {
        checkReadOnly();
        verifyPermission('CREATE_INVOICE'); // Attending creates an invoice
        // Use consistent clinic ID resolution matching create/getAll
        const clinicId = getCurrentClinicId();
        if (!clinicId) throw new Error('Action failed: Missing clinic context');

        const {
            appointmentId,
            treatmentCaseId,
            serviceName,
            cost,
            amountPaid,
            doctorId,
            newCaseName,
        } = payload;

        try {
            const result = getDb().transaction(() => {
                // 1. Get Appointment
                const appointment = getDb().prepare("SELECT * FROM appointments WHERE id = ? AND (clinic_id = ? OR clinic_id = 'clinic_001')").get(appointmentId, clinicId) as any;
                if (!appointment) throw new Error('Appointment not found or access denied');

                // 2. Check Invoice
                const existingInvoice = getDb().prepare('SELECT * FROM invoices WHERE appointment_id = ?').get(appointmentId);
                if (existingInvoice) throw new Error('Invoice already exists for this appointment');

                // 3. Handle Treatment Case
                let resolvedTCaseId = treatmentCaseId;

                if (treatmentCaseId === 'new') {
                    resolvedTCaseId = randomUUID();
                    const patient = getDb().prepare('SELECT full_name FROM patients WHERE id = ?').get(appointment.patient_id) as any;
                    const pName = patient ? patient.full_name : 'Unknown';
                    const bal = cost - amountPaid;

                    // Get next display_id
                    const maxCaseId = (getDb().prepare('SELECT MAX(display_id) as max FROM treatment_cases').get() as any)?.max || 0;
                    const caseDisplayId = maxCaseId + 1;

                    getDb().prepare(`
                        INSERT INTO treatment_cases (id, display_id, clinic_id, patient_id, patient_name, name, total_cost, total_paid, balance, status, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `).run(resolvedTCaseId, caseDisplayId, clinicId, appointment.patient_id, pName, newCaseName || serviceName, cost, amountPaid, bal, 'active');
                } else {
                    const tCase = getDb().prepare('SELECT * FROM treatment_cases WHERE id = ?').get(treatmentCaseId) as any;
                    if (!tCase) throw new Error('Treatment case not found');
                }

                const tCaseId = resolvedTCaseId;

                // 4. Create Invoice
                const invId = randomUUID();
                const isExisting = treatmentCaseId !== 'new';
                const invCost = isExisting ? amountPaid : cost;
                const invBal = isExisting ? 0 : (cost - amountPaid);
                const invStatus = invBal > 0 ? 'pending' : 'paid';

                const maxInvId = (getDb().prepare('SELECT MAX(display_id) as max FROM invoices').get() as any)?.max || 0;
                const invDisplayId = maxInvId + 1;

                getDb().prepare(`
                    INSERT INTO invoices (id, display_id, clinic_id, appointment_id, patient_id, doctor_id, service_id, treatment_case_id, amount, paid_amount, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).run(invId, invDisplayId, clinicId, appointmentId, appointment.patient_id, doctorId, appointment.service_id, tCaseId, invCost, amountPaid, invStatus);

                // 5. Update Treatment Case (Re-calculation Logic)
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

                return { success: true, invoiceId: invId, treatmentCaseId: tCaseId };
            })();

            return result;
        } catch (err: any) {
            console.error('IPC Error in markAttended:', err);
            return { success: false, error: err.message };
        }
    });

    // --- Detailed Reports ---
    ipcMain.handle('reports:doctors', (_, data) => {
        const ctx = getContext();
        const effectiveClinicId = (data && data.clinicId) || ctx?.clinicId;
        if (!effectiveClinicId) return { invoices: [], appointments: [] };

        const { from, to, doctorId } = data;

        try {
            // Build Invoices Query - Filter by clinic_id
            let invQuery = "SELECT * FROM invoices WHERE date(created_at) BETWEEN ? AND ? AND (clinic_id = ? OR clinic_id = 'clinic_001')";
            const invParams: any[] = [from, to, effectiveClinicId];

            if (doctorId && doctorId !== 'all') {
                invQuery += ' AND doctor_id = ?';
                invParams.push(doctorId);
            }

            const invoices = getDb().prepare(invQuery).all(...invParams);

            // Build Appointments Query 
            // Join invoices to allow filtering by doctor if needed, but primarily filter by clinic_id
            let aptQuery = `
                SELECT a.* 
                FROM appointments a
                LEFT JOIN invoices i ON a.invoice_id = i.id
                WHERE a.status = 'attended' AND a.date BETWEEN ? AND ? AND (a.clinic_id = ? OR a.clinic_id = 'clinic_001')
            `;
            const aptParams: any[] = [from, to, effectiveClinicId];

            if (doctorId && doctorId !== 'all') {
                aptQuery += ' AND i.doctor_id = ?';
                aptParams.push(doctorId);
            }

            const appointments = getDb().prepare(aptQuery).all(...aptParams);

            return { invoices, appointments };
        } catch (err: any) {
            console.error('Reports Doctors Error:', err);
            return { invoices: [], appointments: [], error: err.message };
        }
    });

    // --- Invoices ---
    ipcMain.handle('invoices:getAll', () => {
        try {
            const clinicId = getCurrentClinicId();
            // Join with treatment_cases and services to get service name
            const rows = getDb().prepare(`
                SELECT i.*, 
                       tc.name as plan_name, 
                       s.name as service_item_name
                FROM invoices i
                LEFT JOIN treatment_cases tc ON i.treatment_case_id = tc.id
                LEFT JOIN services s ON i.service_id = s.id
                WHERE (i.clinic_id = ? OR i.clinic_id = 'clinic_001')
                ORDER BY i.created_at DESC
            `).all(clinicId);

            return rows.map((row: any) => ({
                ...row,
                service_name: row.plan_name || row.service_item_name
            }));
        } catch (e) {
            console.error('[invoices:getAll] Error:', e);
            return [];
        }
    });

    ipcMain.handle('invoices:delete', (_, { id }) => {
        checkReadOnly();
        try {
            const result = getDb().transaction(() => {
                // 1. Get Invoice Details
                const invoice = getDb().prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
                if (!invoice) return { success: true }; // Already gone

                const tCaseId = invoice.treatment_case_id;

                // 2. Cascade Delete Appointment (if linked)
                getDb().prepare('DELETE FROM appointments WHERE invoice_id = ?').run(id);

                // 3. Delete Invoice
                getDb().prepare('DELETE FROM invoices WHERE id = ?').run(id);

                // 3. Sync Treatment Case (if exists)
                if (tCaseId) {
                    const sumResult = getDb().prepare('SELECT SUM(paid_amount) as total FROM invoices WHERE treatment_case_id = ?').get(tCaseId) as any;
                    const grandTotalPaid = sumResult?.total || 0;

                    const currentCase = getDb().prepare('SELECT total_cost FROM treatment_cases WHERE id = ?').get(tCaseId) as any;

                    if (currentCase) {
                        const caseTotalCost = currentCase.total_cost || 0;
                        const caseBalance = caseTotalCost - grandTotalPaid;
                        // Re-evaluate status: if balance > small margin, it's active again
                        const caseStatus = caseBalance <= 1.0 ? 'closed' : 'active';

                        getDb().prepare(`
                            UPDATE treatment_cases 
                            SET total_paid = ?, balance = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `).run(grandTotalPaid, caseBalance, caseStatus, tCaseId);
                    }
                }

                return { success: true };
            })();
            return result;
        } catch (err: any) {
            console.error('Invoice Delete Error:', err);
            return { success: false, error: err.message };
        }
    });

    // --- Treatment Cases ---
    ipcMain.handle('treatment_cases:getAll', () => {
        try {
            const clinicId = getCurrentClinicId();
            return getDb().prepare("SELECT * FROM treatment_cases WHERE (clinic_id = ? OR clinic_id = 'clinic_001') ORDER BY created_at DESC").all(clinicId);
        } catch (e) {
            console.error('[treatment_cases:getAll] Error:', e);
            return [];
        }
    });

    ipcMain.handle('treatment_cases:create', (_, data) => {
        checkReadOnly();
        const id = randomUUID();
        try {
            const clinicId = getCurrentClinicId(); // Inject clinic_id

            // Get next display_id
            const maxId = (getDb().prepare('SELECT MAX(display_id) as max FROM treatment_cases').get() as any)?.max || 0;
            const displayId = maxId + 1;

            getDb().prepare(`
                INSERT INTO treatment_cases (id, display_id, clinic_id, patient_id, patient_name, name, total_cost, total_paid, balance, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(
                id,
                displayId,
                clinicId,
                data.patientId,
                data.patientName,
                data.name,
                data.totalCost,
                0, // Initial paid
                data.totalCost, // Initial balance = cost
                'active'
            );
            return { data: { ...data, id, clinicId }, error: null };
        } catch (err: any) {
            return { data: null, error: err.message };
        }
    });

    ipcMain.handle('treatment_cases:delete', (_, { id }) => {
        try {
            // Optional: Check or delete linked invoices/appointments?
            // For now, let's keep it simple: just delete the case.
            // Foreign keys might cascade if set up, otherwise orphans remain.
            // Given this is a simple schema, we'll just delete the case row.
            getDb().prepare('DELETE FROM treatment_cases WHERE id = ?').run(id);
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('treatment_cases:getByPatient', (_, { patientId }) => {
        try {
            const clinicId = getCurrentClinicId();
            // Fetch active cases for specific patient
            // Also ensuring strictly active and balance > 0 (as per user request "remaining_amount > 0")
            // Actually user request said "remaining_amount > 0".
            // My default 'active' logic usually implies balance > 1.0 (float tolerance). 
            // I'll check 'active' AND 'balance > 0' just to be safe.
            return getDb().prepare(`
                SELECT * FROM treatment_cases 
                WHERE (clinic_id = ? OR clinic_id = 'clinic_001') AND patient_id = ? 
                AND status = 'active' AND balance > 0
                ORDER BY created_at DESC
            `).all(clinicId, patientId);
        } catch (err: any) {
            console.error('Error fetching patient cases:', err);
            return [];
        }
    });

    ipcMain.handle('treatment_cases:getActiveDetails', () => {
        try {
            const clinicId = getCurrentClinicId();
            return getDb().prepare(`
                SELECT 
                    tp.id, 
                    tp.name as plan_name, 
                    tp.total_cost, 
                    tp.total_paid, 
                    (tp.total_cost - tp.total_paid) as remaining,
                    p.full_name as patient_name
                FROM treatment_cases tp
                JOIN patients p ON tp.patient_id = p.id
                WHERE tp.status = 'active' AND (tp.clinic_id = ? OR tp.clinic_id = 'clinic_001')
                ORDER BY remaining DESC
            `).all(clinicId);
        } catch (err: any) {
            console.error('Error fetching active plans:', err);
            return [];
        }
    });
    // --- Backup & Restore ---
    ipcMain.handle('database:backup', async () => {
        try {
            const userDataPath = app.getPath('userData');
            const sourcePath = path.join(userDataPath, 'dental-flow.db');

            if (!fs.existsSync(sourcePath)) {
                return { success: false, error: 'Database file not found.' };
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const defaultFilename = `backup_dental_flow_${timestamp}.db`;

            const { canceled, filePath } = await dialog.showSaveDialog({
                title: 'حفظ نسخة احتياطية',
                defaultPath: defaultFilename,
                filters: [{ name: 'Database Files', extensions: ['db', 'sqlite'] }]
            });

            if (canceled || !filePath) return { success: false, reason: 'canceled' };

            fs.copyFileSync(sourcePath, filePath);
            return { success: true, filePath };
        } catch (error: any) {
            console.error('Backup Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('database:restore', async () => {
        try {
            // 1. Select Backup File
            const { canceled, filePaths } = await dialog.showOpenDialog({
                title: 'استعادة نسخة احتياطية',
                filters: [{ name: 'Backup/Database Files', extensions: ['zip', 'db', 'sqlite'] }],
                properties: ['openFile']
            });

            if (canceled || filePaths.length === 0) return { success: false, reason: 'canceled' };
            const sourcePath = filePaths[0];

            // 2. Safety Backup of Current DB
            const userDataPath = app.getPath('userData');
            const currentDbPath = path.join(userDataPath, 'dental-flow.db');

            if (fs.existsSync(currentDbPath)) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const tempBackup = path.join(userDataPath, `pre_restore_backup_${timestamp}.db`);
                try {
                    fs.copyFileSync(currentDbPath, tempBackup);
                    console.log('Safety backup created at:', tempBackup);
                } catch (e) {
                    console.error('Safety backup failed (non-fatal):', e);
                }
            }

            // 3. Close Active Connection
            closeConnection();

            // 4. Perform Restore (Smart: Handles .zip or .db)
            const result = await backupService.restoreFromLocalFile(sourcePath);

            if (result.success) {
                // Reply to UI FIRST, then restart
                setTimeout(() => {
                    app.relaunch();
                    app.exit(0);
                }, 1500);
            } else {
                // If failed, try to reopen?
                initializeDatabase();
            }

            return result;
        } catch (error: any) {
            console.error('Restore Error:', error);
            initializeDatabase();
            return { success: false, error: error.message };
        }
    });

    // --- Smart Import ---


    // --- Smart Import Headers ---
    ipcMain.handle('patients:getExcelHeaders', async (_, { filePath }) => {
        try {
            if (!filePath || !fs.existsSync(filePath)) {
                return { success: false, error: 'File not found' };
            }
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Get headers (first row)
            const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];

            return { success: true, headers: headers || [] };
        } catch (error: any) {
            console.error('Get Headers Error:', error);
            return { success: false, error: error.message };
        }
    });

    // --- Smart Import ---
    ipcMain.handle('patients:smartImport', async (_, { filePath, mapping }) => {
        try {
            const clinicId = getCurrentClinicId();
            // mapping: { dbField: excelHeader }
            // e.g. { full_name: 'Patient Name', phone: 'Mobile No', ... }

            if (!filePath || !fs.existsSync(filePath)) {
                return { successCount: 0, failedCount: 0, errors: ['File not found'] };
            }

            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

            let successCount = 0;
            let failedCount = 0;
            const errors: string[] = [];

            // Prepare statements
            // Get max display_id
            let maxId = (getDb().prepare('SELECT MAX(display_id) as max FROM patients').get() as any)?.max || 0;

            const insertStmt = getDb().prepare(`
                INSERT INTO patients (id, display_id, full_name, phone, gender, age, notes, city_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             `);

            // We need to resolve city name to city_id if mapped
            const cityMap = new Map(); // name -> id
            getDb().prepare("SELECT id, name FROM cities WHERE clinic_id = ? OR clinic_id = 'clinic_001'").all(clinicId).forEach((c: any) => cityMap.set(c.name, c.id));

            // Helper for Gender
            const genderMap: any = {
                'ذكر': 'male', 'أنثى': 'female', 'انثى': 'female', 'male': 'male', 'female': 'female', 'm': 'male', 'f': 'female'
            };

            const transaction = getDb().transaction((rows) => {
                for (const row of rows) {
                    // 1. Extract values using mapping
                    // mapping keys are our DB fields: full_name, phone, gender, age, city, notes

                    const nameHeader = mapping['full_name'];
                    const phoneHeader = mapping['phone'];
                    const genderHeader = mapping['gender'];
                    const ageHeader = mapping['age'];
                    const cityHeader = mapping['city'];
                    const notesHeader = mapping['notes'];

                    const name = row[nameHeader];
                    const phone = row[phoneHeader] ? String(row[phoneHeader]).replace(/[\s\-\(\)\.]/g, '').trim() : null;

                    if (!name || !phone) {
                        failedCount++;
                        continue;
                    }

                    // Check duplicates
                    const existing = getDb().prepare("SELECT id FROM patients WHERE phone = ? AND (clinic_id = ? OR clinic_id = 'clinic_001')").get(phone, clinicId);
                    if (existing) {
                        // Skip duplicate
                        continue;
                    }

                    const rawGender = row[genderHeader];
                    const gender = rawGender ? (genderMap[rawGender] || genderMap[String(rawGender).toLowerCase()] || null) : null;

                    const rawAge = row[ageHeader];
                    const age = rawAge ? parseInt(rawAge) : null;

                    const rawCity = row[cityHeader];
                    let cityId = null;
                    if (rawCity) {
                        if (cityMap.has(rawCity)) {
                            cityId = cityMap.get(rawCity);
                        } else {
                            // Auto-Create for better UX
                            const newCityId = randomUUID();
                            try {
                                getDb().prepare("INSERT INTO cities (id, name, clinic_id) VALUES (?, ?, ?)").run(newCityId, rawCity, clinicId);
                                cityMap.set(rawCity, newCityId);
                                cityId = newCityId;
                            } catch (e) {
                                console.error('City create error', e);
                                // Fallback to null if error
                            }
                        }
                    }

                    const notes = row[notesHeader] || '';

                    maxId++;

                    try {
                        insertStmt.run(randomUUID(), maxId, name, phone, gender, age, notes, cityId);
                        successCount++;
                    } catch (e: any) {
                        failedCount++;
                        errors.push(`Error adding ${name}: ${e.message}`);
                    }
                }
            });

            transaction(jsonData);

            return { successCount, failedCount, errors };

        } catch (error: any) {
            console.error('Smart Import Error:', error);
            return { successCount: 0, failedCount: 0, errors: [error.message] };
        }
    });

    // --- Backup & Restore ---
    ipcMain.handle('backup:authenticate', async () => {
        try {
            return await googleDriveService.isAuthenticated();
        } catch (error) {
            console.error('Auth Check Error:', error);
            return false;
        }
    });

    ipcMain.handle('backup:start-auth', async () => {
        try {
            return await googleDriveService.startAuthFlow();
        } catch (error: any) {
            console.error('Start Auth Error:', error);
            throw new Error(error.message);
        }
    });

    ipcMain.handle('backup:get-user', async () => {
        try {
            return await googleDriveService.getUserInfo();
        } catch (error) {
            console.error('Get User Info Error:', error);
            return null;
        }
    });

    ipcMain.handle('backup:run', async (_, { password } = {}) => {
        try {
            console.log('Main: Starting backup (Local Only)...');
            return await backupService.performBackup({ password, mode: 'local' });
        } catch (error: any) {
            console.error('Backup Run Error:', error);
            return { success: false, error: error.message };
        }
    });

    // Alias for consistency with user request (Default to Local Only)
    ipcMain.handle('backup:create', async (_, { password } = {}) => {
        try {
            console.log('Main: Starting backup (Local)...');
            return await backupService.performBackup({ password, mode: 'local' });
        } catch (error: any) {
            console.error('Backup Create Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('backup:get-local-path', () => {
        return backupService.getLocalPath();
    });

    ipcMain.handle('backup:set-local-path', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Select Backup Folder'
        });
        if (!result.canceled && result.filePaths.length > 0) {
            const p = result.filePaths[0];
            backupService.setLocalPath(p);
            return p;
        }
        return null;
    });

    ipcMain.handle('backup:restore', async (_, args) => {
        try {
            // Get active DB path safely without depending on getDb() (which crashes if corrupt)
            const activeDbPath = path.join(app.getPath('userData'), 'dental.db');

            let currentUserEmail = args?.email;
            if (!currentUserEmail) {
                try {
                    // Attempt to fetch email, but fail silently if DB is corrupt
                    const db = getDb();
                    const stmt = db.prepare('SELECT email FROM clinic_settings LIMIT 1');
                    const row = stmt.get() as any;
                    if (row) currentUserEmail = row.email;
                } catch (e) {
                    console.warn('Skipping restoration email check (DB unavailable):', e);
                }
            }

            closeConnection();

            const result = await backupService.restoreFromCloud(
                args?.fileId,
                args?.password,
                activeDbPath,
                currentUserEmail,
                args?.force
            );

            if (result.success) {
                app.relaunch();
                app.exit(0);
            } else {
                throw new Error(result.error || 'Restore failed without error message');
            }
            return result;
        } catch (error: any) {
            console.error('Restore Error:', error);
            // Re-open DB if restore failed so app doesn't crash
            initializeDatabase();
            // Pass special security errors through
            return { success: false, error: error.message };
        }
    });

    // Explicitly log registration to confirm it runs
    console.log('Registering handler: backup:list-cloud');
    ipcMain.handle('backup:list-cloud', async () => {
        try {
            console.log('Invoked: backup:list-cloud');
            const files = await googleDriveService.listFiles();
            return files || [];
        } catch (e) {
            console.error('List Cloud Error', e);
            return [];
        }
    });

    ipcMain.handle('backup:delete-cloud', async (_, { fileId }) => {
        try {
            await googleDriveService.deleteFile(fileId);
            return { success: true };
        } catch (e: any) {
            console.error('Delete Cloud Error', e);
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle('backup:restore-local', async (_, args) => {
        let filePath = args?.filePath;
        const password = args?.password;
        try {
            // 1. Open File Dialog ONLY if path not provided
            if (!filePath) {
                const { canceled, filePaths } = await dialog.showOpenDialog({
                    title: 'Select Backup File',
                    filters: [
                        { name: 'All Backup Files', extensions: ['db', 'enc', 'sqlite'] },
                        { name: 'Database Files', extensions: ['db'] },
                        { name: 'Encrypted Backup Files', extensions: ['enc'] }
                    ],
                    properties: ['openFile']
                });

                if (canceled || filePaths.length === 0) return { success: false, reason: 'canceled' };
                filePath = filePaths[0];
            }

            // 2. Get active DB path & current email
            const activeDbPath = path.join(app.getPath('userData'), 'dental.db');

            let currentUserEmail = args?.email;
            if (!currentUserEmail) {
                try {
                    const db = getDb();
                    const stmt = db.prepare('SELECT email FROM clinic_settings LIMIT 1');
                    const row = stmt.get() as any;
                    if (row) currentUserEmail = row.email;
                } catch (e) {
                    console.warn('Skipping restoration email check (DB unavailable):', e);
                }
            }

            closeConnection();

            // 3. Call Service
            const result = await backupService.restoreFromLocalFile(filePath, password, activeDbPath, currentUserEmail);

            if (result.success) {
                setTimeout(() => {
                    app.relaunch();
                    app.exit(0);
                }, 1500);
            } else {
                throw new Error(result.error || 'Local restore failed');
            }
            return result;
        } catch (error: any) {
            console.error('Local Restore Error:', error);
            initializeDatabase();
            // Return filePath to allow retrying without re-selecting
            return { success: false, error: error.message, filePath };
        }
    });

    ipcMain.handle('backup:cloud-now', async (_, { password } = {}) => {
        try {
            const isAuth = await googleDriveService.isAuthenticated();
            if (!isAuth) return { success: false, error: 'Not authenticated with Cloud' };

            return await backupService.performBackup({ mode: 'cloud', password });
        } catch (error: any) {
            console.error('Cloud Backup Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('settings:get-backup-schedule', () => {
        return backupService.getSchedule();
    });

    ipcMain.handle('settings:set-backup-schedule', (_, frequency) => {
        backupService.setSchedule(frequency);
        return true;
    });

    ipcMain.handle('backup:get-last-date', () => {
        return backupService.getLastBackupDate();
    });

    // --- Notifications ---
    // --- Notifications ---
    ipcMain.handle('notifications:get-all', async (_, { userId }) => {
        const clinicId = getCurrentClinicId();
        let allNotifications: any[] = [];

        // 1. Local Notifications (Stock, System)
        try {
            const local = getDb().prepare(`
                SELECT * FROM notifications 
                WHERE clinic_id = ? 
                ORDER BY created_at DESC 
                LIMIT 50
            `).all(clinicId) as any[];
            allNotifications = [...local];
        } catch (e) {
            console.error('Local notifications error:', e);
        }

        // 2. Supabase Notifications (Cloud/Admin)
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (!error && data) {
                // Determine read status for cloud notifs (stored locally in localStorage on frontend usually, 
                // but we might need a sync mechanism. For now, we return raw supbase data)
                // We map supabase ID to avoid collision if UUIDs clash (unlikely)
                // effectively merging arrays
                allNotifications = [...allNotifications, ...data];
            }
        } catch (e) {
            // Soft fail: User might be offline
            console.warn('Supabase notifications skipped (offline/error):', e);
        }

        // 3. Sort merged list by Date DESC
        allNotifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // 4. Return combined result
        // We trim to reasonable limit (e.g. 50)
        return { success: true, data: allNotifications.slice(0, 50) };
    });

    ipcMain.handle('notifications:mark-read', (_, { id }) => {
        try {
            getDb().prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    // --- Expenses ---
    ipcMain.handle('expenses:get-all', () => {
        try {
            const expenses = getDb().prepare('SELECT * FROM expenses ORDER BY date DESC, created_at DESC').all();
            return { success: true, data: expenses };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('expenses:create', (_, { id, amount, date, category, description }) => {
        checkReadOnly();
        verifyPermission('ADD_EXPENSE');
        try {
            const stmt = getDb().prepare(`
                INSERT INTO expenses (id, amount, date, category, description)
                VALUES (?, ?, ?, ?, ?)
            `);
            stmt.run(id, amount, date, category, description);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('expenses:update', (_, { id, amount, date, category, description }) => {
        checkReadOnly();
        verifyPermission('EDIT_EXPENSE');
        try {
            const stmt = getDb().prepare(`
                UPDATE expenses 
                SET amount = ?, date = ?, category = ?, description = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            stmt.run(amount, date, category, description, id);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('expenses:delete', (_, { id }) => {
        checkReadOnly();
        verifyPermission('DELETE_EXPENSE');
        try {
            getDb().transaction(() => {
                // 1. Delete linked lab_payments (Detailed distribution)
                getDb().prepare('DELETE FROM lab_payments WHERE expense_id = ?').run(id);
                // 2. Delete linked lab_general_payments (The overall payment record)
                getDb().prepare('DELETE FROM lab_general_payments WHERE expense_id = ?').run(id);

                // 3. Delete the expense itself
                getDb().prepare('DELETE FROM expenses WHERE id = ?').run(id);
            })();
            return { success: true };
        } catch (error: any) {
            console.error('[expenses:delete] Error:', error);
            return { success: false, error: error.message };
        }
    });



    // --- Stock / Inventory Management ---
    ipcMain.handle('stock:get-items', () => {
        try {
            const clinicId = getCurrentClinicId();
            return getDb().prepare(`
                SELECT si.*, sc.name as category_name
                FROM stock_items si
                LEFT JOIN stock_categories sc ON si.category_id = sc.id
                WHERE si.clinic_id = ?
                ORDER BY si.name ASC
            `).all(clinicId);
        } catch (e: any) {
            console.error('[stock:get-items] Error:', e);
            return [];
        }
    });

    ipcMain.handle('stock:add-item', (_, data) => {
        checkReadOnly();
        verifyPermission('ADD_ITEM');
        try {
            const clinicId = getCurrentClinicId();
            const stmt = getDb().prepare(`
                INSERT INTO stock_items (clinic_id, name, quantity, min_quantity, category_id)
                VALUES (?, ?, ?, ?, ?)
            `);
            const info = stmt.run(clinicId, data.name, data.quantity || 0, data.min_quantity || 0, data.category_id || null);
            return { success: true, id: info.lastInsertRowid };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('stock:update-item', (_, { id, name, min_quantity }) => {
        checkReadOnly();
        verifyPermission('ADD_ITEM'); // Using ADD_ITEM as general inventory management permission
        try {
            const stmt = getDb().prepare(`
                UPDATE stock_items 
                SET name = ?, min_quantity = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            stmt.run(name, min_quantity, id);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('stock:subtract-item', (_, { id, amount, reason }) => {
        checkReadOnly();
        verifyPermission('SUBTRACT_ITEM');
        try {
            const clinicId = getCurrentClinicId();
            const transaction = getDb().transaction(() => {
                // 1. Subtract
                getDb().prepare(`
                    UPDATE stock_items 
                    SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(amount, id);

                // 2. Record Movement
                getDb().prepare(`
                    INSERT INTO stock_movements (clinic_id, item_id, change, reason)
                    VALUES (?, ?, ?, ?)
                `).run(clinicId, id, -amount, reason);

                // 3. Check for Low Stock & Notify
                const item = getDb().prepare('SELECT name, quantity, min_quantity FROM stock_items WHERE id = ?').get(id) as any;
                if (item) {
                    const msgPart = `كمية الصنف "${item.name}"`;

                    if (item.quantity <= item.min_quantity) {
                        // Low Stock Logic (Create Notification)
                        const exists = getDb().prepare("SELECT id FROM notifications WHERE message LIKE ? AND is_read = 0").get(`%${msgPart}%`);

                        if (!exists) {
                            const notifId = randomUUID();
                            const now = new Date().toISOString();
                            getDb().prepare(`
                                INSERT INTO notifications (id, clinic_id, title, message, type, link, created_at)
                                VALUES (?, ?, ?, ?, 'warning', '/stock', ?)
                            `).run(notifId, clinicId, 'تنبيه مخزون منخفض', `${msgPart} وصلت إلى ${item.quantity} (الحد الأدنى: ${item.min_quantity})`, now);
                        }
                    } else {
                        // Stock Recovered Logic (Resolve Notification)
                        console.log(`Checking recovery for item: ${item.name} (Qty: ${item.quantity}, Min: ${item.min_quantity})`);

                        // We DELETE the notification because the "low stock" situation is no longer valid.
                        // Marking as read is okay, but deleting cleans up the "Alert" status completely.
                        // We match ANY unread warning about this item.
                        const deleteResult = getDb().prepare("DELETE FROM notifications WHERE message LIKE ? AND is_read = 0").run(`%${msgPart}%`);
                        console.log(`Recovery: Deleted ${deleteResult.changes} notifications for ${item.name}`);
                    }
                }
            });
            transaction();
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });








    // For Report
    ipcMain.handle('stock:get-movements', (_, { startDate, endDate }) => {
        checkReadOnly();
        // Return movements joined with item names
        return getDb().prepare(`
            SELECT sm.*, si.name as item_name 
            FROM stock_movements sm
            JOIN stock_items si ON sm.item_id = si.id
            WHERE sm.created_at BETWEEN ? AND ?
            ORDER BY sm.created_at DESC
        `).all(startDate + ' 00:00:00', endDate + ' 23:59:59');
    });

    // --- Stock Categories ---
    ipcMain.handle('stock:get-categories', () => {
        try {
            const clinicId = getCurrentClinicId();
            return getDb().prepare("SELECT * FROM stock_categories WHERE clinic_id = ? ORDER BY name ASC").all(clinicId);
        } catch (e: any) {
            console.error('[stock:get-categories] Error:', e);
            return [];
        }
    });

    ipcMain.handle('stock:create-category', (_, { name }) => {
        checkReadOnly();
        verifyPermission('ADD_ITEM');
        try {
            const clinicId = getCurrentClinicId();
            const id = randomUUID();
            getDb().prepare("INSERT INTO stock_categories (id, clinic_id, name) VALUES (?, ?, ?)").run(id, clinicId, name);
            return { success: true, id };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('stock:delete-category', (_, { id }) => {
        checkReadOnly();
        verifyPermission('ADD_ITEM');
        try {
            // Check if used? Maybe just let items have null category
            getDb().prepare("UPDATE stock_items SET category_id = NULL WHERE category_id = ?").run(id);
            getDb().prepare("DELETE FROM stock_categories WHERE id = ?").run(id);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });
}

