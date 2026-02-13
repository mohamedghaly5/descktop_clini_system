import axios from 'axios';

// Interface matching the backend DB shape (snake_case) or what the IPC returns
// In SettingsContext, it expects:
/*
{
  id,
  clinic_name,
  owner_name,
  address,
  phone,
  whatsapp_number,
  email,
  clinic_logo,
  currency
}
*/
// The IPC 'settings:getClinicInfo' returns this snake_case shape.
// So our service should return the same shape to avoid breaking strict typing in SettingsContext.

interface ClinicInfoResponse {
    id: string;
    clinic_name: string;
    owner_name: string;
    address: string;
    phone: string;
    whatsapp_number: string;
    email: string;
    clinic_logo: string;
    currency: string;
}

// Reuse app info logic (duplicate code for now to avoid circular deps if efficient, or better reuse `authService` helper?)
// Actually `authService` helper `getAppInfo` was local to that file. 
// I should export `getAppInfo` or replicate it. 
// Replicating is safer for this surgical fix.

interface AppInfo {
    isClientMode: boolean;
    serverUrl?: string;
}

let cachedAppInfo: AppInfo | null = null;

const getAppInfo = async (): Promise<AppInfo> => {
    if (cachedAppInfo) return cachedAppInfo;

    // @ts-ignore
    if ((window as any).electron && (window as any).electron.ipcRenderer) {
        // @ts-ignore
        cachedAppInfo = await window.electron.ipcRenderer.invoke('app:get-info');
    } else {
        let serverUrl = localStorage.getItem('server_url') || '';
        if (!serverUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
            serverUrl = window.location.origin;
        }

        cachedAppInfo = {
            isClientMode: true,
            serverUrl
        };
    }
    return cachedAppInfo!;
};

export const settingsService = {
    getClinicInfo: async (): Promise<ClinicInfoResponse | null> => {
        const info = await getAppInfo();
        if (info.isClientMode && info.serverUrl) {
            try {
                const res = await axios.get(`${info.serverUrl}/api/settings/clinic-info`);
                return res.data;
            } catch (e) {
                console.error("Failed to fetch settings via HTTP", e);
                return null;
            }
        }

        // Local Mode or Legacy
        try {
            // @ts-ignore
            if ((window as any).electron) {
                // @ts-ignore
                const response = await window.electron.ipcRenderer.invoke('settings:getClinicInfo');
                return response || null;
            }
            return null;
        } catch (e) {
            console.error("Failed to fetch settings via IPC", e);
            return null;
        }
    },

    saveClinicInfo: async (data: any) => {
        const info = await getAppInfo();
        if (info.isClientMode) {
            console.warn("Client Mode cannot save settings locally yet.");
            return false;
        } else {
            // @ts-ignore
            await window.electron.ipcRenderer.invoke('settings:save-clinic-info', data);
            return true;
        }
    },

    syncClinicInfo: async (data: any) => {
        const info = await getAppInfo();
        if (info.isClientMode) {
            return false;
        }
        // @ts-ignore
        return await window.electron.ipcRenderer.invoke('settings:syncClinicInfo', data);
    }
};
