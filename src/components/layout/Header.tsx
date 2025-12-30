import React from 'react';
import { Bell, Search, Globe, User } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface HeaderProps {
  sidebarCollapsed: boolean;
}

const Header: React.FC<HeaderProps> = ({ sidebarCollapsed }) => {
  const { t, language, setLanguage } = useLanguage();

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
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 end-1.5 w-2 h-2 bg-accent rounded-full animate-pulse" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
                <User className="w-4 h-4 text-primary-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-popover z-50">
            <DropdownMenuItem>
              {t('profile')}
            </DropdownMenuItem>
            <DropdownMenuItem>
              {t('settings')}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              {t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
