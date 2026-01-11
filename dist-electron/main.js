import './env-loader.js'; // MUST BE FIRST: Loads env vars before any other import
// Trigger rebuild - Register Lab CRUD IPC handlers
import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'electron-updater';
import { initializeDatabase } from './db/init.js';
import { registerHandlers } from './handlers.js';
import { backupService } from './services/backupService.js';
// Import supabase AFTER env is guaranteed to be loaded
import { supabase } from './services/supabaseClient.js';
const { autoUpdater } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow = null;
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
    }
    else {
        const devUrl = process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:8080';
        mainWindow.loadURL(devUrl);
        mainWindow.webContents.openDevTools();
    }
}
app.whenReady().then(async () => {
    try {
        console.log('🚀 Starting Application...');
        // Debug Env
        console.log("MAIN ENV CHECK:");
        console.log("URL:", process.env.VITE_SUPABASE_URL ? "Set" : "Missing");
        console.log("SERVICE KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "Set" : "Missing");
        // 1. Initialize Database
        try {
            await initializeDatabase();
            console.log('✅ Database Initialized');
        }
        catch (dbError) {
            console.error('❌ Database Initialization Failed:', dbError);
            // Auto-Healing for Malformed Database
            if (dbError.code === 'SQLITE_CORRUPT' || (dbError.message && dbError.message.includes('malformed'))) {
                console.warn('⚠️ DETECTED CORRUPT DATABASE. Initiating emergency reset...');
                try {
                    const fs = await import('fs');
                    const userDataPath = app.getPath('userData');
                    const dbPath = path.join(userDataPath, 'dental.db');
                    if (fs.existsSync(dbPath)) {
                        const corruptedBackup = path.join(userDataPath, `dental.corrupted.${Date.now()}.db`);
                        fs.renameSync(dbPath, corruptedBackup);
                        console.log(`⚠️ Corrupt database moved to: ${corruptedBackup}`);
                        // Retry Initialization
                        await initializeDatabase();
                        console.log('✅ Database Re-initialized (Fresh State)');
                    }
                }
                catch (recoveryError) {
                    console.error('❌ CRITICAL: Failed to recover from corrupt database:', recoveryError);
                    throw recoveryError; // Give up
                }
            }
            else {
                throw dbError; // Re-throw other errors
            }
        }
        // 2. Register Handlers
        registerHandlers();
        console.log('✅ Handlers Registered');
        setupUpdater();
        // Check for scheduled backups
        backupService.checkAndRunScheduledBackup();
        createWindow();
        // Test Supabase quietly
        testSupabaseConnection();
    }
    catch (error) {
        console.error('Failed to initialize app', error);
    }
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
async function testSupabaseConnection() {
    try {
        const { data, error } = await supabase.from('licenses').select('count', { count: 'exact', head: true });
        if (error)
            console.error("🔴 Supabase Check Failed:", error.message);
        else
            console.log("🟢 Supabase Check OK");
    }
    catch (e) {
        console.error("🔴 Supabase Check Error:", e);
    }
}
