import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Receipt,
  BarChart3,
  Settings,
  Stethoscope,
  ChevronRight,
  Calculator,
  LogOut,
  FlaskConical,
  Landmark,
  KeyRound
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { t, language } = useLanguage();
  const { clinicInfo } = useSettings();
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: t('dashboard') },
    { path: '/patients', icon: Users, label: t('patients') },
    { path: '/appointments', icon: Calendar, label: t('appointments') },
    { path: '/expenses', icon: Receipt, label: t('expenses.label') },
    { path: '/accounts', icon: Landmark, label: t('accounts') },
    { path: '/reports', icon: BarChart3, label: t('reports') },
    { path: '/pricing', icon: Calculator, label: t('pricing') },
    { path: '/settings', icon: Settings, label: t('settings') },
  ];

  const handleSignOut = async () => {
    try {
      await logout();
      toast.success(t('logout'));
      navigate('/login', { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <aside
      className={cn(
        "fixed top-0 h-screen bg-sidebar text-sidebar-foreground z-40 transition-all duration-300 flex flex-col",
        "inset-inline-start-0 border-e border-sidebar-border",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-16 px-4 border-b border-sidebar-border",
        collapsed ? "justify-center" : "gap-3"
      )}>
        {clinicInfo.logo ? (
          <img
            src={clinicInfo.logo}
            alt={clinicInfo.name}
            className="w-10 h-10 rounded-xl object-contain flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow flex-shrink-0">
            <Stethoscope className="w-6 h-6 text-primary-foreground" />
          </div>
        )}
        {!collapsed && (
          <span className="font-bold text-lg text-sidebar-foreground animate-fade-in truncate">
            {clinicInfo.name || 'عيادتي'}
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )
            }
          >
            <item.icon className={cn(
              "w-5 h-5 flex-shrink-0 transition-transform duration-200",
              "group-hover:scale-110"
            )} />
            {!collapsed && (
              <span className="text-sm font-medium animate-fade-in">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Info & Logout */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        {/* User Email */}
        {!collapsed && user && (
          <div className="px-3 py-2 text-xs text-sidebar-foreground/60 truncate">
            {user.email}
          </div>
        )}

        {/* Logout Button */}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={handleSignOut}
          className={cn(
            "w-full text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10",
            collapsed && "px-0"
          )}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && (
            <span className="text-sm">{t('logout')}</span>
          )}
        </Button>

        {/* Collapse Button */}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={onToggle}
          className={cn(
            "w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            collapsed && "px-0"
          )}
        >
          <ChevronRight className={cn("w-5 h-5", !collapsed && "rotate-180")} />
          {!collapsed && (
            <span className="text-sm">{t('collapse')}</span>
          )}
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
