/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}


interface Window {
    electron: {
        ipcRenderer: {
            invoke(channel: string, ...args: any[]): Promise<any>;
            send(channel: string, ...args: any[]): void;
            on(channel: string, func: (...args: any[]) => void): () => void;
            removeListener(channel: string, func: (...args: any[]) => void): void;
        };
    };
    api: {
        changePin: (oldPin: string, newPin: string) => Promise<any>;
        createInitialAdmin: (data: any) => Promise<any>;
        logout: () => Promise<void>;
        getPatients: (email?: string | null) => Promise<any>;
        getPatientById: (id: string) => Promise<any>;
        // Allow other dynamic keys
        [key: string]: any;
    };
}
