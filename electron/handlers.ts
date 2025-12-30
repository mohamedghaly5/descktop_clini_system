import { ipcMain, dialog, app } from 'electron';
import path from 'path';
import { getDb } from './database';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

export function registerHandlers() {
    const db = getDb();

    // --- Financial Export ---
    // --- Financial Export ---
    ipcMain.handle('financials:export', async () => {
        try {
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
                ORDER BY invoices.created_at ASC
            `;
            const rows = db.prepare(query).all();

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

    // Generic DB Query Handler (for rapid refactoring, though specific handlers are better strictly speaking)
    // For this MVP transition, we'll implement specific generic actions per resource to mimic basic Supabase operations.

    // --- Patients ---
    ipcMain.handle('patients:getAll', (_, { clinicId }) => {
        // Note: clinicId might be used for filtering if we support multi-tenancy locally, 
        // but for local SQLite usually it's single tenant. We'll ignore it or use it if schema has it.
        // Our schema has clinic_id.
        let query = 'SELECT * FROM patients ORDER BY created_at DESC';
        const params = [];
        if (clinicId) {
            query = 'SELECT * FROM patients WHERE clinic_id = ? ORDER BY created_at DESC';
            params.push(clinicId);
        }
        return db.prepare(query).all(...params);
    });

    ipcMain.handle('patients:create', (_, data) => {
        const id = randomUUID();
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?');

        // Get next display_id
        const maxId = (db.prepare('SELECT MAX(display_id) as max FROM patients').get() as any)?.max || 0;
        const displayId = maxId + 1;

        // Add ID and display_id to data
        const cols = ['id', 'display_id', ...keys].join(',');
        const vals = [id, displayId, ...values];
        const phs = ['?', '?', ...placeholders].join(',');

        try {
            const stmt = db.prepare(`INSERT INTO patients (${cols}) VALUES (${phs})`);
            stmt.run(...vals);
            return { data: { ...data, id }, error: null };
        } catch (err: any) {
            return { data: null, error: err.message };
        }
    });

    ipcMain.handle('patients:import', async (_, buffer) => {
        try {
            const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

            let successCount = 0;
            let failedCount = 0;
            const errors: string[] = [];

            // Mapping helpers
            const sanitizePhone = (p: any) => String(p).replace(/[\s\-\(\)\.]/g, '').trim();
            const genderMap: any = {
                'ذكر': 'male', 'أنثى': 'female', 'انثى': 'female',
                'male': 'male', 'female': 'female'
            };

            const insertStmt = db.prepare(`
                INSERT INTO patients (id, full_name, phone, age, gender, created_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);

            const checkStmt = db.prepare('SELECT id FROM patients WHERE phone = ?');

            const transaction = db.transaction((rows) => {
                for (const row of rows) {
                    // Map columns
                    const name = row['الاسم'] || row['name'] || row['full_name'] || row['Name'];
                    const phoneRaw = row['رقم الهاتف'] || row['phone'] || row['Phone'];
                    const ageRaw = row['السن'] || row['age'] || row['Age'];
                    const genderRaw = row['النوع'] || row['gender'] || row['Gender'];

                    if (!name || !phoneRaw) {
                        failedCount++; // Skip invalid
                        continue;
                    }

                    const phone = sanitizePhone(phoneRaw);
                    const gender = genderMap[genderRaw] || genderMap[String(genderRaw).toLowerCase()] || null;
                    const age = parseInt(ageRaw) || null;

                    // Check duplicate
                    const existing = checkStmt.get(phone);
                    if (existing) {
                        // Skip duplicate silently or count as failed/skimmed?
                        // Prompt says "Handle duplicates gracefully... skip that row"
                        continue;
                    }

                    try {
                        insertStmt.run(randomUUID(), name, phone, age, gender);
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
            console.error('Import Error:', error);
            // Return valid structure even on crash
            return { successCount: 0, failedCount: 0, errors: [error.message] };
        }
    });

    // --- Appointments ---
    ipcMain.handle('appointments:getAll', () => {
        return db.prepare(`
            SELECT A.*, TC.name as service_name
            FROM appointments A
            LEFT JOIN treatment_cases TC ON A.treatment_case_id = TC.id
            ORDER BY A.date DESC, A.time DESC
        `).all();
    });

    ipcMain.handle('appointments:create', (_, data) => {
        const id = randomUUID();
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?');
        const cols = ['id', ...keys].join(',');
        const vals = [id, ...values];
        const phs = ['?', ...placeholders].join(',');
        try {
            db.prepare(`INSERT INTO appointments (${cols}) VALUES (${phs})`).run(...vals);
            return { data: { ...data, id }, error: null };
        } catch (err: any) { return { data: null, error: err.message }; }
    });

    // --- Doctors ---
    ipcMain.handle('doctors:getAll', () => db.prepare('SELECT * FROM doctors ORDER BY name ASC').all());

    // --- Services ---
    ipcMain.handle('services:getAll', () => db.prepare('SELECT * FROM services ORDER BY name ASC').all());

    // --- Cities ---
    ipcMain.handle('cities:getAll', () => db.prepare('SELECT * FROM cities ORDER BY name ASC').all());

    // generic insert helper for other tables to save code space
    ipcMain.handle('db:insert', (_, { table, data }) => {
        const id = randomUUID();
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?');
        const cols = ['id', ...keys].join(',');
        const vals = [id, ...values];
        const phs = ['?', ...placeholders].join(',');
        try {
            db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${phs})`).run(...vals);
            return { data: { ...data, id }, error: null };
        } catch (err: any) { return { data: null, error: err.message }; }
    });

    // generic update helper
    ipcMain.handle('db:update', (_, { table, id, data }) => {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map(k => `${k} = ?`).join(',');
        const vals = [...values, id];
        try {
            db.prepare(`UPDATE ${table} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...vals);
            return { data: { ...data, id }, error: null };
        } catch (err: any) { return { data: null, error: err.message }; }
    });

    // generic delete helper
    ipcMain.handle('db:delete', (_, { table, id }) => {
        try {
            db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
            return { data: true, error: null };
        } catch (err: any) { return { data: null, error: err.message }; }
    });

    // generic SQL query
    ipcMain.handle('db:query', (_, { sql, params = [] }) => {
        try {
            return db.prepare(sql).all(...params);
        } catch (err: any) { console.error(err); throw err; }
    });

    // --- Specific Queries if needed ---
    ipcMain.handle('dashboard:stats', () => {
        const totalPatients = db.prepare('SELECT COUNT(*) as count FROM patients').get() as any;
        const totalAppointments = db.prepare('SELECT COUNT(*) as count FROM appointments').get() as any;
        const todayAppointments = db.prepare('SELECT COUNT(*) as count FROM appointments WHERE date = CURRENT_DATE').get() as any;
        return {
            totalPatients: totalPatients.count,
            totalAppointments: totalAppointments.count,
            todayAppointments: todayAppointments.count
        };
    });

    ipcMain.handle('treatment_cases:recalculate', () => {
        try {
            const cases = db.prepare('SELECT id, total_cost FROM treatment_cases').all() as any[];
            let updatedCount = 0;
            const transaction = db.transaction((allCases) => {
                for (const c of allCases) {
                    const sumResult = db.prepare('SELECT SUM(paid_amount) as total FROM invoices WHERE treatment_case_id = ?').get(c.id) as any;
                    const grandTotalPaid = sumResult?.total || 0;
                    const balance = (c.total_cost || 0) - grandTotalPaid;

                    // Allow small float margin
                    const status = balance <= 1.0 ? 'closed' : 'active';

                    db.prepare(`
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
    ipcMain.handle('reports:daily', (_, { date }) => {
        try {
            // 1. Total Revenue (Sum of paid_amount in invoices created ON that date)
            // Note: Invoices have created_at as DATETIME. 
            // We use date(created_at) = date to filter.
            const revenueResult = db.prepare(`
                SELECT SUM(paid_amount) as total 
                FROM invoices 
                WHERE date(created_at) = ?
            `).get(date) as any;

            // 2. Patient Count (Distinct patients who had appointments today)
            const patientsResult = db.prepare(`
                SELECT COUNT(DISTINCT patient_id) as count 
                FROM appointments 
                WHERE date = ?
            `).get(date) as any;

            // 3. Completed Appointments (Status = 'attended' or 'completed')
            const completedResult = db.prepare(`
                SELECT COUNT(*) as count 
                FROM appointments 
                WHERE date = ? AND (status = 'attended' OR status = 'completed')
            `).get(date) as any;

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

    // --- Complex Actions ---
    ipcMain.handle('appointments:markAttended', (_, payload) => {
        console.log('IPC: appointments:markAttended received:', payload);
        const {
            appointmentId,
            treatmentCaseId,
            serviceName,
            cost,
            amountPaid,
            doctorId,
            newCaseName
        } = payload;

        try {
            const result = db.transaction(() => {
                // 1. Get Appointment
                const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId) as any;
                if (!appointment) throw new Error('Appointment not found');

                // 2. Check Invoice
                const existingInvoice = db.prepare('SELECT * FROM invoices WHERE appointment_id = ?').get(appointmentId);
                if (existingInvoice) throw new Error('Invoice already exists for this appointment');

                // 3. Handle Treatment Case
                let resolvedTCaseId = treatmentCaseId;

                if (treatmentCaseId === 'new') {
                    resolvedTCaseId = randomUUID();
                    const patient = db.prepare('SELECT full_name FROM patients WHERE id = ?').get(appointment.patient_id) as any;
                    const pName = patient ? patient.full_name : 'Unknown';
                    const bal = cost - amountPaid;

                    // Get next display_id
                    const maxCaseId = (db.prepare('SELECT MAX(display_id) as max FROM treatment_cases').get() as any)?.max || 0;
                    const caseDisplayId = maxCaseId + 1;

                    db.prepare(`
                        INSERT INTO treatment_cases (id, display_id, patient_id, patient_name, name, total_cost, total_paid, balance, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(resolvedTCaseId, caseDisplayId, appointment.patient_id, pName, newCaseName || serviceName, cost, amountPaid, bal, 'active');
                } else {
                    const tCase = db.prepare('SELECT * FROM treatment_cases WHERE id = ?').get(treatmentCaseId) as any;
                    if (!tCase) throw new Error('Treatment case not found');
                    // We don't update here anymore, we update AFTER invoice insertion using the sum query
                }

                const tCaseId = resolvedTCaseId;

                // 4. Create Invoice
                const invId = randomUUID();
                const isExisting = treatmentCaseId !== 'new';
                // If it's an existing case, the cost of THIS session is usually 0 in terms of adding to the total plan cost,
                // because the plan cost was fixed. But we are paying off the plan. 
                // However, the invoice needs to record what was paid.
                // Standard logic: Invoice Amount = Paid Amount (for installments) OR standard service price?
                // For this use case (Installments): Invoice Amount = Paid Amount (so it looks fully paid)
                // OR Invoice Amount = Cost Remaining? 
                // Let's stick to: Amount = what user entered as Cost (if new) or Paid (if existing)?
                // Actually, for existing plans, usually we just record a "Payment". 
                // But the user interface sends "cost" as 0 for existing.

                const invCost = isExisting ? amountPaid : cost;
                // If existing, we say invoice amount is exactly what they paid, so it's a "Receipt". 
                // If new, it's the full service cost (Cost), and they paid (AmountPaid), causing debt.

                const invBal = isExisting ? 0 : (cost - amountPaid);
                const invStatus = invBal > 0 ? 'pending' : 'paid';

                // Get next display_id
                const maxInvId = (db.prepare('SELECT MAX(display_id) as max FROM invoices').get() as any)?.max || 0;
                const invDisplayId = maxInvId + 1;

                db.prepare(`
                    INSERT INTO invoices (id, display_id, appointment_id, patient_id, doctor_id, service_id, treatment_case_id, amount, paid_amount, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(invId, invDisplayId, appointmentId, appointment.patient_id, doctorId, appointment.service_id, tCaseId, invCost, amountPaid, invStatus);

                // 5. Update Treatment Case (Re-calculation Logic)
                // We recalculate strictly from invoices to ensure synchronization
                const sumResult = db.prepare('SELECT SUM(paid_amount) as total FROM invoices WHERE treatment_case_id = ?').get(tCaseId) as any;
                const grandTotalPaid = sumResult?.total || 0;

                // Get the case again to be sure of total_cost (if we just inserted it, we could use vars, but safety first)
                const currentCase = db.prepare('SELECT total_cost FROM treatment_cases WHERE id = ?').get(tCaseId) as any;
                const caseTotalCost = currentCase?.total_cost || 0;

                const caseBalance = caseTotalCost - grandTotalPaid;
                const caseStatus = caseBalance <= 0 ? 'closed' : 'active';

                db.prepare(`
                    UPDATE treatment_cases 
                    SET total_paid = ?, balance = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(grandTotalPaid, caseBalance, caseStatus, tCaseId);

                // 6. Update Appointment
                db.prepare(`
                    UPDATE appointments 
                    SET status = 'attended', treatment_case_id = ?, invoice_id = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(tCaseId, invId, appointmentId);

                console.log('IPC: markAttended success, returning object');
                return { success: true, invoiceId: invId, treatmentCaseId: tCaseId };
            })();

            return result;
        } catch (err: any) {
            console.error('IPC Error in markAttended:', err);
            return { success: false, error: err.message };
        }
    });

    // --- Detailed Reports ---
    ipcMain.handle('reports:doctors', (_, { from, to, doctorId }) => {
        try {
            // Build Invoices Query
            let invQuery = 'SELECT * FROM invoices WHERE date(created_at) BETWEEN ? AND ?';
            const invParams: any[] = [from, to];

            if (doctorId && doctorId !== 'all') {
                invQuery += ' AND doctor_id = ?';
                invParams.push(doctorId);
            }

            const invoices = db.prepare(invQuery).all(...invParams);

            // Build Appointments Query (Attended only)
            // Note: Appointment doesn't have doctor_id directly usually, it has invoice_id -> invoice -> doctor_id?
            // Or does appointment have doctor_id? Let's check schema usage in markAttended.
            // In markAttended, we inserted doctorId into INVOICES.
            // Appointments table structure (step 51): id, patient_id, date, time, status, notes, service_id, treatment_case_id, invoice_id...
            // It does NOT seem to have doctor_id explicitly in provided snippets, but let's check.
            // Actually, in `createAppointment`, we commented `// doctor_id?`.
            // So we should filter appointments by filtering the linked INVOICES or just return all attended appointments in timeframe
            // and let frontend map them?
            // BETTER: Join with invoices?
            // Or just return all attended in range, and frontend already does filtering.
            // If the user selects "All Doctors", we want all attended appointments.
            // If specific doctor, we want appointments linked to invoices of that doctor.

            let aptQuery = `
                SELECT a.* 
                FROM appointments a
                LEFT JOIN invoices i ON a.invoice_id = i.id
                WHERE a.status = 'attended' AND a.date BETWEEN ? AND ?
            `;
            const aptParams: any[] = [from, to];

            if (doctorId && doctorId !== 'all') {
                aptQuery += ' AND i.doctor_id = ?';
                aptParams.push(doctorId);
            }

            const appointments = db.prepare(aptQuery).all(...aptParams);

            return { invoices, appointments };

        } catch (err: any) {
            console.error('Report Error:', err);
            return { invoices: [], appointments: [], error: err.message };
        }
    });

    // --- Invoices ---
    ipcMain.handle('invoices:delete', (_, { id }) => {
        try {
            const result = db.transaction(() => {
                // 1. Get Invoice Details
                const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
                if (!invoice) return { success: true }; // Already gone

                const tCaseId = invoice.treatment_case_id;

                // 2. Cascade Delete Appointment (if linked)
                db.prepare('DELETE FROM appointments WHERE invoice_id = ?').run(id);

                // 3. Delete Invoice
                db.prepare('DELETE FROM invoices WHERE id = ?').run(id);

                // 3. Sync Treatment Case (if exists)
                if (tCaseId) {
                    const sumResult = db.prepare('SELECT SUM(paid_amount) as total FROM invoices WHERE treatment_case_id = ?').get(tCaseId) as any;
                    const grandTotalPaid = sumResult?.total || 0;

                    const currentCase = db.prepare('SELECT total_cost FROM treatment_cases WHERE id = ?').get(tCaseId) as any;

                    if (currentCase) {
                        const caseTotalCost = currentCase.total_cost || 0;
                        const caseBalance = caseTotalCost - grandTotalPaid;
                        // Re-evaluate status: if balance > small margin, it's active again
                        const caseStatus = caseBalance <= 1.0 ? 'closed' : 'active';

                        db.prepare(`
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
    ipcMain.handle('treatment_cases:create', (_, data) => {
        const id = randomUUID();
        try {
            // Get next display_id
            const maxId = (db.prepare('SELECT MAX(display_id) as max FROM treatment_cases').get() as any)?.max || 0;
            const displayId = maxId + 1;

            db.prepare(`
                INSERT INTO treatment_cases (id, display_id, patient_id, patient_name, name, total_cost, total_paid, balance, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(
                id,
                displayId,
                data.patientId,
                data.patientName,
                data.name,
                data.totalCost,
                0, // Initial paid
                data.totalCost, // Initial balance = cost
                'active'
            );
            return { data: { ...data, id }, error: null };
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
            db.prepare('DELETE FROM treatment_cases WHERE id = ?').run(id);
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('treatment_cases:getActiveDetails', () => {
        try {
            return db.prepare(`
                SELECT 
                    tp.id, 
                    tp.name as plan_name, 
                    tp.total_cost, 
                    tp.total_paid, 
                    (tp.total_cost - tp.total_paid) as remaining,
                    p.full_name as patient_name
                FROM treatment_cases tp
                JOIN patients p ON tp.patient_id = p.id
                WHERE tp.status = 'active'
                ORDER BY remaining DESC
            `).all();
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
                filters: [{ name: 'Database Files', extensions: ['db', 'sqlite'] }],
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
                fs.copyFileSync(currentDbPath, tempBackup);
                console.log('Safety backup created at:', tempBackup);
            }

            // 3. Overwrite DB
            try {
                fs.copyFileSync(sourcePath, currentDbPath);
            } catch (e: any) {
                return { success: false, error: `Could not overwrite database: ${e.message}. Application might need restart first.` };
            }

            // 4. Restart App
            app.relaunch();
            app.exit();

            return { success: true };
        } catch (error: any) {
            console.error('Restore Error:', error);
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
            let maxId = (db.prepare('SELECT MAX(display_id) as max FROM patients').get() as any)?.max || 0;

            const insertStmt = db.prepare(`
                INSERT INTO patients (id, display_id, full_name, phone, gender, age, notes, city_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             `);

            // We need to resolve city name to city_id if mapped
            const cityMap = new Map(); // name -> id
            db.prepare('SELECT id, name FROM cities').all().forEach((c: any) => cityMap.set(c.name, c.id));

            // Helper for Gender
            const genderMap: any = {
                'ذكر': 'male', 'أنثى': 'female', 'انثى': 'female', 'male': 'male', 'female': 'female', 'm': 'male', 'f': 'female'
            };

            const transaction = db.transaction((rows) => {
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
                    const existing = db.prepare('SELECT id FROM patients WHERE phone = ?').get(phone);
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
                                db.prepare('INSERT INTO cities (id, name) VALUES (?, ?)').run(newCityId, rawCity);
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
}
