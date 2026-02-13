import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/authService';

// Simplified Local User Interface
export interface User {
  id: string;
  name: string;
  role: 'admin' | 'doctor' | 'staff'; // Typed roles
  clinic_id: string;
  email?: string;
  permissions?: string[];
}

interface AuthResult {
  success: boolean;
  error?: string;
  code?: string;
}

interface AuthContextType {
  user: User | null;
  clinicId?: string;
  loading: boolean;
  isClockTampered: boolean;

  mustChangePin: boolean;
  hasAdmin: boolean | null;
  // Updated login signature to accept rememberMe
  login: (userId: string, pin: string, remember?: boolean) => Promise<AuthResult>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  changePin: (oldPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  checkAdminExists: () => Promise<boolean>;
  createInitialAdmin: (data: { name: string; pin: string }) => Promise<{ success: boolean; error?: string }>;

  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClockTampered, setIsClockTampered] = useState(false);
  const [connectionError, setConnectionError] = useState<{ error: string } | null>(null);

  const [mustChangePin, setMustChangePin] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  // Initial Auth Check
  const checkAuth = async (silent = false) => {
    // We delegate all persistence/startup logic to the Backend
    if (!silent) setLoading(true);
    setConnectionError(null);

    try {
      // 1. Verify Connection (Client Mode Safety)
      // This prevents the UI from trying to load data from a dead server
      if (!silent) {
        // Detect if we need setup (Web/Mobile)
        if (!(window as any).electron && !localStorage.getItem('server_url')) {
          setShowSetup(true);
          setLoading(false);
          return;
        }

        const conn = await authService.verifyConnection();
        if (!conn.success) {
          setConnectionError({ error: conn.error || 'Connection Failed' });
          setLoading(false);
          return;
        }
      }

      let authResult = null;
      const MAX_RETRIES = silent ? 1 : 5; // Reduced retries for background checks

      for (let i = 0; i < MAX_RETRIES; i++) {
        const adminExists = await authService.checkAdminExists();
        setHasAdmin(adminExists);

        // @ts-ignore
        authResult = await authService.checkAuthStatus();

        if (authResult && authResult.code === 'DB_NOT_OPEN') {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        break;
      }

      if (authResult) {
        if (authResult.code === 'CLOCK_TAMPERED') {
          setIsClockTampered(true);
          setUser(null);
        } else if (authResult.authenticated && authResult.user) {
          setUser(authResult.user);
          setIsClockTampered(false);
          setMustChangePin(!!authResult.mustChangePin);
        } else {
          // If session is lost on the server side, log out locally
          setUser(null);
          setMustChangePin(false);
        }
      }
    } catch (e: any) {
      console.error('Auth Check Critical Failure', e);
      // If it's a network error that slipped through verifyConnection
      if (!silent && e.message && (e.message.includes('Network') || e.message.includes('Refused'))) {
        setConnectionError({ error: e.message });
      } else if (!silent) {
        setUser(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    // Poll for permission updates / session validity (every 1 minute)
    // This allows permissions changed on server to reflect on client "live"
    const intervalId = setInterval(() => {
      checkAuth(true); // Silent check
    }, 60000);

    // Listen for Session Expiry from Client Proxy
    if ((window as any).electron) {
      // @ts-ignore
      const removeListener = window.electron.ipcRenderer.on('auth:session-expired', () => {
        console.warn("Session Expired - Forcing Logout");
        setUser(null);
        // Clean local storage too
        localStorage.removeItem('session_token');
      });
      return () => {
        removeListener();
        clearInterval(intervalId);
      };
    }
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const login = async (userId: string, pin: string, remember: boolean = false): Promise<AuthResult> => {
    try {
      setLoading(true);
      // Backend (Client Proxy or Local) handles login via PIN.
      const result = await authService.login(userId, pin, remember);
      if (result.code === 'CLOCK_TAMPERED') {
        setIsClockTampered(true);
        setLoading(false);
        return { success: false, error: 'System time manipulation detected.' };
      }

      if (result.success && result.user) {
        setUser(result.user);
        setIsClockTampered(false);
        // We do NOT need to call checkAuth again, just set state
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Login failed' };
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Unknown error' };
    } finally {
      setLoading(false);
    }
  };

  const changePin = async (oldPin: string, newPin: string) => {
    try {
      // @ts-ignore
      if (window.api) {
        const res = await window.api.changePin(oldPin, newPin);
        if (res.success) {
          setMustChangePin(false);
        }
        return res;
      }
      return { success: false, error: "Feature not available on mobile yet" };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const checkAdminExists = async () => {
    const exists = await authService.checkAdminExists();
    setHasAdmin(exists);
    return exists;
  };

  const createInitialAdmin = async (data: { name: string; pin: string }) => {
    // @ts-ignore
    if (window.api) {
      const res = await window.api.createInitialAdmin(data);
      if (res.success) {
        await checkAuth();
      }
      return res;
    }
    return { success: false, error: "Setup must be done on Server PC" };
  };

  const logout = async () => {
    try {
      // @ts-ignore
      if (window.api) await window.api.logout();

      setUser(null);
      setMustChangePin(false);
      localStorage.removeItem('session_token');
      sessionStorage.removeItem('session_token');
    } catch (e) {
      console.error('Logout failed', e);
    }
  };

  if (showSetup) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center space-y-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 14a1 1 0 1 1 1-1 1 1 0 0 1-1 1zm1-4h-2V7h2z" /></svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Setup Connection</h1>
        <p className="text-gray-600 max-w-sm">
          Please enter the Server IP Address shown on your main computer (e.g. 192.168.1.5).
        </p>
        <form
          className="w-full max-w-sm space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            let url = formData.get('url') as string;
            if (url) {
              // Formatting
              url = url.trim();
              if (!url.startsWith('http')) url = 'http://' + url;
              if (url.endsWith('/')) url = url.slice(0, -1);

              // smarter port check: does it end with :NUMBER?
              // we ignore the http: colon
              if (!/:\d+$/.test(url)) {
                url = url + ':3000';
              }

              localStorage.setItem('server_url', url);
              window.location.reload();
            }
          }}
        >
          <input
            type="text"
            name="url"
            placeholder="e.g. 192.168.1.5"
            className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
            autoFocus
          />
          <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors">
            Connect
          </button>
        </form>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Connection Failed</h1>
        <p className="text-gray-600 max-w-sm">
          Unable to connect to the server. The Server IP might have changed, or the server is offline.
        </p>
        <p className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded border border-red-100 font-mono">
          {connectionError.error}
        </p>
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded shadow-sm text-gray-700 font-medium text-sm transition-colors"
          >
            Retry
          </button>
          <button
            onClick={async () => {
              // @ts-ignore
              if ((window as any).electron) {
                const res = await window.electron.ipcRenderer.invoke('client:disconnect');
                if (res?.success) window.location.reload();
              } else {
                // Mobile: Reset Server URL
                localStorage.removeItem('server_url');
                localStorage.removeItem('session_token');
                window.location.reload();
              }
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded shadow-sm text-white font-medium text-sm transition-colors"
          >
            Reset Connection
          </button>
        </div>
      </div>
    );
  }

  if (isClockTampered) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-red-50 p-4 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Security Alert</h1>
        <p className="text-gray-700">System time manipulation detected. Please correct your system clock and restart the application.</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      clinicId: user?.clinic_id,
      user,
      loading,
      isClockTampered,

      mustChangePin,
      hasAdmin,
      login,
      logout,
      checkAuth,
      changePin,
      checkAdminExists,
      createInitialAdmin,
      hasPermission: (code: string) => {
        if (!user) return false;
        if (user.role === 'admin') return true; // Admin has all permissions
        return user.permissions?.includes(code) || false;
      }
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
