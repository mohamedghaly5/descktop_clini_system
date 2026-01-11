import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, CalendarPlus, FileText, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface DashboardQuickActionsProps {
  onNewAppointment: () => void;
}

const DashboardQuickActions: React.FC<DashboardQuickActionsProps> = ({
  onNewAppointment,
}) => {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const actions = [
    {
      icon: CalendarPlus,
      label: language === 'ar' ? 'موعد جديد' : 'New Appointment',
      variant: 'gradient' as const,
      onClick: onNewAppointment
    },
    {
      icon: UserPlus,
      label: language === 'ar' ? 'مريض جديد' : 'New Patient',
      variant: 'gradientAccent' as const,
      onClick: () => navigate('/patients/new')
    },
    {
      icon: FileText,
      label: language === 'ar' ? 'تقرير اليوم' : 'Daily Report',
      variant: 'secondary' as const,
      onClick: () => navigate('/reports')
    },
    {
      icon: Plus,
      label: language === 'ar' ? 'إضافة مصروف' : 'Add Expense',
      variant: 'secondary' as const,
      onClick: () => navigate('/expenses?action=add')
    },
  ];

  return (
    <Card variant="elevated" className="animate-fade-in opacity-0 delay-300" style={{ animationDelay: '300ms' }}>
      <CardHeader>
        <CardTitle>{language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant}
              className="justify-center gap-3 h-12"
              onClick={action.onClick}
            >
              <action.icon className="w-5 h-5" />
              <span className="font-medium">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardQuickActions;
