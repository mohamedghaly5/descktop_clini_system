import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, CalendarPlus, FileText, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const QuickActions: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();

  const actions = [
    { 
      icon: UserPlus, 
      label: t('newPatient'), 
      variant: 'gradient' as const,
      onClick: () => navigate('/patients/new')
    },
    { 
      icon: CalendarPlus, 
      label: t('newAppointment'), 
      variant: 'gradientAccent' as const,
      onClick: () => navigate('/appointments/new')
    },
    { 
      icon: FileText, 
      label: t('viewReports'), 
      variant: 'secondary' as const,
      onClick: () => navigate('/reports')
    },
    { 
      icon: Download, 
      label: t('export'), 
      variant: 'outline' as const,
      onClick: () => {}
    },
  ];

  return (
    <Card variant="elevated" className="animate-fade-in opacity-0 delay-300" style={{ animationDelay: '300ms' }}>
      <CardHeader>
        <CardTitle>{t('quickActions')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "grid grid-cols-2 gap-3",
          isRTL && "direction-rtl"
        )}>
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant}
              className={cn(
                "h-auto py-4 flex-col gap-2",
                isRTL && "flex-row-reverse"
              )}
              onClick={action.onClick}
            >
              <action.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickActions;
