import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Calendar, DollarSign, ChevronLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';
import { Appointment, Invoice } from '@/services/appointmentService';
import { ActivePlansDialog } from '@/components/dashboard/ActivePlansDialog';

interface DashboardAlertsProps {
  pastUnattendedAppointments: Appointment[];
  outstandingInvoices: Invoice[];
  patientsWithBalance: Array<{ patientId: string; patientName: string; balance: number }>;
}

const DashboardAlerts: React.FC<DashboardAlertsProps> = ({
  pastUnattendedAppointments,
  outstandingInvoices,
  patientsWithBalance,
}) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { formatCurrency } = useSettings();
  const [activePlansOpen, setActivePlansOpen] = useState(false);

  const alerts: Array<{
    icon: React.ElementType;
    title: string;
    count: number;
    description: string;
    color: string;
    bgColor: string;
    onClick: () => void;
  }> = [];

  // Add past unattended appointments alert
  if (pastUnattendedAppointments.length > 0) {
    alerts.push({
      icon: Calendar,
      title: language === 'ar' ? 'مواعيد سابقة لم تُسجل' : 'Past Unattended Appointments',
      count: pastUnattendedAppointments.length,
      description: language === 'ar'
        ? `${pastUnattendedAppointments.length} موعد لم يتم تسجيل الحضور له`
        : `${pastUnattendedAppointments.length} appointment(s) not marked attended`,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      onClick: () => navigate('/appointments'),
    });
  }

  // Add outstanding balance alert
  if (patientsWithBalance.length > 0) {
    const totalBalance = patientsWithBalance.reduce((sum, p) => sum + p.balance, 0);
    alerts.push({
      icon: DollarSign,
      title: language === 'ar' ? 'مرضى لديهم رصيد مستحق' : 'Patients with Outstanding Balance',
      count: patientsWithBalance.length,
      description: language === 'ar'
        ? `${patientsWithBalance.length} مريض - إجمالي: ${formatCurrency(totalBalance, language)}`
        : `${patientsWithBalance.length} patient(s) - Total: ${formatCurrency(totalBalance, language)}`,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      onClick: () => setActivePlansOpen(true),
    });
  }

  if (alerts.length === 0) {
    return null;
  }

  return (
    <>
      <Card variant="elevated" className="animate-fade-in opacity-0 delay-400" style={{ animationDelay: '400ms' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            {language === 'ar' ? 'تنبيهات' : 'Alerts'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.map((alert, index) => (
            <div
              key={index}
              onClick={alert.onClick}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:scale-[1.01]",
                alert.bgColor
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                alert.bgColor
              )}>
                <alert.icon className={cn("w-5 h-5", alert.color)} />
              </div>
              <div className="flex-1">
                <p className={cn("font-medium text-sm", alert.color)}>{alert.title}</p>
                <p className="text-xs text-muted-foreground">{alert.description}</p>
              </div>
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </div>
          ))}
        </CardContent>
      </Card>

      <ActivePlansDialog
        open={activePlansOpen}
        onOpenChange={setActivePlansOpen}
      />
    </>
  );
};

export default DashboardAlerts;
