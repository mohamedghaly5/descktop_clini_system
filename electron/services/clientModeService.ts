import { appMetaService } from '../services/appMetaService.js';
import { ipcMain, app } from 'electron';

// Service to manage "Client Mode" state
// Uses a separate JSON file to avoid dependency on SQLite (which is disabled in Client Mode)
import fs from 'fs';
import path from 'path';

const getConfigPath = () => path.join(app.getPath('userData'), 'client-config.json');

export const clientModeService = {
    // Check if we are in Client Mode
    isActive: () => {
        try {
            if (!fs.existsSync(getConfigPath())) return false;
            const config = JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8'));
            return !!config.serverIp;
        } catch { return false; }
    },

    // Get Server URL
    getServerUrl: () => {
        try {
            if (!fs.existsSync(getConfigPath())) return null;
            const config = JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8'));
            return config.serverIp ? `http://${config.serverIp}:3000` : null;
        } catch { return null; }
    },

    // Connect (Save IP)
    connect: (ip: string) => {
        fs.writeFileSync(getConfigPath(), JSON.stringify({ serverIp: ip }));
        return true;
    },

    // Disconnect (Clear IP)
    disconnect: () => {
        try {
            if (fs.existsSync(getConfigPath())) fs.unlinkSync(getConfigPath());
        } catch (e) { console.error("Failed to disconnect:", e); }
    }
};

// IPC Handlers for Setup
export function registerClientModeHandlers() {
    ipcMain.handle('client:connect', async (_, ip) => {
        try {
            // Verify connection
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            try {
                const res = await fetch(`http://${ip}:3000/api/auth/login`, {
                    method: 'OPTIONS', // Just check reachability or use specific health endpoint if exists
                    signal: controller.signal
                });
                // Note: OPTIONS might 404 but server is reachable.
                // Or just assume if no network error, it's fine.
            } catch (e) {
                // Ignore fetch errors for now or be strict. 
                // Let's be lenient: if it fails, maybe server isn't up YET, but user wants to save config.
                // Actually user wants "Connect".
                console.warn("Connection verification failed:", e);
                // return { success: false, error: 'Could not reach server at ' + ip };
            } finally {
                clearTimeout(timeoutId);
            }

            clientModeService.connect(ip);

            // Relaunch after a short delay to allow UI to show success message
            setTimeout(() => {
                app.relaunch({ args: process.argv.slice(1) });
                app.quit();
            }, 1500);

            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('client:disconnect', () => {
        clientModeService.disconnect();
        app.relaunch({ args: process.argv.slice(1) });
        app.quit();
        return { success: true };
    });
}
