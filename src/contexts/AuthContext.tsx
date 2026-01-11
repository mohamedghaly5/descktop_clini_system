import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Simplified Local User Interface
export interface User {
  id: string;
  name: string;
  role: 'admin' | 'doctor' | 'staff'; // Typed roles
  clinic_id: string;
  email?: string;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClockTampered, setIsClockTampered] = useState(false);

  const [mustChangePin, setMustChangePin] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);

  // Initial Auth Check
  const checkAuth = async () => {
    // We delegate all persistence/startup logic to the Backend
    setLoading(true);
    try {
      let authResult = null;
      const MAX_RETRIES = 5;

      for (let i = 0; i < MAX_RETRIES; i++) {
        // @ts-ignore
        const adminExists = await window.api.checkAdminExists();
        setHasAdmin(adminExists);

        // @ts-ignore
        authResult = await window.api.checkAuthStatus();

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
          setUser(null);
          setMustChangePin(false);
        }
      }
    } catch (e) {
      console.error('Auth Check Critical Failure', e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (userId: string, pin: string, remember: boolean = false): Promise<AuthResult> => {
    try {
      setLoading(true);
      // @ts-ignore
      // Pass 'remember' flag to backend for persistent storage
      const result = await window.api.login(userId, pin, remember);

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
      const res = await window.api.changePin(oldPin, newPin);
      if (res.success) {
        setMustChangePin(false);
      }
      return res;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const checkAdminExists = async () => {
    // @ts-ignore
    const exists = await window.api.checkAdminExists();
    setHasAdmin(exists);
    return exists;
  };

  const createInitialAdmin = async (data: { name: string; pin: string }) => {
    // @ts-ignore
    const res = await window.api.createInitialAdmin(data);
    if (res.success) {
      await checkAuth();
    }
    return res;
  };

  const logout = async () => {
    try {
      // @ts-ignore
      await window.api.logout();
      setUser(null);
      setMustChangePin(false);
    } catch (e) {
      console.error('Logout failed', e);
    }
  };

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
      login, // Exposes updated signature
      logout,
      checkAuth,
      changePin,
      checkAdminExists,
      createInitialAdmin
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
