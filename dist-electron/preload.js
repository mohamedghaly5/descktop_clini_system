"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electron', {
    invoke: (channel, ...args) => electron_1.ipcRenderer.invoke(channel, ...args),
});
electron_1.contextBridge.exposeInMainWorld('api', {
    // Patients
    getPatients: (clinicId) => electron_1.ipcRenderer.invoke('patients:getAll', { clinicId }),
    createPatient: (data) => electron_1.ipcRenderer.invoke('patients:create', data),
    importPatients: (buffer) => electron_1.ipcRenderer.invoke('patients:import', buffer),
    recalculateTreatmentCases: () => electron_1.ipcRenderer.invoke('treatment_cases:recalculate'),
    // Daily Report
    getDailyReport: (date) => electron_1.ipcRenderer.invoke('reports:daily', { date }),
    exportFinancials: () => electron_1.ipcRenderer.invoke('financials:export'),
    getActivePlansDetails: () => electron_1.ipcRenderer.invoke('treatment_cases:getActiveDetails'),
    // Cities
    getCities: () => electron_1.ipcRenderer.invoke('cities:getAll'),
    addCity: (data) => electron_1.ipcRenderer.invoke('db:insert', { table: 'cities', data }),
    updateCity: (id, data) => electron_1.ipcRenderer.invoke('db:update', { table: 'cities', id, data }),
    deleteCity: (id) => electron_1.ipcRenderer.invoke('db:delete', { table: 'cities', id }),
    // Doctors
    getDoctors: () => electron_1.ipcRenderer.invoke('doctors:getAll'),
    addDoctor: (data) => electron_1.ipcRenderer.invoke('db:insert', { table: 'doctors', data }),
    updateDoctor: (id, data) => electron_1.ipcRenderer.invoke('db:update', { table: 'doctors', id, data }),
    deleteDoctor: (id) => electron_1.ipcRenderer.invoke('db:delete', { table: 'doctors', id }),
    // Services
    getServices: () => electron_1.ipcRenderer.invoke('services:getAll'),
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
});
