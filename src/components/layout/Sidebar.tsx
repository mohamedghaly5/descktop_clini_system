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

  LogOut,
  FlaskConical,
  Landmark,
  Box,
  PanelLeftClose,
  PanelLeftOpen
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
  const { t } = useLanguage();
  const { clinicInfo } = useSettings();
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const mainNavItems = [
    { path: '/', icon: LayoutDashboard, label: t('dashboard') },
    { path: '/patients', icon: Users, label: t('patients') },
    { path: '/appointments', icon: Calendar, label: t('appointments') },
    { path: '/lab-orders', icon: FlaskConical, label: t('lab.orders') },
  ];

  const adminNavItems = [
    { path: '/accounts', icon: Landmark, label: t('accounts') },
    { path: '/expenses', icon: Receipt, label: t('expenses.label') },
    { path: '/reports', icon: BarChart3, label: t('reports') },
    { path: '/stock', icon: Box, label: 'المخزن' },

    { path: '/settings', icon: Settings, label: t('settings') },
  ].filter(item => {
    // Hide Pricing and Reports in Client Mode (Remote Access)
    const isClientMode = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    if (isClientMode && (item.path === '/reports')) return false;

    // Permissions Check
    if (item.path === '/expenses') {
      if (user?.role !== 'admin' && !user?.permissions?.includes('VIEW_EXPENSES')) {
        return false;
      }
    }

    if (item.path === '/stock') {
      if (user?.role !== 'admin' && !user?.permissions?.includes('VIEW_STOCK')) {
        return false;
      }
    }

    if (item.path === '/settings') {
      if (user?.role !== 'admin' && !user?.permissions?.includes('VIEW_SETTINGS')) {
        return false;
      }
    }

    return true;
  });

  const handleSignOut = async () => {
    try {
      await logout();
      toast.success(t('logout'));
      navigate('/login', { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const NavItem = ({ item }: { item: any }) => (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative",
          collapsed ? "justify-center px-2" : "",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm font-medium"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )
      }
      title={collapsed ? item.label : undefined}
    >
      <item.icon className={cn(
        "w-5 h-5 flex-shrink-0 transition-transform duration-200",
        "group-hover:scale-110"
      )} />
      {!collapsed && (
        <span className="text-sm animate-fade-in">{item.label}</span>
      )}
    </NavLink>
  );

  return (
    <aside
      className={cn(
        "fixed top-0 h-screen bg-sidebar text-sidebar-foreground z-40 transition-all duration-300 flex flex-col shadow-xl",
        "inset-inline-start-0 border-e border-sidebar-border",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-16 px-4 border-b border-sidebar-border/50 flex-shrink-0 bg-sidebar/50 backdrop-blur",
        collapsed ? "justify-center" : "gap-3"
      )}>
        {clinicInfo.logo ? (
          <img
            src={clinicInfo.logo}
            alt={clinicInfo.name}
            className="w-9 h-9 rounded-lg object-contain flex-shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
            <Stethoscope className="w-5 h-5 text-primary-foreground" />
          </div>
        )}
        {!collapsed && (
          <span className="font-bold text-base text-sidebar-foreground animate-fade-in truncate">
            {clinicInfo.name || 'عيادتي'}
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-6 overflow-y-auto scrollbar-hide">

        {/* Main Section */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
              {t('القسم الأساسي') || 'القسم الأساسي'}
            </div>
          )}
          {mainNavItems.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </div>

        {/* Separator if collapsed to show grouping distinctness */}
        {collapsed && <div className="h-px bg-sidebar-border/50 mx-2" />}

        {/* Admin Section */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-3 mb-2 mt-4 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider flex items-center gap-2">
              <span>{t('القسم الإداري') || 'القسم الإداري'}</span>
              <div className="h-px bg-sidebar-border/50 flex-1" />
            </div>
          )}
          {adminNavItems.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </div>

      </nav>

      {/* Footer Actions */}
      <div className="p-3 border-t border-sidebar-border space-y-1 bg-sidebar/50">

        {/* Collapse Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "w-full justify-start text-sidebar-foreground/60 hover:text-primary hover:bg-primary/5",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          {!collapsed && <span className="mx-2 text-sm">{t('collapse')}</span>}
        </Button>

        {/* Logout Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className={cn(
            "w-full justify-start text-red-500/80 hover:text-red-600 hover:bg-red-50",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="mx-2 text-sm">{t('logout')}</span>}
        </Button>

      </div>
    </aside>
  );
};

export default Sidebar;
