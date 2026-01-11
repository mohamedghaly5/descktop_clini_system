import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Plus, Trash2, Save, Calculator, Link2, X } from 'lucide-react';
import { usePricing, MaterialItem, IncludedService, PricedService } from '@/contexts/PricingContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';

interface ServiceCalculatorProps {
  editingService: PricedService | null;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
}

const ServiceCalculator: React.FC<ServiceCalculatorProps> = ({
  editingService,
  onCancelEdit,
  onSaveEdit,
}) => {
  const { clinicCostSettings, pricedServices, addPricedService, updatePricedService, calculateServiceCosts } = usePricing();
  const { getCurrencySymbol } = useSettings();
  const { toast } = useToast();
  const currencySymbol = getCurrencySymbol('ar');

  const [serviceName, setServiceName] = useState('');
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [includedServices, setIncludedServices] = useState<IncludedService[]>([]);
  const [serviceTimeHours, setServiceTimeHours] = useState(1);
  const [profitPercentage, setProfitPercentage] = useState(30);

  // Material form
  const [newMaterial, setNewMaterial] = useState({
    productName: '',
    productPrice: 0,
    casesServed: 1,
  });

  // Load editing service data
  useEffect(() => {
    if (editingService) {
      setServiceName(editingService.name);
      setMaterials(editingService.materials);
      setIncludedServices(editingService.includedServices);
      setServiceTimeHours(editingService.serviceTimeHours);
      setProfitPercentage(editingService.profitPercentage);
    } else {
      resetForm();
    }
  }, [editingService]);

  const resetForm = () => {
    setServiceName('');
    setMaterials([]);
    setIncludedServices([]);
    setServiceTimeHours(1);
    setProfitPercentage(30);
    setNewMaterial({ productName: '', productPrice: 0, casesServed: 1 });
  };

  const addMaterial = () => {
    if (!newMaterial.productName.trim()) {
      toast({ title: 'يرجى إدخال اسم المنتج', variant: 'destructive' });
      return;
    }
    const costPerCase = newMaterial.productPrice / (newMaterial.casesServed || 1);
    const material: MaterialItem = {
      id: Date.now().toString(),
      ...newMaterial,
      costPerCase,
    };
    setMaterials(prev => [...prev, material]);
    setNewMaterial({ productName: '', productPrice: 0, casesServed: 1 });
  };

  const removeMaterial = (id: string) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  const addIncludedService = (serviceId: string) => {
    const service = pricedServices.find(s => s.id === serviceId);
    if (!service) return;

    // Only include materials cost
    const included: IncludedService = {
      serviceId,
      materialsOnlyCost: service.totalMaterialsCost,
    };
    setIncludedServices(prev => [...prev, included]);
  };

  const removeIncludedService = (serviceId: string) => {
    setIncludedServices(prev => prev.filter(s => s.serviceId !== serviceId));
  };

  // Calculate live costs
  const liveCosts = calculateServiceCosts({
    materials,
    includedServices,
    serviceTimeHours,
    profitPercentage,
  });

  const saveService = () => {
    if (!serviceName.trim()) {
      toast({ title: 'يرجى إدخال اسم الخدمة', variant: 'destructive' });
      return;
    }

    if (editingService) {
      // Update existing service
      updatePricedService(editingService.id, {
        name: serviceName,
        materials,
        includedServices,
        serviceTimeHours,
        profitPercentage,
        totalMaterialsCost: liveCosts.totalMaterialsCost,
        timeCost: liveCosts.timeCost,
        baseCost: liveCosts.baseCost,
        profitValue: liveCosts.profitValue,
        finalPrice: liveCosts.finalPrice,
      });
      toast({ title: 'تم تحديث الخدمة بنجاح' });
      onSaveEdit();
    } else {
      // Add new service
      addPricedService({
        name: serviceName,
        materials,
        includedServices,
        serviceTimeHours,
        profitPercentage,
        totalMaterialsCost: liveCosts.totalMaterialsCost,
        timeCost: liveCosts.timeCost,
        baseCost: liveCosts.baseCost,
        profitValue: liveCosts.profitValue,
        finalPrice: liveCosts.finalPrice,
      });
      toast({ title: 'تم حفظ الخدمة بنجاح' });
    }

    resetForm();
  };

  const handleCancel = () => {
    resetForm();
    onCancelEdit();
  };

  const availableServicesForInclusion = pricedServices.filter(
    s => !includedServices.some(inc => inc.serviceId === s.id) && s.id !== editingService?.id
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <span>{editingService ? 'تعديل الخدمة' : 'حاسبة تكلفة الخدمة'}</span>
          </div>
          {editingService && (
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="w-4 h-4 ms-1" />
              إلغاء التعديل
            </Button>
          )}
        </CardTitle>
        <CardDescription className="text-right">
          {editingService
            ? `تعديل خدمة: ${editingService.name}`
            : 'أضف خدمة جديدة وحدد الخامات والوقت ونسبة الربح'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Service Name */}
        <div className="space-y-2">
          <Label htmlFor="serviceName" className="block text-right">اسم الخدمة *</Label>
          <Input
            id="serviceName"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="مثال: حشو عصب"
            className="text-right"
          />
        </div>

        {/* Materials Section */}
        <div className="space-y-4">
          <Label className="text-base font-semibold block text-right">الخامات المستخدمة</Label>

          {/* Add Material Form */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <Label className="text-xs block text-right">اسم المنتج</Label>
              <Input
                value={newMaterial.productName}
                onChange={(e) => setNewMaterial(prev => ({ ...prev, productName: e.target.value }))}
                placeholder="اسم الخامة"
                className="text-right"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs block text-right">السعر ({currencySymbol})</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newMaterial.productPrice}
                onChange={(e) => setNewMaterial(prev => ({ ...prev, productPrice: parseFloat(e.target.value) || 0 }))}
                className="text-right"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs block text-right">عدد الحالات</Label>
              <Input
                type="number"
                min="1"
                value={newMaterial.casesServed}
                onChange={(e) => setNewMaterial(prev => ({ ...prev, casesServed: parseInt(e.target.value) || 1 }))}
                className="text-right"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addMaterial} size="sm" className="w-full">
                <Plus className="w-4 h-4 ms-1" />
                إضافة
              </Button>
            </div>
          </div>

          {/* Materials List */}
          {materials.length > 0 && (
            <div className="space-y-2">
              {materials.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-background border border-border rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
                    <span className="font-medium text-right">{m.productName}</span>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <span>{m.productPrice}</span>
                      <span className="text-xs">{currencySymbol}</span>
                      <span>/</span>
                      <span>{m.casesServed}</span>
                      <span>حالة</span>
                    </div>
                    <div className="flex items-center justify-start gap-1 text-primary font-semibold">
                      <span>التكلفة:</span>
                      <span>{m.costPerCase.toFixed(2)}</span>
                      <span className="text-xs">{currencySymbol}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeMaterial(m.id)} className="ms-2">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Include Existing Service */}
        {pricedServices.length > 0 && availableServicesForInclusion.length > 0 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              <span>تضمين خدمة موجودة (خامات فقط)</span>
            </Label>

            <Select onValueChange={addIncludedService}>
              <SelectTrigger className="text-right">
                <SelectValue placeholder="اختر خدمة لتضمين خاماتها" />
              </SelectTrigger>
              <SelectContent>
                {availableServicesForInclusion.map((service) => (
                  <SelectItem key={service.id} value={service.id} className="text-right">
                    {service.name} - تكلفة خامات: {service.totalMaterialsCost.toFixed(2)} {currencySymbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {includedServices.length > 0 && (
              <div className="space-y-2">
                {includedServices.map((inc) => {
                  const service = pricedServices.find(s => s.id === inc.serviceId);
                  return (
                    <div key={inc.serviceId} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-blue-600" />
                        <span className="font-medium">{service?.name}</span>
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                          تكلفة خامات فقط
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-baseline gap-1 text-blue-600 font-semibold">
                          <span>{inc.materialsOnlyCost.toFixed(2)}</span>
                          <span className="text-xs">{currencySymbol}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeIncludedService(inc.serviceId)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Time and Profit */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="profitPercentage" className="block text-right">نسبة الربح (%)</Label>
            <Input
              id="profitPercentage"
              type="number"
              min="0"
              max="500"
              step="1"
              value={profitPercentage}
              onChange={(e) => setProfitPercentage(parseFloat(e.target.value) || 0)}
              className="text-right"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="serviceTimeHours" className="block text-right">وقت الخدمة (بالساعات)</Label>
            <Input
              id="serviceTimeHours"
              type="number"
              min="0.01"
              step="0.01"
              value={serviceTimeHours}
              onChange={(e) => setServiceTimeHours(parseFloat(e.target.value) || 0)}
              className="text-right"
            />
            <p className="text-xs text-muted-foreground text-right">
              مثال: 0.25 (ربع ساعة) • 0.5 (نصف ساعة) • 1.75 (ساعة و45 دقيقة)
            </p>
            <div className="text-xs text-muted-foreground text-right flex items-center justify-start gap-1">
              <span>تكلفة الساعة:</span>
              <span>{clinicCostSettings.finalClinicHourlyCost.toFixed(2)}</span>
              <span>{currencySymbol}</span>
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-muted/50 rounded-xl p-6 space-y-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            <span>تفاصيل التكلفة</span>
          </h4>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">إجمالي الخامات</span>
              <div className="flex items-baseline gap-1">
                <span>{liveCosts.totalMaterialsCost.toFixed(2)}</span>
                <span className="text-xs">{currencySymbol}</span>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                تكلفة الوقت ({serviceTimeHours} ساعة × {clinicCostSettings.finalClinicHourlyCost.toFixed(2)})
              </span>
              <div className="flex items-baseline gap-1">
                <span>{liveCosts.timeCost.toFixed(2)}</span>
                <span className="text-xs">{currencySymbol}</span>
              </div>
            </div>
            <div className="flex justify-between text-sm border-t border-border pt-2">
              <span className="text-muted-foreground">التكلفة الأساسية</span>
              <div className="flex items-baseline gap-1 font-medium">
                <span>{liveCosts.baseCost.toFixed(2)}</span>
                <span className="text-xs">{currencySymbol}</span>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">الربح ({profitPercentage}%)</span>
              <div className="flex items-baseline gap-1 text-green-600">
                <span>+</span>
                <span>{liveCosts.profitValue.toFixed(2)}</span>
                <span className="text-xs">{currencySymbol}</span>
              </div>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-border pt-3">
              <span>السعر النهائي</span>
              <div className="flex items-baseline gap-1 text-primary">
                <span>{liveCosts.finalPrice.toFixed(2)}</span>
                <span className="text-sm font-normal">{currencySymbol}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          {editingService && (
            <Button variant="outline" onClick={handleCancel} className="flex-1 md:flex-none">
              <X className="w-5 h-5 ms-2" />
              إلغاء
            </Button>
          )}
          <Button onClick={saveService} className="flex-1 md:flex-none" size="lg">
            <Save className="w-5 h-5 ms-2" />
            {editingService ? 'تحديث الخدمة' : 'حفظ الخدمة'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ServiceCalculator;
