import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings } from '@/contexts/SettingsContext';
import { CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ActivePlan {
    id: string;
    plan_name: string;
    patient_name: string;
    total_cost: number;
    total_paid: number;
    remaining: number;
}

interface ActivePlansDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export const ActivePlansDialog: React.FC<ActivePlansDialogProps> = ({
    open,
    onOpenChange,
    onSuccess
}) => {
    const { language } = useLanguage();
    const { getCurrencySymbol } = useSettings();
    const currencySymbol = getCurrencySymbol('ar');
    const [plans, setPlans] = useState<ActivePlan[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const data = await (window as any).api.getActivePlansDetails();
            setPlans(data || []);
        } catch (error) {
            console.error('Failed to fetch active plans', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchPlans();
        }
    }, [open]);

    const handleCompletePlan = async (planId: string) => {
        setProcessingId(planId);
        try {
            // Assuming we have a generic update or a specific one exposed. 
            // We'll use dbUpdate if exposed or a specific handler.
            // Preload exposed `dbUpdate`.
            await (window as any).api.dbUpdate('treatment_cases', planId, { status: 'closed' });

            toast.success(language === 'ar' ? 'تم إنهاء الخطة بنجاح' : 'Plan completed successfully');
            fetchPlans(); // Refresh list
            if (onSuccess) onSuccess();
        } catch (error) {
            toast.error(language === 'ar' ? 'فشل تحديث الخطة' : 'Failed to update plan');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{language === 'ar' ? 'خطط العلاج النشطة (مستحقات)' : 'Active Treatment Plans (Outstanding)'}</DialogTitle>
                    <DialogDescription>
                        {language === 'ar'
                            ? 'قائمة بالمرضى الذين لديهم خطط علاج نشطة ورصيد متبقي.'
                            : 'List of patients with active treatment plans and outstanding balance.'}
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : plans.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                        {language === 'ar' ? 'لا توجد خطط نشطة حالياً.' : 'No active plans found.'}
                    </div>
                ) : (
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-right">{language === 'ar' ? 'المريض' : 'Patient'}</TableHead>
                                    <TableHead className="text-right">{language === 'ar' ? 'الخطة' : 'Plan'}</TableHead>
                                    <TableHead className="text-right">{language === 'ar' ? 'التكلفة' : 'Cost'}</TableHead>
                                    <TableHead className="text-right">{language === 'ar' ? 'المدفوع' : 'Paid'}</TableHead>
                                    <TableHead className="text-right">{language === 'ar' ? 'المتبقي' : 'Remaining'}</TableHead>
                                    <TableHead className="text-center">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {plans.map((plan) => (
                                    <TableRow key={plan.id}>
                                        <TableCell className="font-medium">{plan.patient_name}</TableCell>
                                        <TableCell>{plan.plan_name}</TableCell>
                                        <TableCell>{currencySymbol} {plan.total_cost}</TableCell>
                                        <TableCell>{currencySymbol} {plan.total_paid}</TableCell>
                                        <TableCell className="text-destructive font-bold">
                                            {currencySymbol} {plan.remaining.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-success hover:text-success hover:bg-success/10"
                                                onClick={() => handleCompletePlan(plan.id)}
                                                disabled={!!processingId}
                                                title={language === 'ar' ? 'إنهاء الخطة' : 'Mark as Completed'}
                                            >
                                                {processingId === plan.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle className="w-4 h-4" />
                                                )}
                                                <span className="sr-only">Complete</span>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
