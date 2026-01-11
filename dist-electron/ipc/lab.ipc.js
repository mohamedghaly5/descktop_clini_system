import { ipcMain } from 'electron';
import { getDb, isSystemReadOnly } from '../db/init.js';
import { getCurrentClinicId } from '../db/getCurrentClinicId.js';
import { randomUUID } from 'crypto';
import { licenseService } from '../license/license.service.js';
const checkReadOnly = () => {
    if (isSystemReadOnly()) {
        throw new Error('SYSTEM_READ_ONLY: The system is currently in read-only mode for maintenance.');
    }
    if (!licenseService.isWriteAllowed()) {
        throw new Error('LICENSE_EXPIRED: Your subscription has expired. The system is in read-only mode.');
    }
};
export function registerLabHandlers() {
    // --- Lab Orders ---
    ipcMain.handle('lab:get-orders', () => {
        try {
            const clinicId = getCurrentClinicId();
            // Fetch from the view, filtering by clinic (if applicable) or all if single tenant
            // Note: The view already includes clinic_id
            return getDb().prepare(`
                SELECT * FROM lab_orders_overview 
                WHERE (clinic_id = ? OR clinic_id = 'clinic_001' OR clinic_id IS NULL)
                ORDER BY created_at DESC
            `).all(clinicId);
        }
        catch (e) {
            console.error('[lab:get-orders] Error:', e);
            return [];
        }
    });
    ipcMain.handle('lab:get-labs', () => {
        try {
            const clinicId = getCurrentClinicId();
            return getDb().prepare(`
                SELECT * FROM labs
                WHERE (clinic_id = ? OR clinic_id = 'clinic_001' OR clinic_id IS NULL)
                ORDER BY is_default DESC, name ASC
            `).all(clinicId);
        }
        catch (e) {
            console.error('[lab:get-labs] Error:', e);
            return [];
        }
    });
    ipcMain.handle('lab:create-lab', (_, { name, is_default }) => {
        checkReadOnly();
        const clinicId = getCurrentClinicId();
        const id = randomUUID();
        try {
            getDb().transaction(() => {
                // If setting as default, unset others first
                if (is_default) {
                    getDb().prepare(`
                        UPDATE labs SET is_default = 0 
                        WHERE (clinic_id = ? OR clinic_id = 'clinic_001' OR clinic_id IS NULL)
                    `).run(clinicId);
                }
                getDb().prepare(`
                    INSERT INTO labs (id, name, is_default, clinic_id)
                    VALUES (?, ?, ?, ?)
                `).run(id, name, is_default ? 1 : 0, clinicId);
            })();
            return { success: true, id };
        }
        catch (e) {
            console.error('[lab:create-lab] Error:', e);
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('lab:delete-lab', (_, labId) => {
        checkReadOnly();
        const clinicId = getCurrentClinicId();
        try {
            // 1. Check if default
            const lab = getDb().prepare(`SELECT is_default FROM labs WHERE id = ?`).get(labId);
            if (!lab)
                return { success: false, error: 'Lab not found' };
            if (lab.is_default)
                return { success: false, error: 'Cannot delete the default lab. Please set another lab as default first.' };
            // 2. Check for linked services
            const serviceCount = getDb().prepare(`SELECT count(*) as count FROM lab_services WHERE lab_id = ?`).get(labId);
            if (serviceCount.count > 0)
                return { success: false, error: 'Cannot delete lab because it has linked services. Delete or reassign services first.' };
            // 3. Check for linked orders
            const orderCount = getDb().prepare(`SELECT count(*) as count FROM lab_orders WHERE lab_id = ?`).get(labId);
            if (orderCount.count > 0)
                return { success: false, error: 'Cannot delete lab because it has existing orders.' };
            // 4. Safe to delete
            getDb().prepare(`DELETE FROM labs WHERE id = ? AND (clinic_id = ? OR clinic_id IS NULL)`).run(labId, clinicId);
            return { success: true };
        }
        catch (e) {
            console.error('[lab:delete-lab] Error:', e);
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('lab:get-services', (_, labId) => {
        try {
            const clinicId = getCurrentClinicId();
            let query = `
                SELECT * FROM lab_services 
                WHERE (clinic_id = ? OR clinic_id = 'clinic_001' OR clinic_id IS NULL) 
                AND is_active = 1
            `;
            if (labId) {
                query += ` AND lab_id = '${labId}'`;
            }
            query += ` ORDER BY name ASC`;
            return getDb().prepare(query).all(clinicId);
        }
        catch (e) {
            console.error('[lab:get-services] Error:', e);
            return [];
        }
    });
    ipcMain.handle('lab:get-all-services', () => {
        try {
            const clinicId = getCurrentClinicId();
            return getDb().prepare(`
                SELECT * FROM lab_services 
                WHERE (clinic_id = ? OR clinic_id = 'clinic_001' OR clinic_id IS NULL)
                ORDER BY name ASC
            `).all(clinicId);
        }
        catch (e) {
            console.error('[lab:get-all-services] Error:', e);
            return [];
        }
    });
    ipcMain.handle('lab:create-service', (_, { name, default_cost, is_active, lab_id }) => {
        checkReadOnly();
        const clinicId = getCurrentClinicId();
        const id = randomUUID();
        try {
            getDb().prepare(`
                INSERT INTO lab_services (id, name, default_cost, is_active, clinic_id, lab_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(id, name, default_cost, is_active ? 1 : 0, clinicId, lab_id);
            return { success: true, id };
        }
        catch (e) {
            console.error('[lab:create-service] Error:', e);
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('lab:update-service', (_, { id, name, default_cost, is_active }) => {
        checkReadOnly();
        try {
            getDb().prepare(`
                UPDATE lab_services
                SET name = ?, default_cost = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(name, default_cost, is_active ? 1 : 0, id);
            return { success: true };
        }
        catch (e) {
            console.error('[lab:update-service] Error:', e);
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('lab:create-order', (_, data) => {
        checkReadOnly();
        const { patient_id, doctor_id, lab_service_id, sent_date, expected_receive_date, total_lab_cost, notes, lab_id } = data;
        const clinicId = getCurrentClinicId();
        const id = randomUUID();
        try {
            getDb().prepare(`
                INSERT INTO lab_orders (
                    id, patient_id, doctor_id, lab_service_id, clinic_id, 
                    sent_date, expected_receive_date, total_lab_cost, notes, 
                    order_status, created_at, lab_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', CURRENT_TIMESTAMP, ?)
            `).run(id, patient_id, doctor_id, lab_service_id, clinicId, sent_date, expected_receive_date, total_lab_cost || 0, notes || '', lab_id);
            return { success: true, id };
        }
        catch (e) {
            console.error('[lab:create-order] Error:', e);
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('lab:receive-order', (_, { orderId, receivedDate, paidAmount }) => {
        checkReadOnly();
        const clinicId = getCurrentClinicId();
        try {
            getDb().transaction(() => {
                // 1. Update Order Status
                getDb().prepare(`
                    UPDATE lab_orders 
                    SET order_status = 'received', received_date = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND (clinic_id = ? OR clinic_id IS NULL)
                `).run(receivedDate, orderId, clinicId);
                // 2. Handle Payment if amount > 0
                if (paidAmount > 0) {
                    const expenseId = randomUUID();
                    const paymentId = randomUUID();
                    const dateStr = new Date().toISOString().split('T')[0];
                    // Fetch details for description
                    const orderDetails = getDb().prepare(`
                        SELECT p.full_name as patient_name, ls.name as service_name
                        FROM lab_orders lo
                        LEFT JOIN patients p ON lo.patient_id = p.id
                        LEFT JOIN lab_services ls ON lo.lab_service_id = ls.id
                        WHERE lo.id = ?
                    `).get(orderId);
                    const description = `${orderDetails?.service_name || 'Service'} - ${orderDetails?.patient_name || 'Patient'}`;
                    // Create Expense
                    getDb().prepare(`
                        INSERT INTO expenses (id, amount, date, category, description)
                        VALUES (?, ?, ?, 'Lab', ?)
                     `).run(expenseId, paidAmount, dateStr, description);
                    // Create Lab Payment
                    getDb().prepare(`
                        INSERT INTO lab_payments (id, lab_order_id, paid_amount, payment_date, expense_id, clinic_id)
                        VALUES (?, ?, ?, ?, ?, ?)
                     `).run(paymentId, orderId, paidAmount, dateStr, expenseId, clinicId);
                }
            })();
            return { success: true };
        }
        catch (e) {
            console.error('[lab:receive-order] Error:', e);
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('lab:delete-order', (_, { orderId, deleteExpenses }) => {
        checkReadOnly();
        const clinicId = getCurrentClinicId();
        try {
            getDb().transaction(() => {
                // If requested, delete linked expenses first
                if (deleteExpenses) {
                    const payments = getDb().prepare(`
                        SELECT expense_id FROM lab_payments 
                        WHERE lab_order_id = ? AND expense_id IS NOT NULL
                    `).all(orderId);
                    const expenseIds = payments.map(p => p.expense_id);
                    if (expenseIds.length > 0) {
                        const placeholders = expenseIds.map(() => '?').join(',');
                        getDb().prepare(`
                            DELETE FROM expenses 
                            WHERE id IN (${placeholders})
                        `).run(...expenseIds);
                    }
                }
                // Delete the order (lab_payments will cascade delete due to schema)
                getDb().prepare(`
                    DELETE FROM lab_orders 
                    WHERE id = ? AND (clinic_id = ? OR clinic_id IS NULL)
                `).run(orderId, clinicId);
            })();
            return { success: true };
        }
        catch (e) {
            console.error('[lab:delete-order] Error:', e);
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('lab:create-general-payment', (_, { labId, amount, notes, paymentDate }) => {
        checkReadOnly();
        const clinicId = getCurrentClinicId();
        const id = randomUUID();
        const expenseId = randomUUID();
        // Fetch lab name for description
        const lab = getDb().prepare('SELECT name FROM labs WHERE id = ?').get(labId);
        const labName = lab?.name || 'Unknown Lab';
        const description = `Lab Payment - ${labName} ${notes ? `(${notes})` : ''}`;
        try {
            getDb().transaction(() => {
                // 1. Create Expense
                getDb().prepare(`
                    INSERT INTO expenses (id, amount, date, category, description)
                    VALUES (?, ?, ?, 'Lab', ?)
                `).run(expenseId, amount, paymentDate, description);
                // 2. Create Lab General Payment (Log)
                getDb().prepare(`
                    INSERT INTO lab_general_payments (id, lab_id, amount, expense_id, notes, payment_date, clinic_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(id, labId, amount, expenseId, notes, paymentDate, clinicId);
                // 3. AUTO-DISTRIBUTE to Oldest Unpaid Orders
                let remainingToDistribute = amount;
                // Fetch orders with remaining balance > 0, ordered by date (Oldest first)
                // We calculate balance on the fly to capture current state
                const unpaidOrders = getDb().prepare(`
                    SELECT lo.id, lo.total_lab_cost, COALESCE(SUM(lp.paid_amount), 0) as paid
                    FROM lab_orders lo
                    LEFT JOIN lab_payments lp ON lo.id = lp.lab_order_id
                    WHERE lo.lab_id = ? AND (lo.clinic_id = ? OR lo.clinic_id = 'clinic_001' OR lo.clinic_id IS NULL)
                    GROUP BY lo.id
                    HAVING (lo.total_lab_cost - paid) > 0.1
                    ORDER BY lo.created_at ASC
                `).all(labId, clinicId);
                for (const order of unpaidOrders) {
                    if (remainingToDistribute <= 0)
                        break;
                    const balance = order.total_lab_cost - order.paid;
                    const paymentForThisOrder = Math.min(balance, remainingToDistribute);
                    if (paymentForThisOrder > 0) {
                        // Insert payment record for this specific order
                        getDb().prepare(`
                            INSERT INTO lab_payments (id, lab_order_id, paid_amount, payment_date, expense_id, clinic_id)
                            VALUES (?, ?, ?, ?, ?, ?)
                        `).run(randomUUID(), order.id, paymentForThisOrder, paymentDate, expenseId, clinicId);
                        remainingToDistribute -= paymentForThisOrder;
                    }
                }
                // If remainingToDistribute > 0, it stays as unallocated credit in the system
                // (represented by the fact that lab_general_payments sum > sum of lab_payments linked to expenses)
            })();
            return { success: true, id };
        }
        catch (e) {
            console.error('[lab:create-general-payment] Error:', e);
            return { success: false, error: e.message };
        }
    });
}
