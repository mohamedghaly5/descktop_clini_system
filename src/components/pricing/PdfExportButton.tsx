import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2, Check } from 'lucide-react';
import { usePricing } from '@/contexts/PricingContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from 'jspdf';

const PdfExportButton: React.FC = () => {
  const { clinicCostSettings, pricedServices, getPricedServiceById } = usePricing();
  const { clinicInfo, getCurrencySymbol } = useSettings();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const currencySymbol = getCurrencySymbol('ar');

  const generatePdf = async () => {
    if (pricedServices.length === 0) {
      toast({
        title: 'لا توجد خدمات',
        description: 'يرجى إضافة خدمات قبل التصدير',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Create PDF with Arabic support
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Set RTL direction
      doc.setR2L(true);

      // Use a font that supports Arabic - we'll use the built-in Helvetica for now
      // and add Arabic text as unicode
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = 30;

      // Helper to add text (RTL)
      const addText = (text: string, y: number, options: { size?: number; bold?: boolean; align?: 'right' | 'left' | 'center' } = {}) => {
        const { size = 12, bold = false, align = 'right' } = options;
        doc.setFontSize(size);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');

        let x = margin;
        if (align === 'right') x = pageWidth - margin;
        if (align === 'center') x = pageWidth / 2;

        doc.text(text, x, y, { align });
        return y + (size * 0.5);
      };

      // Helper to add a line
      const addLine = (y: number) => {
        doc.setDrawColor(200);
        doc.line(margin, y, pageWidth - margin, y);
        return y + 5;
      };

      // Helper to check page break
      const checkPageBreak = (neededSpace: number) => {
        if (yPos + neededSpace > pageHeight - 30) {
          doc.addPage();
          yPos = 30;
        }
      };

      // Header
      const clinicName = clinicInfo.name || 'العيادة';
      yPos = addText(clinicName, yPos, { size: 18, bold: true, align: 'center' });
      yPos += 5;
      yPos = addText('تقرير تسعير خدمات العيادة', yPos, { size: 14, align: 'center' });
      yPos += 3;

      const date = new Date().toLocaleDateString('ar-EG', {
        calendar: 'gregory',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      yPos = addText(`تاريخ التقرير: ${date}`, yPos, { size: 10, align: 'center' });
      yPos += 10;
      yPos = addLine(yPos);

      // Clinic Cost Summary
      yPos += 5;
      yPos = addText('ملخص تكلفة تشغيل العيادة', yPos, { size: 14, bold: true });
      yPos += 8;

      const costSummary = [
        ['ساعات العمل يومياً', `${clinicCostSettings.workingHoursPerDay} ساعة`],
        ['أيام العمل أسبوعياً', `${clinicCostSettings.workingDaysPerWeek} يوم`],
        ['ساعات العمل الشهرية', `${clinicCostSettings.monthlyWorkingHours} ساعة`],
        ['تكلفة المعدات في الساعة', `${currencySymbol} ${clinicCostSettings.hourlyEquipmentCost.toFixed(2)}`],
        ['تكلفة المصاريف الثابتة في الساعة', `${currencySymbol} ${clinicCostSettings.fixedHourlyCost.toFixed(2)}`],
        ['التكلفة النهائية للساعة', `${currencySymbol} ${clinicCostSettings.finalClinicHourlyCost.toFixed(2)}`],
      ];

      costSummary.forEach(([label, value]) => {
        doc.setFontSize(10);
        doc.text(label, pageWidth - margin, yPos, { align: 'right' });
        doc.text(value, margin + 40, yPos, { align: 'left' });
        yPos += 6;
      });

      yPos += 5;
      yPos = addLine(yPos);

      // Services
      yPos += 5;
      yPos = addText('تفاصيل الخدمات', yPos, { size: 14, bold: true });
      yPos += 10;

      pricedServices.forEach((service, index) => {
        // Check if we need a new page
        checkPageBreak(80);

        // Service header
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, yPos - 5, pageWidth - (margin * 2), 12, 'F');
        yPos = addText(`${index + 1}. ${service.name}`, yPos, { size: 12, bold: true });
        yPos += 8;

        // Materials
        if (service.materials.length > 0) {
          yPos = addText('الخامات:', yPos, { size: 10, bold: true });
          yPos += 5;

          service.materials.forEach((m) => {
            checkPageBreak(10);
            doc.setFontSize(9);
            const materialText = `${m.productName}: ${currencySymbol} ${m.productPrice} / ${m.casesServed} حالة = ${currencySymbol} ${m.costPerCase.toFixed(2)}`;
            doc.text(materialText, pageWidth - margin - 10, yPos, { align: 'right' });
            yPos += 5;
          });
        }

        // Included Services
        if (service.includedServices.length > 0) {
          yPos += 3;
          yPos = addText('خدمات مضمنة (تكلفة خامات فقط):', yPos, { size: 10, bold: true });
          yPos += 5;

          service.includedServices.forEach((inc) => {
            checkPageBreak(10);
            const includedService = getPricedServiceById(inc.serviceId);
            doc.setFontSize(9);
            const incText = `${includedService?.name || 'خدمة'}: ${currencySymbol} ${inc.materialsOnlyCost.toFixed(2)}`;
            doc.text(incText, pageWidth - margin - 10, yPos, { align: 'right' });
            yPos += 5;
          });
        }

        // Cost breakdown
        yPos += 5;
        checkPageBreak(40);
        yPos = addText('ملخص التكلفة:', yPos, { size: 10, bold: true });
        yPos += 5;

        const breakdown = [
          ['إجمالي الخامات', `${currencySymbol} ${service.totalMaterialsCost.toFixed(2)}`],
          [`تكلفة الوقت (${service.serviceTimeHours} ساعة)`, `${currencySymbol} ${service.timeCost.toFixed(2)}`],
          ['التكلفة الأساسية', `${currencySymbol} ${service.baseCost.toFixed(2)}`],
          [`الربح (${service.profitPercentage}%)`, `${currencySymbol} ${service.profitValue.toFixed(2)}`],
          ['السعر النهائي', `${currencySymbol} ${service.finalPrice.toFixed(2)}`],
        ];

        breakdown.forEach(([label, value], i) => {
          doc.setFontSize(9);
          const isFinal = i === breakdown.length - 1;
          if (isFinal) {
            doc.setFont('helvetica', 'bold');
          }
          doc.text(label, pageWidth - margin - 10, yPos, { align: 'right' });
          doc.text(value, margin + 50, yPos, { align: 'left' });
          yPos += 5;
        });

        yPos += 10;
      });

      // Footer
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `صفحة ${i} من ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
        doc.setTextColor(0);
      }

      // Save
      const fileName = `تقرير-تسعير-${clinicName}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      setIsSuccess(true);
      toast({ title: 'تم تصدير التقرير بنجاح' });

      setTimeout(() => setIsSuccess(false), 2000);
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'حدث خطأ',
        description: 'فشل في إنشاء ملف PDF',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={generatePdf}
      disabled={isGenerating || pricedServices.length === 0}
      className="gap-2"
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          جاري التصدير...
        </>
      ) : isSuccess ? (
        <>
          <Check className="w-4 h-4" />
          تم التصدير
        </>
      ) : (
        <>
          <FileDown className="w-4 h-4" />
          تصدير تقرير الخدمات (PDF)
        </>
      )}
    </Button>
  );
};

export default PdfExportButton;
