import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, mustChangePin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading system...</p>
        </div>
      </div>
    );
  }

  // 1. Auth Check (Priority #1)
  if (!user) {
    return <Navigate to="/select-user" state={{ from: location }} replace />;
  }

  // 2. FORCE PIN CHANGE
  if (mustChangePin) {
    if (location.pathname !== '/change-pin') {
      return <Navigate to="/change-pin" replace />;
    }
    // If on /change-pin, allow rendering
    return <>{children}</>;
  } else {
    // If user tries to access change-pin but doesn't need to
    if (location.pathname === '/change-pin') {
      return <Navigate to="/" replace />;
    }
  }



  return <>{children}</>;
};

export default ProtectedRoute;
