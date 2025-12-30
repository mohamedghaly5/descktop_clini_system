import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { initializeDatabase } from './database';
import { registerHandlers } from './handlers';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:8080'); // Adjust port if needed
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(async () => {
    try {
        initializeDatabase();
        registerHandlers();
        createWindow();
    } catch (error) {
        console.error('Failed to initialize app', error);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // DEBUG: Log cities table to console
    try {
        const db = require('./database').getDb();
        const cities = db.prepare('SELECT * FROM cities').all();
        console.log('--- DEBUG: CITIES TABLE ---');
        console.table(cities);
        const patients = db.prepare('SELECT * FROM patients').all();
        console.log('--- DEBUG: PATIENTS TABLE ---');
        console.table(patients);
    } catch (e) {
        console.error('--- DEBUG: Failed to read existing tables', e);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
