import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

const mockData = [
  { day: 'Sat', dayAr: 'سبت', income: 2400 },
  { day: 'Sun', dayAr: 'أحد', income: 1398 },
  { day: 'Mon', dayAr: 'إثنين', income: 3800 },
  { day: 'Tue', dayAr: 'ثلاثاء', income: 3908 },
  { day: 'Wed', dayAr: 'أربعاء', income: 4800 },
  { day: 'Thu', dayAr: 'خميس', income: 3800 },
  { day: 'Fri', dayAr: 'جمعة', income: 4300 },
];

const IncomeChart: React.FC = () => {
  const { t, language, isRTL } = useLanguage();

  const data = mockData.map(item => ({
    ...item,
    name: language === 'ar' ? item.dayAr : item.day,
  }));

  return (
    <Card variant="elevated" className="animate-fade-in opacity-0 delay-200" style={{ animationDelay: '200ms' }}>
      <CardHeader>
        <CardTitle>{t('dailyIncome')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={isRTL ? [...data].reverse() : data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(187, 69%, 42%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(187, 69%, 42%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(210, 15%, 45%)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                reversed={isRTL}
              />
              <YAxis 
                stroke="hsl(210, 15%, 45%)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
                orientation={isRTL ? 'right' : 'left'}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(0, 0%, 100%)',
                  border: '1px solid hsl(210, 20%, 90%)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value: number) => [`${t('currency')} ${value}`, t('totalIncome')]}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="hsl(187, 69%, 42%)"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#incomeGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default IncomeChart;
