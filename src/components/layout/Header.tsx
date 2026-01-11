import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Search, Globe, User, LogOut, Check, Info, AlertTriangle, AlertCircle, XCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { logger } from '@/utils/logger';

interface HeaderProps {
  sidebarCollapsed: boolean;
}

interface Notification {
  id: string;
  title: string;
  message?: string;
  body?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  created_at: string;
  read?: boolean;
  is_read?: boolean;
  link?: string;
  user_id?: string | null;
}

const Header: React.FC<HeaderProps> = ({ sidebarCollapsed }) => {
  const { t, language, setLanguage } = useLanguage();
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      // @ts-ignore
      const result = await window.api.getNotifications(user.id);

      if (result.success && result.data) {
        const localReadIds = JSON.parse(localStorage.getItem('read_notifications') || '[]');

        const mergedNotifications = result.data.map((n: any) => ({
          ...n,
          read: n.read || localReadIds.includes(n.id),
          is_read: n.is_read || localReadIds.includes(n.id)
        }));

        setNotifications(mergedNotifications);
        const count = mergedNotifications.filter((n: any) => !(n.read || n.is_read)).length;
        setUnreadCount(count);
      } else {
        logger.error('Error fetching notifications:', result.error);
      }
    } catch (err) {
      logger.error('Failed to fetch notifications', err);
    }
  }, [user]);

  // Initial Fetch
  useEffect(() => {
    fetchNotifications();
    const handleOnline = () => fetchNotifications();
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      const localReadIds = JSON.parse(localStorage.getItem('read_notifications') || '[]');
      if (!localReadIds.includes(id)) {
        localReadIds.push(id);
        localStorage.setItem('read_notifications', JSON.stringify(localReadIds));
      }
    } catch (e) {
      logger.error('Failed to save read status locally', e);
    }
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'success': return <Check className="w-4 h-4 text-green-500" />;
      default: return <Info className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <header
      className={cn(
        "fixed top-0 h-16 bg-background/80 backdrop-blur-md border-b border-border z-30 transition-all duration-300 flex items-center justify-between px-6",
        "inset-inline-start-0 end-0",
        sidebarCollapsed ? "ms-[72px]" : "ms-64"
      )}
    >
      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('search') + '...'}
            className="w-full bg-secondary/50 border-0 focus-visible:ring-1 ps-10 pe-4"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Language Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Globe className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-popover z-50">
            <DropdownMenuItem
              onClick={() => setLanguage('en')}
              className={cn(language === 'en' && "bg-accent")}
            >
              <span className="me-2">🇺🇸</span>
              {t('english')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLanguage('ar')}
              className={cn(language === 'ar' && "bg-accent")}
            >
              <span className="me-2">🇸🇦</span>
              {t('arabic')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 end-1.5 w-2 h-2 bg-destructive rounded-full animate-pulse ring-2 ring-background" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden bg-popover z-50">
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{t('notifications') || (language === 'ar' ? 'الإشعارات' : 'Notifications')}</h4>
                {unreadCount > 0 && <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">{unreadCount}</span>}
              </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  {language === 'ar' ? 'لا توجد إشعارات جديدة' : 'No new notifications'}
                </div>
              ) : (
                notifications.map(notif => (
                  <DropdownMenuItem
                    key={notif.id}
                    className={cn(
                      "flex items-start gap-3 p-4 cursor-pointer focus:bg-accent/50",
                      !(notif.read || notif.is_read) ? "bg-accent/10" : "opacity-70"
                    )}
                    onClick={() => {
                      markAsRead(notif.id);
                      if (notif.link) navigate(notif.link);
                    }}
                  >
                    <div className="mt-1 shrink-0">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-tight">{notif.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notif.message || notif.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: language === 'ar' ? arSA : enUS })}
                      </p>
                    </div>
                    {!(notif.read || notif.is_read) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
                <User className="w-4 h-4 text-primary-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover z-50 w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name || 'User'}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.role || 'Staff'}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              {t('settings')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/change-pin')}>
              Change PIN
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Switch User</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
