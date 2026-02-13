import { contextBridge, ipcRenderer } from 'electron';

// Fix: Expose ipcRenderer nested inside 'electron' object to match frontend calls
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
        send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
        on: (channel: string, func: (...args: any[]) => void) => {
            const subscription = (_event: any, ...args: any[]) => func(...args);
            ipcRenderer.on(channel, subscription);
            return () => ipcRenderer.removeListener(channel, subscription);
        },
    },
    backup: {
        restoreLocal: () => ipcRenderer.invoke('backup:restore-local')
    }
});

// Expose Safe Env Vars to Renderer
contextBridge.exposeInMainWorld('env', {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY
});

contextBridge.exposeInMainWorld('api', {
    // System
    getSystemStatus: () => ipcRenderer.invoke('system:get-status'),

    // License
    getLicenseStatus: () => ipcRenderer.invoke('license:get-status'),
    activateLicense: (key: string) => ipcRenderer.invoke('license:activate', { key }),

    // Patients
    getPatients: (email?: string | null) => ipcRenderer.invoke('patients:getAll', { email }),
    getPatientById: (id: string) => ipcRenderer.invoke('patients:getById', id),
    createPatient: (data: any) => ipcRenderer.invoke('patients:create', data),
    importPatients: (buffer: ArrayBuffer, email?: string | null) => ipcRenderer.invoke('patients:import', { buffer, email }),
    exportVcf: (data: { months: string[] }) => ipcRenderer.invoke('patients:export-vcf', data),
    recalculateTreatmentCases: () => ipcRenderer.invoke('treatment_cases:recalculate'),

    // Daily Report
    getDailyReport: (date: string, email?: string | null) => ipcRenderer.invoke('reports:daily', { date, email }),
    exportFinancials: () => ipcRenderer.invoke('financials:export'),
    getActivePlansDetails: () => ipcRenderer.invoke('treatment_cases:getActiveDetails'),

    // Cities
    getCities: (email?: string | null) => ipcRenderer.invoke('cities:getAll', { email }),
    addCity: (data: any) => ipcRenderer.invoke('db:insert', { table: 'cities', data }),
    updateCity: (id: string, data: any) => ipcRenderer.invoke('db:update', { table: 'cities', id, data }),
    deleteCity: (id: string) => ipcRenderer.invoke('db:delete', { table: 'cities', id }),

    // Doctors
    getDoctors: (email?: string | null) => ipcRenderer.invoke('doctors:getAll', { email }),
    addDoctor: (data: any) => ipcRenderer.invoke('db:insert', { table: 'doctors', data }),
    updateDoctor: (id: string, data: any) => ipcRenderer.invoke('db:update', { table: 'doctors', id, data }),
    deleteDoctor: (id: string) => ipcRenderer.invoke('db:delete', { table: 'doctors', id }),

    // Services
    getServices: (email?: string | null) => ipcRenderer.invoke('services:getAll', { email }),
    addService: (data: any) => ipcRenderer.invoke('db:insert', { table: 'services', data }),
    updateService: (id: string, data: any) => ipcRenderer.invoke('db:update', { table: 'services', id, data }),
    deleteService: (id: string) => ipcRenderer.invoke('db:delete', { table: 'services', id }),

    // Generic
    dbInsert: (table: string, data: any) => ipcRenderer.invoke('db:insert', { table, data }),
    dbUpdate: (table: string, id: string, data: any) => ipcRenderer.invoke('db:update', { table, id, data }),
    dbDelete: (table: string, id: string) => ipcRenderer.invoke('db:delete', { table, id }),
    dbQuery: (sql: string, params?: any[]) => ipcRenderer.invoke('db:query', { sql, params }),

    // Data Management
    backupDatabase: () => ipcRenderer.invoke('database:backup'),
    restoreDatabase: () => ipcRenderer.invoke('database:restore'),
    getExcelHeaders: (filePath: string) => ipcRenderer.invoke('patients:getExcelHeaders', { filePath }),
    smartImportPatients: (filePath: string, mapping: any) => ipcRenderer.invoke('patients:smartImport', { filePath, mapping }),

    // Updates
    checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    onUpdateStatus: (callback: (data: any) => void) => {
        const handler = (_: any, data: any) => callback(data);
        ipcRenderer.on('update-status', handler);
        return () => ipcRenderer.removeListener('update-status', handler);
    },
    onUpdateProgress: (callback: (data: any) => void) => {
        const handler = (_: any, data: any) => callback(data);
        ipcRenderer.on('update-progress', handler);
        return () => ipcRenderer.removeListener('update-progress', handler);
    },

    // Auth (Local)
    getActiveUsers: () => ipcRenderer.invoke('auth:get-users'),
    login: (userId: string, pin: string, remember: boolean) => ipcRenderer.invoke('auth:login', { userId, pin, remember }),
    logout: () => ipcRenderer.invoke('auth:logout'),
    checkAuthStatus: () => ipcRenderer.invoke('auth:check'),
    changePin: (oldPin: string, newPin: string) => ipcRenderer.invoke('auth:change-pin', { oldPin, newPin }),
    checkAdminExists: () => ipcRenderer.invoke('auth:check-admin-exists'),
    createInitialAdmin: (data: any) => ipcRenderer.invoke('auth:create-initial-admin', data),

    // Onboarding

    // Notifications
    getNotifications: (userId: string) => ipcRenderer.invoke('notifications:get-all', { userId }),
    markNotificationRead: (id: string) => ipcRenderer.invoke('notifications:mark-read', { id }),

    // Expenses
    getExpenses: () => ipcRenderer.invoke('expenses:get-all'),
    createExpense: (data: any) => ipcRenderer.invoke('expenses:create', data),
    updateExpense: (id: string, data: any) => ipcRenderer.invoke('expenses:update', { id, ...data }),
    deleteExpense: (id: string) => ipcRenderer.invoke('expenses:delete', { id }),

});

// Supabase Config Expose Removed
