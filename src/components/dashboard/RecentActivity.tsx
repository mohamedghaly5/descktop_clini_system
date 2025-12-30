import React from 'react';
import { User, Calendar, DollarSign, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface Activity {
  id: number;
  type: 'patient' | 'appointment' | 'payment';
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
  time: string;
}

const mockActivities: Activity[] = [
  {
    id: 1,
    type: 'patient',
    titleEn: 'New Patient Registered',
    titleAr: 'تسجيل مريض جديد',
    descEn: 'Ahmed Hassan joined the clinic',
    descAr: 'انضم أحمد حسن إلى العيادة',
    time: '10 min',
  },
  {
    id: 2,
    type: 'appointment',
    titleEn: 'Appointment Completed',
    titleAr: 'تم إكمال الموعد',
    descEn: 'Root canal treatment for Sara',
    descAr: 'علاج جذور لسارة',
    time: '25 min',
  },
  {
    id: 3,
    type: 'payment',
    titleEn: 'Payment Received',
    titleAr: 'تم استلام الدفعة',
    descEn: 'SAR 500 for cleaning service',
    descAr: 'ر.س 500 لخدمة التنظيف',
    time: '1 hr',
  },
  {
    id: 4,
    type: 'appointment',
    titleEn: 'Appointment Scheduled',
    titleAr: 'تم جدولة موعد',
    descEn: 'Checkup for Mohammed tomorrow',
    descAr: 'فحص لمحمد غداً',
    time: '2 hr',
  },
];

const RecentActivity: React.FC = () => {
  const { t, isRTL, language } = useLanguage();

  const getIcon = (type: Activity['type']) => {
    switch (type) {
      case 'patient':
        return User;
      case 'appointment':
        return Calendar;
      case 'payment':
        return DollarSign;
      default:
        return User;
    }
  };

  const getIconBg = (type: Activity['type']) => {
    switch (type) {
      case 'patient':
        return 'bg-primary/10 text-primary';
      case 'appointment':
        return 'bg-info/10 text-info';
      case 'payment':
        return 'bg-success/10 text-success';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card variant="elevated" className="animate-fade-in opacity-0 delay-400" style={{ animationDelay: '400ms' }}>
      <CardHeader>
        <CardTitle>{t('recentActivity')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {mockActivities.map((activity) => {
          const Icon = getIcon(activity.type);
          return (
            <div
              key={activity.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer",
                isRTL && "flex-row-reverse"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                getIconBg(activity.type)
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
                <p className="font-medium text-sm text-foreground truncate">
                  {language === 'ar' ? activity.titleAr : activity.titleEn}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {language === 'ar' ? activity.descAr : activity.descEn}
                </p>
              </div>
              <div className={cn(
                "flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0",
                isRTL && "flex-row-reverse"
              )}>
                <Clock className="w-3 h-3" />
                <span>{activity.time}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
