import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, TrendingUp } from 'lucide-react';
import { usePricing } from '@/contexts/PricingContext';
import { useSettings } from '@/contexts/SettingsContext';

const ClinicHourlyCostSummary: React.FC = () => {
  const { clinicCostSettings } = usePricing();
  const { getCurrencySymbol } = useSettings();
  const currencySymbol = getCurrencySymbol('ar');

  const costItems = [
    {
      label: 'تكلفة المعدات في الساعة',
      value: clinicCostSettings.hourlyEquipmentCost,
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'تكلفة المصاريف الثابتة في الساعة',
      value: clinicCostSettings.fixedHourlyCost,
      color: 'text-orange-600 dark:text-orange-400',
    },
  ];

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <span>التكلفة النهائية للساعة</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {costItems.map((item, index) => (
            <div key={index} className="flex items-center justify-start gap-4 p-3 bg-background rounded-lg border border-border">
              <span className="text-sm text-muted-foreground w-1/2">{item.label}</span>
              <div className={`flex items-baseline gap-1 font-semibold ${item.color}`}>
                <span className="text-xs font-normal text-muted-foreground">{currencySymbol}</span>
                <span>{item.value.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-primary/10 rounded-xl p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">تكلفة تشغيل العيادة في الساعة</span>
          </div>
          <div className="flex items-baseline justify-center gap-1 text-4xl font-bold text-primary">
            <span className="text-xl font-normal text-primary/70">{currencySymbol}</span>
            <span>{clinicCostSettings.finalClinicHourlyCost.toFixed(2)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            هذه القيمة تستخدم في حساب تكلفة كل خدمة
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClinicHourlyCostSummary;
