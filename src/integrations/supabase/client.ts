// This file is disabled to prevent Renderer from accessing Supabase directly.
// All Supabase interactions must go through Electron IPC (Main Process).
// Check electron/services/supabaseAdmin.ts for the Main process client.

export const supabase = new Proxy({}, {
  get: () => {
    throw new Error('Direct Supabase access from Renderer is DISABLED. Use window.api IPC methods instead.');
  }
});