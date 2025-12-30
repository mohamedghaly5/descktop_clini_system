import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, DollarSign, AlertTriangle, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';
import { Appointment, Invoice } from '@/services/appointmentService';

interface DashboardKPICardsProps {
  todayAppointments: Appointment[];
  todayInvoices: Invoice[];
  allInvoices: Invoice[];
}

const DashboardKPICards: React.FC<DashboardKPICardsProps> = ({
  todayAppointments,
  todayInvoices,
  allInvoices,
}) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { formatCurrency, getCurrencySymbol } = useSettings();

  const currencySymbol = getCurrencySymbol(language as 'en' | 'ar');

  // Calculate KPIs
  const attendedToday = todayAppointments.filter(a => a.status === 'attended').length;
  const notAttendedToday = todayAppointments.filter(a => a.status === 'booked' || a.status === 'confirmed').length;
  const cancelledToday = todayAppointments.filter(a => a.status === 'cancelled').length;

  const todayIncome = todayInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  
  const outstandingBalance = allInvoices.reduce((sum, inv) => sum + inv.balance, 0);

  // Get top service today
  const serviceCount: Record<string, number> = {};
  todayInvoices.forEach(inv => {
    const name = inv.serviceName;
    serviceCount[name] = (serviceCount[name] || 0) + 1;
  });
  const topService = Object.entries(serviceCount).sort((a, b) => b[1] - a[1])[0];

  const kpis = [
    {
      title: language === 'ar' ? 'مواعيد اليوم' : "Today's Appointments",
      value: todayAppointments.length.toString(),
      subItems: [
        { label: language === 'ar' ? 'حضر' : 'Attended', value: attendedToday, color: 'text-success' },
        { label: language === 'ar' ? 'لم يحضر' : 'Not Attended', value: notAttendedToday, color: 'text-warning' },
        { label: language === 'ar' ? 'ملغي' : 'Cancelled', value: cancelledToday, color: 'text-destructive' },
      ],
      icon: Calendar,
      gradient: 'gradient-primary',
      onClick: () => navigate('/appointments'),
      clickable: true,
    },
    {
      title: language === 'ar' ? 'دخل اليوم' : "Today's Income",
      value: formatCurrency(todayIncome, language),
      icon: DollarSign,
      gradient: 'gradient-success',
      onClick: () => navigate('/accounts'),
      clickable: true,
    },
    {
      title: language === 'ar' ? 'الرصيد المستحق' : 'Outstanding Balance',
      value: formatCurrency(outstandingBalance, language),
      icon: AlertTriangle,
      gradient: 'gradient-accent',
      onClick: () => navigate('/accounts'),
      clickable: true,
    },
    {
      title: language === 'ar' ? 'الخدمة الأكثر اليوم' : 'Top Service Today',
      value: topService ? topService[0] : (language === 'ar' ? 'لا يوجد' : 'None'),
      subText: topService ? `${topService[1]} ${language === 'ar' ? 'مرة' : 'times'}` : '',
      icon: Star,
      gradient: 'bg-info',
      clickable: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, index) => (
        <Card
          key={kpi.title}
          variant="stat"
          className={cn(
            "p-5 animate-fade-in opacity-0 transition-all",
            kpi.clickable && "cursor-pointer hover:shadow-lg hover:scale-[1.02]"
          )}
          style={{ animationDelay: `${index * 100}ms` }}
          onClick={kpi.clickable ? kpi.onClick : undefined}
        >
          {/* Header: Title + Icon */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-muted-foreground">
              {kpi.title}
            </p>
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shadow-md shrink-0",
              kpi.gradient
            )}>
              <kpi.icon className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>

          {/* Body: Numbers and Stats */}
          <div className="space-y-1">
            <p className="text-2xl font-bold text-foreground ltr-nums">{kpi.value}</p>
            
            {kpi.subItems && (
              <div className="flex flex-wrap gap-2 pt-1">
                {kpi.subItems.map((item) => (
                  <span key={item.label} className={cn("text-xs", item.color)}>
                    {item.label}: <span className="ltr-nums">{item.value}</span>
                  </span>
                ))}
              </div>
            )}
            
            {kpi.subText && (
              <p className="text-xs text-muted-foreground ltr-nums">{kpi.subText}</p>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};

export default DashboardKPICards;
