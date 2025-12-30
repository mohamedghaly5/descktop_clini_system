import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, Package } from 'lucide-react';
import WorkingHoursSection from '@/components/pricing/WorkingHoursSection';
import EquipmentSection from '@/components/pricing/EquipmentSection';
import FixedExpensesSection from '@/components/pricing/FixedExpensesSection';
import ClinicHourlyCostSummary from '@/components/pricing/ClinicHourlyCostSummary';
import ServiceCalculator from '@/components/pricing/ServiceCalculator';
import SavedServicesSection from '@/components/pricing/SavedServicesSection';
import PdfExportButton from '@/components/pricing/PdfExportButton';
import { PricedService } from '@/contexts/PricingContext';

const Pricing: React.FC = () => {
  const [activeTab, setActiveTab] = useState('costs');
  const [editingService, setEditingService] = useState<PricedService | null>(null);

  const handleEditService = (service: PricedService) => {
    setEditingService(service);
    setActiveTab('services');
  };

  const handleCancelEdit = () => {
    setEditingService(null);
  };

  const handleSaveEdit = () => {
    setEditingService(null);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">تسعير الخدمات</h1>
          <p className="text-muted-foreground">حساب تكلفة تشغيل العيادة وتسعير الخدمات</p>
        </div>
        <PdfExportButton />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-flex">
          <TabsTrigger value="costs" className="flex items-center">
            <Calculator className="w-4 h-4 ml-2" />
            تكلفة التشغيل
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center">
            <Package className="w-4 h-4 ml-2" />
            تسعير الخدمات
          </TabsTrigger>
        </TabsList>

        {/* Clinic Costs Tab */}
        <TabsContent value="costs" className="space-y-6">
          {/* Section 1: Working Hours */}
          <WorkingHoursSection />

          {/* Section 2: Equipment Depreciation */}
          <EquipmentSection />

          {/* Section 3: Fixed Expenses */}
          <FixedExpensesSection />

          {/* Section 4: Final Clinic Hourly Cost */}
          <ClinicHourlyCostSummary />
        </TabsContent>

        {/* Service Pricing Tab */}
        <TabsContent value="services" className="space-y-6">
          {/* Section 5: Service Calculator */}
          <ServiceCalculator
            editingService={editingService}
            onCancelEdit={handleCancelEdit}
            onSaveEdit={handleSaveEdit}
          />

          {/* Saved Services List */}
          <SavedServicesSection onEditService={handleEditService} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Pricing;
