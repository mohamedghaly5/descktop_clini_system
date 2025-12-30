import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
});

contextBridge.exposeInMainWorld('api', {
    // Patients
    getPatients: (clinicId?: string) => ipcRenderer.invoke('patients:getAll', { clinicId }),
    createPatient: (data: any) => ipcRenderer.invoke('patients:create', data),
    importPatients: (buffer: ArrayBuffer) => ipcRenderer.invoke('patients:import', buffer),
    recalculateTreatmentCases: () => ipcRenderer.invoke('treatment_cases:recalculate'),

    // Daily Report
    getDailyReport: (date: string) => ipcRenderer.invoke('reports:daily', { date }),
    exportFinancials: () => ipcRenderer.invoke('financials:export'),
    getActivePlansDetails: () => ipcRenderer.invoke('treatment_cases:getActiveDetails'),

    // Cities
    getCities: () => ipcRenderer.invoke('cities:getAll'),
    addCity: (data: any) => ipcRenderer.invoke('db:insert', { table: 'cities', data }),
    updateCity: (id: string, data: any) => ipcRenderer.invoke('db:update', { table: 'cities', id, data }),
    deleteCity: (id: string) => ipcRenderer.invoke('db:delete', { table: 'cities', id }),

    // Doctors
    getDoctors: () => ipcRenderer.invoke('doctors:getAll'),
    addDoctor: (data: any) => ipcRenderer.invoke('db:insert', { table: 'doctors', data }),
    updateDoctor: (id: string, data: any) => ipcRenderer.invoke('db:update', { table: 'doctors', id, data }),
    deleteDoctor: (id: string) => ipcRenderer.invoke('db:delete', { table: 'doctors', id }),

    // Services
    getServices: () => ipcRenderer.invoke('services:getAll'),
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
});
