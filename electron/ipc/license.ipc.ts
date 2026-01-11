import { ipcMain } from 'electron';
import { licenseService } from '../license/license.service.js';

export function registerLicenseHandlers() {

    // Initialize on startup
    licenseService.initialize();

    ipcMain.handle('license:get-status', () => {
        return licenseService.getInternalState();
    });

    ipcMain.handle('license:activate', async (_, { key }) => {
        return await licenseService.activateLicense(key);
    });

    ipcMain.handle('license:delete', () => {
        return licenseService.deleteLicense();
    });
}
