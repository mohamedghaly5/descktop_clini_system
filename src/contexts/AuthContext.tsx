import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserRoleInfo {
  role: AppRole;
  clinic_id: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  clinicId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, clinicName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Arabic error messages mapping
const getArabicError = (error: string): string => {
  const errorMap: Record<string, string> = {
    'Invalid login credentials': 'بيانات الدخول غير صحيحة',
    'Email not confirmed': 'البريد الإلكتروني غير مؤكد',
    'User already registered': 'المستخدم مسجل بالفعل',
    'Password should be at least 6 characters': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    'Email rate limit exceeded': 'تم تجاوز الحد المسموح للبريد الإلكتروني',
    'For security purposes, you can only request this once every 60 seconds': 'لأسباب أمنية، يمكنك طلب هذا مرة واحدة كل 60 ثانية',
    'New password should be different from the old password': 'كلمة المرور الجديدة يجب أن تكون مختلفة عن القديمة',
    'Access denied': 'الوصول مرفوض - لا توجد صلاحيات',
  };
  
  // Check for partial matches
  for (const [key, value] of Object.entries(errorMap)) {
    if (error.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return error;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user role and clinic_id
  const fetchUserRoleInfo = async (userId: string): Promise<UserRoleInfo | null> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, clinic_id')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching role:', error);
        return null;
      }
      
      if (data) {
        return {
          role: data.role,
          clinic_id: data.clinic_id
        };
      }
      return null;
    } catch (err) {
      console.error('Error in fetchUserRoleInfo:', err);
      return null;
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        // Defer role fetching with setTimeout to prevent deadlock
        if (currentSession?.user) {
          setTimeout(() => {
            fetchUserRoleInfo(currentSession.user.id).then(info => {
              if (info) {
                setRole(info.role);
                setClinicId(info.clinic_id);
              } else {
                setRole(null);
                setClinicId(null);
              }
            });
          }, 0);
        } else {
          setRole(null);
          setClinicId(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      
      if (existingSession?.user) {
        fetchUserRoleInfo(existingSession.user.id).then(info => {
          if (info) {
            setRole(info.role);
            setClinicId(info.clinic_id);
          }
        });
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: new Error(getArabicError(error.message)) };
      }

      // Check if user has a role
      if (data.user) {
        const userRoleInfo = await fetchUserRoleInfo(data.user.id);
        if (!userRoleInfo) {
          await supabase.auth.signOut();
          return { error: new Error('الوصول مرفوض - لا توجد صلاحيات لهذا الحساب') };
        }
        setRole(userRoleInfo.role);
        setClinicId(userRoleInfo.clinic_id);
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, clinicName: string): Promise<{ error: Error | null }> => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      // First, create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) {
        return { error: new Error(getArabicError(authError.message)) };
      }

      // If user was created successfully, create clinic and assign role
      if (authData.user) {
        const { error: clinicError } = await supabase.rpc('create_clinic_with_owner', {
          _user_id: authData.user.id,
          _clinic_name: clinicName,
          _owner_name: fullName
        });

        if (clinicError) {
          console.error('Error creating clinic:', clinicError);
          // Don't fail signup if clinic creation fails, user can set up later
        }
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setClinicId(null);
  };

  const resetPassword = async (email: string): Promise<{ error: Error | null }> => {
    try {
      const redirectUrl = `${window.location.origin}/update-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (error) {
        return { error: new Error(getArabicError(error.message)) };
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const updatePassword = async (newPassword: string): Promise<{ error: Error | null }> => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { error: new Error(getArabicError(error.message)) };
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        clinicId,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
