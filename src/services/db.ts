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
        }
    }
}

export const db = {
    patients: {
        getAll: (email?: string | null) => window.api.getPatients(email),
        create: (data: any) => window.api.createPatient(data),
        // Use generic for others
        update: (id: string, data: any) => window.api.dbUpdate('patients', id, data),
        delete: (id: string) => window.api.dbDelete('patients', id),
    },
    appointments: {
        getAll: (email?: string | null) => window.electron.ipcRenderer.invoke('appointments:getAll', { email }),
        create: (data: any) => window.electron.ipcRenderer.invoke('appointments:create', data),
        update: (id: string, data: any) => window.api.dbUpdate('appointments', id, data),
        delete: (id: string) => window.api.dbDelete('appointments', id),
    },
    doctors: {
        getAll: (email?: string | null) => window.api.getDoctors(email),
        create: (data: any) => window.api.addDoctor(data),
        update: (id: string, data: any) => window.api.updateDoctor(id, data),
        delete: (id: string) => window.api.deleteDoctor(id),
    },
    services: {
        getAll: (email?: string | null) => window.api.getServices(email),
        create: (data: any) => window.api.addService(data),
        update: (id: string, data: any) => window.api.updateService(id, data),
        delete: (id: string) => window.api.deleteService(id),
    },
    cities: {
        getAll: (email?: string | null) => window.api.getCities(email),
        create: (data: any) => window.api.addCity(data),
        update: (id: string, data: any) => window.api.updateCity(id, data),
        delete: (id: string) => window.api.deleteCity(id),
    },
    // Generic fallback
    from: (table: string) => ({
        select: async () => {
            console.warn(`Generic select for ${table} via IPC not fully implemented, returning getAll if standard.`);
            if (table === 'patients') return { data: await window.electron.ipcRenderer.invoke('patients:getAll', {}), error: null };
            if (table === 'appointments') return { data: await window.electron.ipcRenderer.invoke('appointments:getAll'), error: null };
            return { data: [], error: null };
        },
        insert: async (data: any) => window.electron.ipcRenderer.invoke('db:insert', { table, data }),
        update: async (data: any) => ({
            eq: async (col: string, val: any) => window.electron.ipcRenderer.invoke('db:update', { table, id: val, data })
        }),
        delete: () => ({
            eq: async (col: string, val: any) => window.electron.ipcRenderer.invoke('db:delete', { table, id: val })
        })
    }),
    dashboard: {
        stats: (email?: string | null) => window.electron.ipcRenderer.invoke('dashboard:stats', { email }),
    }
};
