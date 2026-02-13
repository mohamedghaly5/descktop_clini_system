import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { Patient } from '@/services/patientService';
import { Loader2 } from 'lucide-react';

interface ExportVcfDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    patients: Patient[];
}

const ExportVcfDialog: React.FC<ExportVcfDialogProps> = ({ open, onOpenChange, patients }) => {
    const { language } = useLanguage();
    const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
    const [isExporting, setIsExporting] = useState(false);

    // Extract available months from patients
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        patients.forEach(p => {
            if (p.createdAt) {
                const date = new Date(p.createdAt);
                // Format YYYY-MM
                const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                months.add(monthStr);
            }
        });
        return Array.from(months).sort().reverse();
    }, [patients]);

    const handleExport = async () => {
        if (selectedMonths.length === 0) return;

        setIsExporting(true);
        try {
            // @ts-ignore
            const result = await window.api.exportVcf({ months: selectedMonths });

            if (result.success) {
                toast({
                    title: language === 'ar' ? 'تم التصدير' : 'Export Successful',
                    description: language === 'ar' ? `تم حفظ الملف: ${result.filePath}` : `File saved to: ${result.filePath}`,
                });
                onOpenChange(false);
                setSelectedMonths([]);
            } else if (!result.cancelled) {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error: any) {
            toast({
                title: language === 'ar' ? 'خطأ' : 'Error',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsExporting(false);
        }
    };

    const toggleMonth = (month: string) => {
        setSelectedMonths(prev =>
            prev.includes(month)
                ? prev.filter(m => m !== month)
                : [...prev, month]
        );
    };

    const toggleAll = () => {
        if (selectedMonths.length === availableMonths.length) {
            setSelectedMonths([]);
        } else {
            setSelectedMonths([...availableMonths]);
        }
    };

    // Determine direction based on language
    const dir = language === 'ar' ? 'rtl' : 'ltr';
    const textAlign = language === 'ar' ? 'text-right' : 'text-left';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]" dir={dir}>
                <DialogHeader>
                    <DialogTitle className={textAlign}>{language === 'ar' ? 'تصدير جهات الاتصال (VCF)' : 'Export Contacts (VCF)'}</DialogTitle>
                    <DialogDescription className={textAlign}>
                        {language === 'ar' ? 'اختر الأشهر التي ترغب في تصدير المرضى المسجلين خلالها.' : 'Select the months for which you want to export registered patients.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <div className={`flex items-center gap-2 mb-4 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <Label htmlFor="select-all" className="font-bold cursor-pointer">
                            {language === 'ar' ? 'تحديد الكل' : 'Select All'}
                        </Label>
                        <Checkbox
                            id="select-all"
                            checked={selectedMonths.length === availableMonths.length && availableMonths.length > 0}
                            onCheckedChange={toggleAll}
                        />
                    </div>

                    <ScrollArea className="h-[200px] border rounded-md p-4">
                        <div className="space-y-4">
                            {availableMonths.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    {language === 'ar' ? 'لا يوجد بيانات' : 'No data available'}
                                </p>
                            ) : (
                                availableMonths.map(month => (
                                    <div key={month} className={`flex items-center gap-2 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <Label htmlFor={month} className="cursor-pointer flex-1">
                                            {month} <span className="text-xs text-muted-foreground mx-1">
                                                ({patients.filter(p => p.createdAt?.startsWith(month)).length} {language === 'ar' ? 'مريض' : 'patients'})
                                            </span>
                                        </Label>
                                        <Checkbox
                                            id={month}
                                            checked={selectedMonths.includes(month)}
                                            onCheckedChange={() => toggleMonth(month)}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter className={`flex gap-2 ${language === 'ar' ? 'flex-row-reverse justify-start' : 'flex-row justify-end'}`}>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </Button>
                    <Button onClick={handleExport} disabled={selectedMonths.length === 0 || isExporting}>
                        {isExporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {language === 'ar' ? 'تصدير' : 'Export'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ExportVcfDialog;
