import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Receipt, Info } from 'lucide-react';
import { usePricing } from '@/contexts/PricingContext';
import { useSettings } from '@/contexts/SettingsContext';

const FixedExpensesSection: React.FC = () => {
  const { clinicCostSettings, updateClinicCostSettings } = usePricing();
  const { getCurrencySymbol } = useSettings();
  const currencySymbol = getCurrencySymbol('ar');

  const expenses = [
    { key: 'rent', label: 'الإيجار', placeholder: 'الإيجار الشهري' },
    { key: 'utilities', label: 'المرافق (كهرباء، مياه، إنترنت)', placeholder: '0' },
    { key: 'assistantSalary', label: 'راتب المساعد', placeholder: '0' },
    { key: 'doctorSalary', label: 'راتب الطبيب', placeholder: '0', hint: 'لو انت صاحب العيادة ممكن تخليها 0' },
    { key: 'marketing', label: 'مصاريف التسويق', placeholder: '0' },
    { key: 'transportation', label: 'المواصلات', placeholder: '0' },
    { key: 'emergency', label: 'طوارئ / متنوعات', placeholder: '0' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 justify-start flex-row-reverse">
          <span>المصاريف الثابتة الشهرية</span>
          <Receipt className="w-5 h-5 text-primary" />
        </CardTitle>
        <CardDescription className="text-end">
          أدخل المصاريف الشهرية الثابتة للعيادة
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {expenses.map((expense) => (
            <div key={expense.key} className="space-y-2">
              <Label htmlFor={expense.key} className="block text-right">{expense.label} ({currencySymbol})</Label>
              <Input
                id={expense.key}
                type="number"
                min="0"
                value={clinicCostSettings[expense.key as keyof typeof clinicCostSettings] === 0 ? '' : clinicCostSettings[expense.key as keyof typeof clinicCostSettings] as number}
                onChange={(e) => updateClinicCostSettings({
                  [expense.key]: e.target.value === '' ? 0 : parseFloat(e.target.value)
                })}
                className="text-right"
                placeholder={expense.placeholder}
              />
              {expense.hint && (
                <div className="flex flex-row-reverse items-center justify-start gap-1 text-xs text-muted-foreground">
                  <span>{expense.hint}</span>
                  <Info className="w-3 h-3" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-muted/50 rounded-lg p-4 border border-border space-y-3">
          <div className="flex items-center justify-between flex-row-reverse">
            <span className="text-sm text-muted-foreground">إجمالي المصاريف الثابتة الشهرية</span>
            <span className="text-lg font-bold">
              {currencySymbol} {clinicCostSettings.totalFixedExpenses.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3 flex-row-reverse">
            <span className="text-sm text-muted-foreground">تكلفة المصاريف الثابتة في الساعة</span>
            <span className="text-lg font-bold text-primary">
              {currencySymbol} {clinicCostSettings.fixedHourlyCost.toFixed(2)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FixedExpensesSection;
