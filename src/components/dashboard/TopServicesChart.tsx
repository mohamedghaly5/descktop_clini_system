import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

const mockData = [
  { service: 'Cleaning', serviceAr: 'تنظيف', count: 45, revenue: 9000 },
  { service: 'Filling', serviceAr: 'حشو', count: 32, revenue: 16000 },
  { service: 'Root Canal', serviceAr: 'علاج جذور', count: 18, revenue: 27000 },
  { service: 'Extraction', serviceAr: 'خلع', count: 25, revenue: 12500 },
  { service: 'Whitening', serviceAr: 'تبييض', count: 12, revenue: 12000 },
];

const COLORS = [
  'hsl(187, 69%, 42%)',
  'hsl(15, 90%, 60%)',
  'hsl(152, 69%, 42%)',
  'hsl(210, 80%, 55%)',
  'hsl(38, 92%, 50%)',
];

const TopServicesChart: React.FC = () => {
  const { t, language, isRTL } = useLanguage();

  const data = mockData.map(item => ({
    ...item,
    name: language === 'ar' ? item.serviceAr : item.service,
  }));

  return (
    <Card variant="elevated" className="animate-fade-in opacity-0 delay-300" style={{ animationDelay: '300ms' }}>
      <CardHeader>
        <CardTitle>{t('topServices')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" horizontal={true} vertical={false} />
              <XAxis 
                type="number" 
                stroke="hsl(210, 15%, 45%)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                stroke="hsl(210, 15%, 45%)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={80}
                orientation={isRTL ? 'right' : 'left'}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(0, 0%, 100%)',
                  border: '1px solid hsl(210, 20%, 90%)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'count') return [value, isRTL ? 'عدد المرات' : 'Count'];
                  return [value, name];
                }}
              />
              <Bar 
                dataKey="count" 
                radius={[0, 4, 4, 0]}
                barSize={24}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default TopServicesChart;
