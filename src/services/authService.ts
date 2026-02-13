import axios from 'axios';

// Define interface for App Info
interface AppInfo {
    isClientMode: boolean;
    serverUrl?: string;
}

// Cache the app info to avoid repeated IPC calls
let cachedAppInfo: AppInfo | null = null;

const getAppInfo = async (): Promise<AppInfo> => {
    if (cachedAppInfo) return cachedAppInfo;

    // 1. Check if running in Electron
    // @ts-ignore
    if ((window as any).electron && (window as any).electron.ipcRenderer) {
        // @ts-ignore
        cachedAppInfo = await window.electron.ipcRenderer.invoke('app:get-info');
    } else {
        // 2. Running in Browser / Mobile App
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

export const authService = {
    getUsers: async () => {
        const info = await getAppInfo();
        if (info.isClientMode && info.serverUrl) {
            // Client Mode: HTTP Fetch
            console.log("AuthService: Fetching users via HTTP from", info.serverUrl);
            const response = await axios.get(`${info.serverUrl}/api/public/users`, { timeout: 10000 });
            return response.data;
        } else {
            // Local Mode: IPC Call
            // @ts-ignore
            return await window.electron.ipcRenderer.invoke('auth:get-users');
        }
    },

    verifyConnection: async (): Promise<{ success: boolean; error?: string }> => {
        const info = await getAppInfo();
        if (!info.isClientMode || !info.serverUrl) return { success: true };

        const MAX_RETRIES = 3;
        const TIMEOUT = 10000;

        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                // Probe a lightweight endpoint
                await axios.get(`${info.serverUrl}/api/public/users?limit=1`, {
                    timeout: TIMEOUT
                });
                return { success: true };
            } catch (e: any) {
                console.warn(`[AuthService] Connection attempt ${i + 1} failed:`, e.message);
                if (i === MAX_RETRIES - 1) {
                    return { success: false, error: e.message || 'Connection Refused' };
                }
                await new Promise(r => setTimeout(r, 500 * (i + 1)));
            }
        }
        return { success: false, error: 'Unreachable' };
    },

    checkAdminExists: async () => {
        const info = await getAppInfo();
        if (info.isClientMode && info.serverUrl) {
            return true;
        } else {
            // @ts-ignore
            return await window.electron.ipcRenderer.invoke('auth:check-admin-exists');
        }
    },

    login: async (userId: string, pin: string, remember: boolean = false) => {
        const info = await getAppInfo();
        if (info.isClientMode && info.serverUrl) {
            try {
                const response = await axios.post(`${info.serverUrl}/api/auth/login`, { userId, pin });
                const { token, user } = response.data;
                if (token) {
                    if (remember) {
                        localStorage.setItem('session_token', token);
                    } else {
                        sessionStorage.setItem('session_token', token);
                    }
                    // Sync to Main Process only if Electron exists
                    // @ts-ignore
                    if ((window as any).electron) {
                        await window.electron.ipcRenderer.invoke('auth:set-session', token);
                    }
                }
                return { success: true, user, token };
            } catch (e: any) {
                return { success: false, error: e.response?.data?.error || 'Login failed' };
            }
        } else {
            // @ts-ignore
            return await window.electron.ipcRenderer.invoke('auth:login', { userId, pin, remember });
        }
    },

    checkAuthStatus: async () => {
        const info = await getAppInfo();
        if (info.isClientMode && info.serverUrl) {
            const token = localStorage.getItem('session_token') || sessionStorage.getItem('session_token');
            if (!token) return { authenticated: false };
            try {
                const response = await axios.get(`${info.serverUrl}/api/auth/check`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                // If valid, Sync to Main Process only if Electron exists
                // @ts-ignore
                if (response.data?.authenticated && (window as any).electron) {
                    await window.electron.ipcRenderer.invoke('auth:set-session', token);
                }
                return response.data; // expects { authenticated: true, user: ... }
            } catch (e) {
                return { authenticated: false };
            }
        } else {
            // @ts-ignore
            return await window.electron.ipcRenderer.invoke('auth:check');
        }
    }
};
