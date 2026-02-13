import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ReadOnlyBanner from './ReadOnlyBanner';
import LicenseBanner from '@/components/license/LicenseBanner';
import { cn } from '@/lib/utils';

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Default to collapsed in Browser Mode or Mobile to save space
    const isClient = !(window as any).electron;
    const isMobile = window.innerWidth < 1024;
    return isClient || isMobile;
  });

  // Listen for screen resize to auto-collapse on smaller screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && !sidebarCollapsed) {
        setSidebarCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);



  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 left-0 right-0 z-[60] flex flex-col">
        <ReadOnlyBanner />
        <LicenseBanner />
      </div>

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <Header sidebarCollapsed={sidebarCollapsed} />

      <main
        className={cn(
          "pt-24 min-h-screen transition-all duration-300",
          sidebarCollapsed ? "px-4 ms-[72px]" : "px-6 ms-64",
        )}
      >
        <div className="py-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
