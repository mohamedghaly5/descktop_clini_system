import { ipcMain } from 'electron';
import { licenseService } from '../license/license.service.js';
import { verifyPermission } from '../utils/permissions.js';
export function registerLicenseHandlers() {
    // Initialize on startup
    licenseService.initialize();
    ipcMain.handle('license:get-status', () => {
        return licenseService.getInternalState();
    });
    ipcMain.handle('license:activate', async (_, { key }) => {
        verifyPermission('MANAGE_LICENSE');
        return await licenseService.activateLicense(key);
    });
    ipcMain.handle('license:delete', () => {
        verifyPermission('MANAGE_LICENSE');
        return licenseService.deleteLicense();
    });
}
