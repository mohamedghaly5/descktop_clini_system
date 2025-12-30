import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Package, Trash2, Edit, ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import { usePricing, PricedService } from '@/contexts/PricingContext';
import { useSettings } from '@/contexts/SettingsContext';

interface SavedServicesSectionProps {
  onEditService: (service: PricedService) => void;
}

const SavedServicesSection: React.FC<SavedServicesSectionProps> = ({ onEditService }) => {
  const { pricedServices, deletePricedService, getPricedServiceById } = usePricing();
  const { getCurrencySymbol } = useSettings();
  const currencySymbol = getCurrencySymbol('ar');
  const [expandedService, setExpandedService] = useState<string | null>(null);

  if (pricedServices.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold text-lg mb-2">لا توجد خدمات محفوظة</h3>
          <p className="text-muted-foreground">
            أضف خدمة جديدة من الحاسبة أعلاه
          </p>
        </CardContent>
      </Card>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedService(expandedService === id ? null : id);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
          <span>الخدمات المحفوظة</span>
          <Package className="w-5 h-5 text-primary" />
        </CardTitle>
        <CardDescription className="text-right">
          {pricedServices.length} خدمة محفوظة
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pricedServices.map((service) => (
          <div
            key={service.id}
            className="border border-border rounded-lg overflow-hidden"
          >
            {/* Service Header */}
            <div
              className="flex flex-row-reverse items-center justify-between p-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleExpand(service.id)}
            >
              <div className="flex flex-row-reverse items-center gap-3">
                <div className="text-right">
                  <h4 className="font-semibold">{service.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {service.materials.length} خامة • {service.serviceTimeHours} ساعة
                  </p>
                </div>
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div className="flex flex-row-reverse items-center gap-4">
                {expandedService === service.id ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
                <div className="text-left">
                  <div className="text-lg font-bold text-primary" dir="ltr">
                    {currencySymbol} {service.finalPrice.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">السعر النهائي</div>
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedService === service.id && (
              <div className="p-4 space-y-4 border-t border-border">
                {/* Materials */}
                {service.materials.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-muted-foreground text-right">الخامات</h5>
                    <div className="space-y-1">
                      {service.materials.map((m) => (
                        <div key={m.id} className="flex flex-row-reverse justify-between text-sm p-2 bg-muted/30 rounded">
                          <span>{m.productName}</span>
                          <span dir="ltr">
                            {currencySymbol} {m.costPerCase.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Included Services */}
                {service.includedServices.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-muted-foreground flex flex-row-reverse items-center justify-end gap-1">
                      <span>خدمات مضمنة (خامات فقط)</span>
                      <Link2 className="w-3 h-3" />
                    </h5>
                    <div className="space-y-1">
                      {service.includedServices.map((inc) => {
                        const includedService = getPricedServiceById(inc.serviceId);
                        return (
                          <div key={inc.serviceId} className="flex flex-row-reverse justify-between text-sm p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
                            <span>{includedService?.name || 'خدمة محذوفة'}</span>
                            <span className="text-blue-600" dir="ltr">
                              {currencySymbol} {inc.materialsOnlyCost.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Cost Breakdown */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex flex-row-reverse justify-between text-sm">
                    <span className="text-muted-foreground">إجمالي الخامات</span>
                    <span dir="ltr">{currencySymbol} {service.totalMaterialsCost.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-row-reverse justify-between text-sm">
                    <span className="text-muted-foreground">تكلفة الوقت ({service.serviceTimeHours} ساعة)</span>
                    <span dir="ltr">{currencySymbol} {service.timeCost.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-row-reverse justify-between text-sm">
                    <span className="text-muted-foreground">التكلفة الأساسية</span>
                    <span dir="ltr">{currencySymbol} {service.baseCost.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-row-reverse justify-between text-sm">
                    <span className="text-muted-foreground">الربح ({service.profitPercentage}%)</span>
                    <span className="text-green-600" dir="ltr">+ {currencySymbol} {service.profitValue.toFixed(2)}</span>
                  </div>
                </div>

                {/* Actions - aligned to left for Arabic UX */}
                <div className="flex flex-row gap-2 pt-2 border-t border-border">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditService(service);
                    }}
                  >
                    <Edit className="w-4 h-4 ms-1" />
                    تعديل
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-4 h-4 ms-1" />
                        حذف
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-right">هل أنت متأكد؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-right">
                          سيتم حذف خدمة "{service.name}" نهائياً. هذا الإجراء لا يمكن التراجع عنه.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-row gap-2">
                        <AlertDialogAction
                          onClick={() => deletePricedService(service.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          حذف
                        </AlertDialogAction>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default SavedServicesSection;
