import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock } from 'lucide-react';
import { usePricing } from '@/contexts/PricingContext';

const WorkingHoursSection: React.FC = () => {
  const { clinicCostSettings, updateClinicCostSettings } = usePricing();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <span>ساعات العمل</span>
        </CardTitle>
        <CardDescription className="text-right">
          حدد ساعات عمل العيادة لحساب التكلفة الشهرية
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="workingDaysPerWeek" className="block text-right">أيام العمل أسبوعياً</Label>
            <Input
              id="workingDaysPerWeek"
              type="number"
              min="1"
              max="7"
              value={clinicCostSettings.workingDaysPerWeek === 0 ? '' : clinicCostSettings.workingDaysPerWeek}
              onChange={(e) => updateClinicCostSettings({
                workingDaysPerWeek: e.target.value === '' ? 0 : parseFloat(e.target.value)
              })}
              className="text-right"
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workingHoursPerDay" className="block text-right">ساعات العمل يومياً</Label>
            <Input
              id="workingHoursPerDay"
              type="number"
              min="1"
              max="24"
              value={clinicCostSettings.workingHoursPerDay === 0 ? '' : clinicCostSettings.workingHoursPerDay}
              onChange={(e) => updateClinicCostSettings({
                workingHoursPerDay: e.target.value === '' ? 0 : parseFloat(e.target.value)
              })}
              className="text-right"
              placeholder="0"
            />
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 border border-border">
          <div className="flex items-center justify-start gap-4">
            <span className="text-sm text-muted-foreground">ساعات العمل الشهرية:</span>
            <div className="flex items-center gap-1 font-bold text-lg text-primary">
              <span>{clinicCostSettings.monthlyWorkingHours.toFixed(0)}</span>
              <span className="text-sm font-normal">ساعة</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right">
            = {clinicCostSettings.workingHoursPerDay} ساعة × {clinicCostSettings.workingDaysPerWeek} يوم × 4 أسابيع
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkingHoursSection;
