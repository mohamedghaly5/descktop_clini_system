"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Fix: Expose ipcRenderer nested inside 'electron' object to match frontend calls
electron_1.contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: (channel, ...args) => electron_1.ipcRenderer.invoke(channel, ...args),
        send: (channel, ...args) => electron_1.ipcRenderer.send(channel, ...args),
        on: (channel, func) => {
            const subscription = (_event, ...args) => func(...args);
            electron_1.ipcRenderer.on(channel, subscription);
            return () => electron_1.ipcRenderer.removeListener(channel, subscription);
        },
    },
    backup: {
        restoreLocal: () => electron_1.ipcRenderer.invoke('backup:restore-local')
    }
});
// Expose Safe Env Vars to Renderer
electron_1.contextBridge.exposeInMainWorld('env', {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY
});
electron_1.contextBridge.exposeInMainWorld('api', {
    // System
    getSystemStatus: () => electron_1.ipcRenderer.invoke('system:get-status'),
    // License
    getLicenseStatus: () => electron_1.ipcRenderer.invoke('license:get-status'),
    activateLicense: (key) => electron_1.ipcRenderer.invoke('license:activate', { key }),
    // Patients
    getPatients: (email) => electron_1.ipcRenderer.invoke('patients:getAll', { email }),
    getPatientById: (id) => electron_1.ipcRenderer.invoke('patients:getById', id),
    createPatient: (data) => electron_1.ipcRenderer.invoke('patients:create', data),
    importPatients: (buffer, email) => electron_1.ipcRenderer.invoke('patients:import', { buffer, email }),
    exportVcf: (data) => electron_1.ipcRenderer.invoke('patients:export-vcf', data),
    recalculateTreatmentCases: () => electron_1.ipcRenderer.invoke('treatment_cases:recalculate'),
    // Daily Report
    getDailyReport: (date, email) => electron_1.ipcRenderer.invoke('reports:daily', { date, email }),
    exportFinancials: () => electron_1.ipcRenderer.invoke('financials:export'),
    getActivePlansDetails: () => electron_1.ipcRenderer.invoke('treatment_cases:getActiveDetails'),
    // Cities
    getCities: (email) => electron_1.ipcRenderer.invoke('cities:getAll', { email }),
    addCity: (data) => electron_1.ipcRenderer.invoke('db:insert', { table: 'cities', data }),
    updateCity: (id, data) => electron_1.ipcRenderer.invoke('db:update', { table: 'cities', id, data }),
    deleteCity: (id) => electron_1.ipcRenderer.invoke('db:delete', { table: 'cities', id }),
    // Doctors
    getDoctors: (email) => electron_1.ipcRenderer.invoke('doctors:getAll', { email }),
    addDoctor: (data) => electron_1.ipcRenderer.invoke('db:insert', { table: 'doctors', data }),
    updateDoctor: (id, data) => electron_1.ipcRenderer.invoke('db:update', { table: 'doctors', id, data }),
    deleteDoctor: (id) => electron_1.ipcRenderer.invoke('db:delete', { table: 'doctors', id }),
    // Services
    getServices: (email) => electron_1.ipcRenderer.invoke('services:getAll', { email }),
    addService: (data) => electron_1.ipcRenderer.invoke('db:insert', { table: 'services', data }),
    updateService: (id, data) => electron_1.ipcRenderer.invoke('db:update', { table: 'services', id, data }),
    deleteService: (id) => electron_1.ipcRenderer.invoke('db:delete', { table: 'services', id }),
    // Generic
    dbInsert: (table, data) => electron_1.ipcRenderer.invoke('db:insert', { table, data }),
    dbUpdate: (table, id, data) => electron_1.ipcRenderer.invoke('db:update', { table, id, data }),
    dbDelete: (table, id) => electron_1.ipcRenderer.invoke('db:delete', { table, id }),
    dbQuery: (sql, params) => electron_1.ipcRenderer.invoke('db:query', { sql, params }),
    // Data Management
    backupDatabase: () => electron_1.ipcRenderer.invoke('database:backup'),
    restoreDatabase: () => electron_1.ipcRenderer.invoke('database:restore'),
    getExcelHeaders: (filePath) => electron_1.ipcRenderer.invoke('patients:getExcelHeaders', { filePath }),
    smartImportPatients: (filePath, mapping) => electron_1.ipcRenderer.invoke('patients:smartImport', { filePath, mapping }),
    // Updates
    checkForUpdate: () => electron_1.ipcRenderer.invoke('check-for-update'),
    downloadUpdate: () => electron_1.ipcRenderer.invoke('download-update'),
    quitAndInstall: () => electron_1.ipcRenderer.invoke('quit-and-install'),
    onUpdateStatus: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('update-status', handler);
        return () => electron_1.ipcRenderer.removeListener('update-status', handler);
    },
    onUpdateProgress: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('update-progress', handler);
        return () => electron_1.ipcRenderer.removeListener('update-progress', handler);
    },
    // Auth (Local)
    getActiveUsers: () => electron_1.ipcRenderer.invoke('auth:get-users'),
    login: (userId, pin, remember) => electron_1.ipcRenderer.invoke('auth:login', { userId, pin, remember }),
    logout: () => electron_1.ipcRenderer.invoke('auth:logout'),
    checkAuthStatus: () => electron_1.ipcRenderer.invoke('auth:check'),
    changePin: (oldPin, newPin) => electron_1.ipcRenderer.invoke('auth:change-pin', { oldPin, newPin }),
    checkAdminExists: () => electron_1.ipcRenderer.invoke('auth:check-admin-exists'),
    createInitialAdmin: (data) => electron_1.ipcRenderer.invoke('auth:create-initial-admin', data),
    // Onboarding
    // Notifications
    getNotifications: (userId) => electron_1.ipcRenderer.invoke('notifications:get-all', { userId }),
    markNotificationRead: (id) => electron_1.ipcRenderer.invoke('notifications:mark-read', { id }),
    // Expenses
    getExpenses: () => electron_1.ipcRenderer.invoke('expenses:get-all'),
    createExpense: (data) => electron_1.ipcRenderer.invoke('expenses:create', data),
    updateExpense: (id, data) => electron_1.ipcRenderer.invoke('expenses:update', { id, ...data }),
    deleteExpense: (id) => electron_1.ipcRenderer.invoke('expenses:delete', { id }),
});
// Supabase Config Expose Removed
