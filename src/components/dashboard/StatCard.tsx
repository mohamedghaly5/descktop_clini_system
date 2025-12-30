import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  variant?: 'primary' | 'accent' | 'success' | 'info';
  delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  variant = 'primary',
  delay = 0,
}) => {
  const { t, isRTL } = useLanguage();

  const iconBgClasses = {
    primary: 'gradient-primary',
    accent: 'gradient-accent',
    success: 'gradient-success',
    info: 'bg-info',
  };

  const trendPositive = trend !== undefined && trend >= 0;

  return (
    <Card 
      variant="stat" 
      className={cn(
        "p-6 animate-fade-in opacity-0",
        `delay-${delay}`
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={cn("flex items-start justify-between", isRTL && "flex-row-reverse")}>
        <div className={cn("space-y-2", isRTL && "text-right")}>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground animate-count-up">{value}</p>
          {trend !== undefined && (
            <div className={cn(
              "flex items-center gap-1 text-sm",
              isRTL && "flex-row-reverse",
              trendPositive ? "text-success" : "text-destructive"
            )}>
              {trendPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span className="font-medium">{Math.abs(trend)}%</span>
              <span className="text-muted-foreground">{trendLabel || t('vsLastMonth')}</span>
            </div>
          )}
        </div>
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shadow-md",
          iconBgClasses[variant]
        )}>
          <Icon className="w-6 h-6 text-primary-foreground" />
        </div>
      </div>
    </Card>
  );
};

export default StatCard;
