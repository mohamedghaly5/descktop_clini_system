import React from 'react';
import { Stethoscope } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-glow mx-auto">
              <Stethoscope className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-muted-foreground">{subtitle}</p>
            )}
          </div>

          {/* Form Container */}
          <div className="bg-card rounded-2xl border border-border p-8 shadow-lg">
            {children}
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground">
            نظام إدارة عيادات الأسنان
          </p>
        </div>
      </div>

      {/* Right Side - Image/Decoration */}
      <div className="hidden lg:flex flex-1 gradient-primary items-center justify-center p-12 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 left-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative text-center text-white space-y-6 max-w-lg">
          <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto">
            <Stethoscope className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-4xl font-bold">دينتا كير</h2>
          <p className="text-xl text-white/80 leading-relaxed">
            نظام متكامل لإدارة عيادات الأسنان بكفاءة عالية
          </p>
          <div className="flex justify-center gap-8 pt-8">
            <div className="text-center">
              <div className="text-3xl font-bold">+500</div>
              <div className="text-sm text-white/70">عيادة</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">+10K</div>
              <div className="text-sm text-white/70">مريض</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">+50K</div>
              <div className="text-sm text-white/70">موعد</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
