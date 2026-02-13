import axios from 'axios';

// Helper for Client Mode & Web Support
const getAppInfo = async () => {
    // 1. Check if running in Electron
    // @ts-ignore
    if (window.electron && window.electron.ipcRenderer) {
        // @ts-ignore
        return await window.electron.ipcRenderer.invoke('app:get-info');
    }

    // 2. Running in Browser / Mobile App
    let serverUrl = localStorage.getItem('server_url') || '';
    if (!serverUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
        serverUrl = window.location.origin;
    }

    return {
        isClientMode: true,
        serverUrl
    };
};

const fetchRemote = async (endpoint: string) => {
    const info = await getAppInfo();
    const token = localStorage.getItem('session_token') || sessionStorage.getItem('session_token');

    if (info.isClientMode) {
        if (!info.serverUrl) {
            console.warn('[DB] Server URL not set. Redirecting to setup...');
            // In a real app, we might trigger a global event or redirect to /settings/connection
            return null;
        }

        try {
            const res = await axios.get(`${info.serverUrl}/api/${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data;
        } catch (e: any) {
            console.error(`[DB] Fetch ${endpoint} failed:`, e);
            throw e;
        }
    }
    return null;
};

const sendRemote = async (method: 'post' | 'put' | 'delete', endpoint: string, data?: any) => {
    const info = await getAppInfo();
    const token = localStorage.getItem('session_token') || sessionStorage.getItem('session_token');
    console.log(`[sendRemote] ${method.toUpperCase()} ${endpoint}`, { isClientMode: info.isClientMode, serverUrl: info.serverUrl, data });
    if (info.isClientMode && info.serverUrl) {
        const url = `${info.serverUrl}/api/${endpoint}`;
        const headers = { Authorization: `Bearer ${token}` };
        let res;
        try {
            if (method === 'post') res = await axios.post(url, data, { headers });
            else if (method === 'put') res = await axios.put(url, data, { headers });
            else if (method === 'delete') res = await axios.delete(url, { headers, data }); // Send data with DELETE
            console.log(`[sendRemote] Response:`, res?.data);
            return res?.data;
        } catch (e: any) {
            console.error(`[sendRemote] Error:`, e.response?.data || e.message);
            // Translate License Error for Client
            if (e.response?.data?.error?.includes('LICENSE_EXPIRED')) {
                throw new Error('عفواً، انتهت صلاحية الاشتراك. النظام حالياً في وضع القراءة فقط، يرجى تجديد الاشتراك للاستمرار في الإضافة والتعديل.');
            }
            throw e;
        }
    }
    return null;
};

// Type definitions for global electron
declare global {
    interface Window {
        api: {
            getPatients: (email?: string | null) => Promise<any>;
            getPatientById: (id: string) => Promise<any>;
            createPatient: (data: any) => Promise<any>;
            importPatients: (buffer: ArrayBuffer, email?: string | null) => Promise<any>;
            recalculateTreatmentCases: () => Promise<any>;
            getDailyReport: (date: string, email?: string | null) => Promise<{ totalRevenue: number; patientCount: number; completedAppointments: number; }>;
            exportFinancials: () => Promise<{ success: boolean; filePath?: string; error?: string; reason?: string }>;
            getCities: (email?: string | null) => Promise<any>;
            addCity: (data: any) => Promise<any>;
            updateCity: (id: string, data: any) => Promise<any>;
            deleteCity: (id: string) => Promise<any>;
            getDoctors: (email?: string | null) => Promise<any>;
            addDoctor: (data: any) => Promise<any>;
            updateDoctor: (id: string, data: any) => Promise<any>;
            deleteDoctor: (id: string) => Promise<any>;
            getServices: (email?: string | null) => Promise<any>;
            addService: (data: any) => Promise<any>;
            updateService: (id: string, data: any) => Promise<any>;
            deleteService: (id: string) => Promise<any>;
            dbInsert: (table: string, data: any) => Promise<any>;
            dbUpdate: (table: string, id: string, data: any) => Promise<any>;
            dbDelete: (table: string, id: string) => Promise<any>;
            dbQuery: (sql: string, params?: any[]) => Promise<any>;
            createExpense: (data: any) => Promise<any>;
            updateExpense: (id: string, data: any) => Promise<any>;
            deleteExpense: (id: string) => Promise<any>;
        }
    }
}

export const db = {
    patients: {
        getAll: async (email?: string | null) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote('patients') || [];
            return window.api.getPatients(email);
        },
        getById: async (id: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) {
                // Use dedicated endpoint that returns patient even if soft-deleted
                return await fetchRemote(`patients/${id}`);
            }
            return window.api.getPatientById(id);
        },
        create: async (data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) {
                try {
                    const res = await sendRemote('post', 'patients', data);
                    console.log('[Diagnostic] Remote Create Response:', res);
                    // Server returns: { success: true, id: "..." }
                    // Local expected: { data: { id: "...", ...data }, error: null }
                    if (res && res.success) {
                        return { data: { ...data, id: res.id }, error: null };
                    }
                    return { data: null, error: res?.error || 'Remote Creation Failed' };
                } catch (e: any) {
                    console.error('[Diagnostic] Remote Create Error:', e);
                    return { data: null, error: e.message || 'Network Error' };
                }
            }
            return window.api.createPatient(data);
        },
        update: async (id: string, data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('put', `patients/${id}`, data);
            return window.api.dbUpdate('patients', id, data);
        },
        delete: async (id: string, options?: { deleteAppointments?: boolean; deleteTreatmentCases?: boolean; deleteInvoices?: boolean }) => {
            const info = await getAppInfo();
            console.log('[db.patients.delete] isClientMode:', info.isClientMode, 'serverUrl:', info.serverUrl, 'id:', id, 'options:', options);
            if (info.isClientMode) {
                const result = await sendRemote('delete', `patients/${id}`, options);
                console.log('[db.patients.delete] Remote delete result:', result);
                return result;
            }
            return window.electron.ipcRenderer.invoke('patients:delete', { id, ...options });
        },
        getStatsForDelete: async (id: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) {
                const res = await fetchRemote(`patients/${id}/stats`);
                return res || { appointmentsCount: 0, invoicesCount: 0, treatmentCasesCount: 0 };
            }
            return window.electron.ipcRenderer.invoke('patients:getStatsForDelete', { id });
        },
    },
    appointments: {
        getAll: async (email?: string | null) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote('appointments') || [];
            return window.electron.ipcRenderer.invoke('appointments:getAll', { email });
        },
        create: async (data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('post', 'appointments', data);
            return window.electron.ipcRenderer.invoke('appointments:create', data);
        },
        update: async (id: string, data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('put', `appointments/${id}`, data);
            return window.api.dbUpdate('appointments', id, data);
        },
        delete: async (id: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('delete', `appointments/${id}`);
            return window.api.dbDelete('appointments', id);
        },
        markAttended: async (payload: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('post', 'appointments/mark-attended', payload);
            return window.electron.ipcRenderer.invoke('appointments:markAttended', payload);
        }
    },
    treatmentCases: {
        getAll: async (email?: string | null) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote('treatment-cases') || [];
            return window.electron.ipcRenderer.invoke('treatment_cases:getAll', { email });
        },
        getByPatient: async (patientId: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote(`treatment-cases/by-patient/${patientId}`) || [];
            return window.electron.ipcRenderer.invoke('treatment_cases:getByPatient', { patientId });
        },
        create: async (data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('post', 'treatment-cases', data);
            return window.electron.ipcRenderer.invoke('treatment_cases:create', data);
        },
        update: async (id: string, data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('put', `treatment-cases/${id}`, data);
            return window.electron.ipcRenderer.invoke('db:update', { table: 'treatment_cases', id, data });
        },
        delete: async (id: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('delete', `treatment-cases/${id}`);
            return window.electron.ipcRenderer.invoke('treatment_cases:delete', { id });
        }
    },
    invoices: {
        getAll: async (email?: string | null) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote('invoices') || [];
            return window.electron.ipcRenderer.invoke('invoices:getAll', { email });
        },
        create: async (data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('post', 'invoices', data);
            return window.electron.ipcRenderer.invoke('db:insert', { table: 'invoices', data });
        },
        delete: async (id: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('delete', `invoices/${id}`);
            return window.electron.ipcRenderer.invoke('invoices:delete', { id });
        }
    },
    doctors: {
        getAll: async (email?: string | null) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote('doctors') || [];
            return window.api.getDoctors(email);
        },
        create: async (data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('post', 'doctors', data);
            return window.api.addDoctor(data);
        },
        update: async (id: string, data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('put', `doctors/${id}`, data);
            return window.api.updateDoctor(id, data);
        },
        delete: async (id: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('delete', `doctors/${id}`);
            return window.api.deleteDoctor(id);
        },
    },
    services: {
        getAll: async (email?: string | null) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote('services') || [];
            return window.api.getServices(email);
        },
        create: async (data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('post', 'services', data);
            return window.api.addService(data);
        },
        update: async (id: string, data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('put', `services/${id}`, data);
            return window.api.updateService(id, data);
        },
        delete: async (id: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('delete', `services/${id}`);
            return window.api.deleteService(id);
        },
    },
    cities: {
        getAll: async (email?: string | null) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote('cities') || [];
            return window.api.getCities(email);
        },
        create: async (data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('post', 'cities', data);
            return window.api.addCity(data);
        },
        update: async (id: string, data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('put', `cities/${id}`, data);
            return window.api.updateCity(id, data);
        },
        delete: async (id: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('delete', `cities/${id}`);
            return window.api.deleteCity(id);
        },
    },
    expenses: {
        getAll: async () => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote('expenses') || [];
            return window.api.dbQuery('SELECT * FROM expenses ORDER BY date DESC');
        },
        create: async (data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('post', 'expenses', data);
            return window.api.createExpense ? window.api.createExpense(data) : window.electron.ipcRenderer.invoke('expenses:create', data);
        },
        update: async (id: string, data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('put', `expenses/${id}`, data);
            return window.api.updateExpense ? window.api.updateExpense(id, data) : window.electron.ipcRenderer.invoke('expenses:update', { id, ...data });
        },
        delete: async (id: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('delete', `expenses/${id}`);
            return window.api.deleteExpense ? window.api.deleteExpense(id) : window.electron.ipcRenderer.invoke('expenses:delete', id);
        }
    },
    stock: {
        getAll: async () => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote('stock/items') || [];
            return window.electron.ipcRenderer.invoke('stock:get-items');
        },
        createItem: async (data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('post', 'stock/items', data);
            return window.electron.ipcRenderer.invoke('stock:create-item', data);
        },
        getCategories: async () => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote('stock/categories') || [];
            return window.electron.ipcRenderer.invoke('stock:get-categories');
        },
        addCategory: async (name: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('post', 'stock/categories', { name });
            return window.electron.ipcRenderer.invoke('stock:create-category', { name });
        },
        deleteCategory: async (id: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('delete', `stock/categories/${id}`);
            return window.electron.ipcRenderer.invoke('stock:delete-category', { id });
        },
        getMovements: async (startDate: string, endDate: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote(`stock/movements?startDate=${startDate}&endDate=${endDate}`) || [];
            return window.electron.ipcRenderer.invoke('stock:get-movements', { startDate, endDate });
        }
    },
    reports: {
        getDaily: async (date: string, email?: string | null) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote(`reports/daily?date=${date}`) || { totalRevenue: 0, patientCount: 0, completedAppointments: 0 };
            return window.api.getDailyReport(date, email);
        }
    },
    settings: {
        getClinicInfo: async (email?: string | null) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote('settings/clinic-info');
            return window.electron.ipcRenderer.invoke('settings:getClinicInfo', { email });
        },
        updateClinicInfo: async (data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('post', 'settings/clinic-info', data);
            return window.electron.ipcRenderer.invoke('settings:updateClinicInfo', data);
        }
    },
    // Generic fallback
    // Generic fallback & Dashboard
    from: (table: string) => ({
        select: async () => {
            const info = await getAppInfo();
            if (info.isClientMode) {
                // Map common tables to endpoints
                if (table === 'patients') return { data: await fetchRemote('patients'), error: null };
                if (table === 'appointments') return { data: await fetchRemote('appointments'), error: null };
                if (table === 'invoices') return { data: await fetchRemote('invoices'), error: null };
                if (table === 'treatment_cases') return { data: await fetchRemote('treatment-cases'), error: null };
                // Generic fallback?
                return { data: [], error: 'Table not supported in remote mode' };
            }

            console.warn(`Generic select for ${table} via IPC not fully implemented, returning getAll if standard.`);
            if (table === 'patients') return { data: await window.electron.ipcRenderer.invoke('patients:getAll', {}), error: null };
            if (table === 'appointments') return { data: await window.electron.ipcRenderer.invoke('appointments:getAll'), error: null };
            return { data: [], error: null };
        },
        insert: async (data: any) => {
            const info = await getAppInfo();
            if (info.isClientMode) {
                const res = await sendRemote('post', table, data);
                return { data: res, error: null };
            }
            return window.electron.ipcRenderer.invoke('db:insert', { table, data });
        },
        update: async (data: any) => ({
            eq: async (col: string, val: any) => {
                const info = await getAppInfo();
                if (info.isClientMode) return { data: await sendRemote('put', `${table}/${val}`, data), error: null };
                return window.electron.ipcRenderer.invoke('db:update', { table, id: val, data });
            }
        }),
        delete: () => ({
            eq: async (col: string, val: any) => {
                const info = await getAppInfo();
                if (info.isClientMode) return { data: await sendRemote('delete', `${table}/${val}`), error: null };
                return window.electron.ipcRenderer.invoke('db:delete', { table, id: val });
            }
        })
    }),
    // Raw Query Support (Remote or Local)
    query: async (sql: string, params: any[] = []) => {
        const info = await getAppInfo();
        if (info.isClientMode) {
            // Basic support for common queries in Remote Mode
            // 1. Attachments by Patient
            if (sql.includes('FROM attachments') && params.length > 0) {
                return await fetchRemote(`attachments?patient_id=${params[0]}`) || [];
            }
            console.warn('[DB] Remote query not supported:', sql);
            return [];
        }
        return window.electron.ipcRenderer.invoke('db:query', { sql, params });
    },
    backup: {
        getConfig: async () => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote('backup/config');
            const schedule = await window.electron.ipcRenderer.invoke('settings:get-backup-schedule');
            const localPath = await window.electron.ipcRenderer.invoke('backup:get-local-path');
            const lastBackupDate = await window.electron.ipcRenderer.invoke('backup:get-last-date');
            return { schedule, localPath, lastBackupDate };
        },
        create: async (password?: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('post', 'backup/create', { password });
            return window.electron.ipcRenderer.invoke('backup:create', { password });
        },
        createCloud: async (password?: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await sendRemote('post', 'backup/cloud/create', { password });
            return window.electron.ipcRenderer.invoke('backup:cloud-now', { password });
        },
        getCloudUser: async () => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote('backup/cloud/user');
            return window.electron.ipcRenderer.invoke('backup:get-user');
        },
        listCloudFiles: async () => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote('backup/cloud/files');
            return window.electron.ipcRenderer.invoke('backup:list-cloud');
        },
        restoreLocal: async (password?: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) throw new Error("Client mode cannot restore backups locally.");
            return window.electron.ipcRenderer.invoke('backup:restore-local', { password });
        },
        setLocalPath: async () => {
            const info = await getAppInfo();
            if (info.isClientMode) throw new Error("Client mode cannot set server path.");
            return window.electron.ipcRenderer.invoke('backup:set-local-path');
        },
        setSchedule: async (val: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) throw new Error("Client mode cannot set server schedule.");
            return window.electron.ipcRenderer.invoke('settings:set-backup-schedule', val);
        },
        startAuth: async () => {
            const info = await getAppInfo();
            if (info.isClientMode) throw new Error("Client mode cannot authenticate Google Drive. Please do it on Server.");
            return window.electron.ipcRenderer.invoke('backup:start-auth');
        },
        restoreCloud: async (fileId: string, password?: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) throw new Error("Client mode cannot restore backups.");
            return window.electron.ipcRenderer.invoke('backup:restore', { fileId, password });
        },
        deleteCloud: async (fileId: string) => {
            const info = await getAppInfo();
            if (info.isClientMode) throw new Error("Client mode cannot delete backups."); // Or allow it? User said "only view"
            // Actually, user said "You can only make a backup command... he cannot restore...".
            // Deleting cloud backups might be unsafe from client. Let's disable it or allow only simple delete if needed.
            // User didn't explicitly forbid delete, but safe to disable.
            return window.electron.ipcRenderer.invoke('backup:delete-cloud', { fileId });
        }
    },
    license: {
        getStatus: async () => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote('license/status');
            return window.electron.ipcRenderer.invoke('license:get-status');
        }
    },
    dashboard: {
        stats: async (email?: string | null) => {
            const info = await getAppInfo();
            if (info.isClientMode) return await fetchRemote('dashboard/stats');
            return window.electron.ipcRenderer.invoke('dashboard:stats', { email });
        },
    }
};
