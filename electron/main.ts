import './env-loader.js'; // MUST BE FIRST: Loads env vars before any other import
// Trigger rebuild - Register Lab CRUD IPC handlers
import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import path from 'path';
import { networkInterfaces } from 'os';
import { fileURLToPath } from 'url';
import pkg from 'electron-updater';
import { initializeDatabase, getDb } from './db/init.js';
import { registerHandlers } from './handlers.js';
import { backupService } from './services/backupService.js';
// Import supabase AFTER env is guaranteed to be loaded
import { supabase } from './services/supabaseClient.js';
import { startLocalServer } from './server/api.js';

let localServerInstance: any = null;
let serverStartTime = 0;
let serverPort = 3000;
let serverError: string | null = null;

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

import { appMetaService } from './services/appMetaService.js';

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

    // const startInServerMode = process.argv.includes('--server-mode') || appMetaService.get('auto_start_server_mode') === 'true';
    // FIX: Always start in Login/Default mode for UI, even if Server is running in background.

    if (app.isPackaged) {
        const filePath = path.join(__dirname, '../dist/index.html');
        mainWindow.loadFile(filePath);
    } else {
        const devUrl = process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:8080';
        mainWindow.loadURL(devUrl);
        mainWindow.webContents.openDevTools();
    }
}

// ... existing handlers ...
ipcMain.handle('server-mode:toggle-autostart', (_, enable) => {
    app.setLoginItemSettings({
        openAtLogin: enable,
        path: process.execPath,
        args: [
            '--server-mode'
        ]
    });
    appMetaService.set('auto_start_server_mode', enable ? 'true' : 'false');
    return { success: true, enabled: enable };
});

ipcMain.handle('server-mode:get-autostart-status', () => {
    // Check both OS setting and internal flag
    const settings = app.getLoginItemSettings();
    const flag = appMetaService.get('auto_start_server_mode') === 'true';
    return { enabled: settings.openAtLogin && flag };
});

ipcMain.handle('server-mode:get-status', () => {
    return {
        running: !!localServerInstance,
        startTime: serverStartTime,
        port: serverPort,
        error: serverError,
        isClientMode: clientModeService.isActive()
    };
});

ipcMain.handle('server-mode:get-ip', () => {
    const nets = networkInterfaces();
    const results: { name: string, ip: string, priority: number }[] = [];

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]!) {
            // Skip non-IPv4 and internal
            if (net.family === 'IPv4' && !net.internal) {

                // Exclude known virtual/internal-only ranges
                // 192.168.56.x is commonly VirtualBox Host-Only
                // 169.254.x.x is Windows APIPA (Link-Local, no internet)
                if (net.address.startsWith('192.168.56.') || net.address.startsWith('169.254.')) {
                    continue;
                }

                // Calculate Priority
                let priority = 0;
                const lowerName = name.toLowerCase();

                // Deprioritize known virtual adapters by name if they slipped through IP check
                if (lowerName.includes('vmware') || lowerName.includes('virtual') || lowerName.includes('vbox')) {
                    priority -= 10;
                }

                // Prioritize Wi-Fi and Ethernet
                if (lowerName.includes('wi-fi') || lowerName.includes('wifi') || lowerName.includes('wireless')) {
                    priority += 10;
                } else if (lowerName.includes('ethernet') || lowerName.includes('lan')) {
                    priority += 5;
                }

                results.push({ name, ip: net.address, priority });
            }
        }
    }

    if (results.length === 0) return '127.0.0.1';

    // Sort: Higher priority first
    results.sort((a, b) => b.priority - a.priority);

    console.log('[Network] Detected IPs:', results.map(r => `${r.name}: ${r.ip} (P:${r.priority})`));

    return results[0].ip;
});



ipcMain.handle('server-mode:stop', () => {
    if (localServerInstance) {
        localServerInstance.close();
        localServerInstance = null;
        serverStartTime = 0;
        console.log("🛑 Local Server Stopped by User Request");
    }
    return { success: true };
});

import { clientModeService, registerClientModeHandlers } from './services/clientModeService.js';
import { registerClientProxyHandlers } from './services/clientProxy.js';

app.whenReady().then(async () => {
    try {
        console.log('🚀 Starting Application...');

        // Check Mode
        if (clientModeService.isActive()) {
            console.log("🔵 Starting in CLIENT MODE");
            console.log("Target Server:", clientModeService.getServerUrl());

            ipcMain.handle('app:get-info', () => ({
                isClientMode: true,
                serverUrl: clientModeService.getServerUrl()
            }));

            // In Client Mode, we DO NOT init DB or Local API.
            // We only register proxy handlers.
            registerClientProxyHandlers();

            // Also register setup handlers to allow Disconnect
            registerClientModeHandlers();

            setupUpdater();
            createWindow();

        } else {
            console.log("🟢 Starting in SERVER/LOCAL MODE");

            // Debug Env
            console.log("MAIN ENV CHECK:");
            console.log("URL:", process.env.VITE_SUPABASE_URL ? "Set" : "Missing");
            console.log("SERVICE KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "Set" : "Missing");

            // 1. Initialize Database
            try {
                await initializeDatabase();
                // FORCE LOGOUT ON STARTUP: Clear any persisted session so user must select profile
                appMetaService.set('current_user_id', '');
                console.log('✅ Database Initialized');
            } catch (dbError: any) {
                console.error('❌ Database Initialization Failed:', dbError);
                serverError = `Database Error: ${dbError.message || 'Unknown error'}`;
                // Continue to create window so user can see the error
            }

            // 2. Register Handlers
            ipcMain.handle('app:get-info', () => ({ isClientMode: false }));
            registerHandlers();
            registerClientModeHandlers(); // Allow switching to Client Mode
            console.log('✅ Handlers Registered');

            setupUpdater();

            // Start Local API Server (only if DB initialized successfully)
            if (!serverError) {
                try {
                    if (!localServerInstance) {
                        localServerInstance = startLocalServer(3000);
                        if (localServerInstance && localServerInstance.address) {
                            const addr = localServerInstance.address();
                            if (addr && typeof addr === 'object') {
                                serverPort = addr.port;
                            }
                        }
                        serverStartTime = Date.now();
                        console.log(`✅ Local API Server Started on Port ${serverPort}`);
                    }
                } catch (serverErr: any) {
                    console.error("❌ Failed to start API Server:", serverErr);
                    serverError = `Server Error: ${serverErr.message || 'Failed to start'}`;
                }
            }

            // Check for scheduled backups
            backupService.checkAndRunScheduledBackup();

            createWindow();

            // Test Supabase quietly
            testSupabaseConnection();
        }
    } catch (error) {
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
        if (error) console.error("🔴 Supabase Check Failed:", error.message);
        else console.log("🟢 Supabase Check OK");
    } catch (e) {
        console.error("🔴 Supabase Check Error:", e);
    }
}
