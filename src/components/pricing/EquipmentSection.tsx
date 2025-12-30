import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings2, Info } from 'lucide-react';
import { usePricing } from '@/contexts/PricingContext';
import { useSettings } from '@/contexts/SettingsContext';

const EquipmentSection: React.FC = () => {
  const { clinicCostSettings, updateClinicCostSettings } = usePricing();
  const { getCurrencySymbol } = useSettings();
  const currencySymbol = getCurrencySymbol('ar');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 justify-start flex-row-reverse">
          <span>تكلفة المعدات والإهلاك</span>
          <Settings2 className="w-5 h-5 text-primary" />
        </CardTitle>
        <CardDescription className="text-end">
          حساب التكلفة السنوية لمعدات العيادة
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="recoveryPeriodYears" className="block text-right">فترة الاسترداد (بالسنوات)</Label>
            <Input
              id="recoveryPeriodYears"
              type="number"
              min="1"
              max="20"
              value={clinicCostSettings.recoveryPeriodYears === 0 ? '' : clinicCostSettings.recoveryPeriodYears}
              onChange={(e) => updateClinicCostSettings({
                recoveryPeriodYears: e.target.value === '' ? 0 : parseInt(e.target.value)
              })}
              className="text-right"
              placeholder="5"
            />
            <div className="flex flex-row-reverse items-center justify-start gap-1 text-xs text-muted-foreground">
              <span>الطبيعي في أغلب العيادات 5 سنوات</span>
              <Info className="w-3 h-3" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="totalEquipmentCost" className="block text-right">إجمالي تكلفة المعدات ({currencySymbol})</Label>
            <Input
              id="totalEquipmentCost"
              type="number"
              min="0"
              value={clinicCostSettings.totalEquipmentCost === 0 ? '' : clinicCostSettings.totalEquipmentCost}
              onChange={(e) => updateClinicCostSettings({
                totalEquipmentCost: e.target.value === '' ? 0 : parseFloat(e.target.value)
              })}
              className="text-right"
              placeholder="0"
            />
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between flex-row-reverse">
            <span className="text-sm text-muted-foreground">تكلفة المعدات في الساعة</span>
            <span className="text-lg font-bold text-primary">
              {currencySymbol} {clinicCostSettings.hourlyEquipmentCost.toFixed(2)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-2 text-right">
            <p>= التكلفة السنوية / 12 شهر / 30 يوم / ساعات العمل يومياً</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EquipmentSection;
