/// <reference types="vite/client" />

interface Window {
    supabaseConfig: {
        get: () => Promise<{ url: string; key: string }>;
    };
}
