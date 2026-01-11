import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import path from 'path';
import 'dotenv/config'; // Load env vars
import { initializeDatabase, getDb } from './db/init.js';
import { registerHandlers } from './handlers.js';
import { backupService } from './services/backupService.js';
import { fileURLToPath } from 'url';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

function setupUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // IPC Handlers
    ipcMain.handle('check-for-update', () => autoUpdater.checkForUpdates());
    ipcMain.handle('download-update', () => autoUpdater.downloadUpdate());
    ipcMain.handle('quit-and-install', () => autoUpdater.quitAndInstall());

    // Event Forwarding
    autoUpdater.on('checking-for-update', () => {
        mainWindow?.webContents.send('update-status', { status: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
        mainWindow?.webContents.send('update-status', { status: 'available', version: info.version });
    });

    autoUpdater.on('update-not-available', () => {
        mainWindow?.webContents.send('update-status', { status: 'latest' });
    });

    autoUpdater.on('download-progress', (progressObj) => {
        mainWindow?.webContents.send('update-progress', progressObj.percent);
    });

    autoUpdater.on('update-downloaded', () => {
        mainWindow?.webContents.send('update-status', { status: 'ready' });
    });

    autoUpdater.on('error', (err) => {
        mainWindow?.webContents.send('update-status', { status: 'error', error: err.message });
    });
}

function createWindow() {
    const iconPath = app.isPackaged
        ? path.join(__dirname, '../dist/icon.ico')
        : path.join(__dirname, '../public/icon.ico');

    console.log('🖼️ Loading Icon from:', iconPath);

    const iconImage = nativeImage.createFromPath(iconPath);

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Dental Flow',
        icon: iconImage,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    if (app.isPackaged) {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    } else {
        const devUrl = process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:8080';
        mainWindow.loadURL(devUrl);
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(async () => {
    try {
        initializeDatabase();
        registerHandlers();
        setupUpdater();

        // Check for scheduled backups
        backupService.checkAndRunScheduledBackup();

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
        const db = getDb();
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
