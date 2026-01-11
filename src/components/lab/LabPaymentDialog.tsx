import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';
import { LabOrderOverview, receiveLabOrder } from '@/services/labService';
import { Calendar, DollarSign } from 'lucide-react';

interface LabPaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: LabOrderOverview | null;
    onSuccess: () => void;
}

const LabPaymentDialog: React.FC<LabPaymentDialogProps> = ({ open, onOpenChange, order, onSuccess }) => {
    const { t, isRTL, language } = useLanguage();
    const { formatCurrency } = useSettings();
    const [loading, setLoading] = useState(false);

    const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
    const [paidAmount, setPaidAmount] = useState(0);

    useEffect(() => {
        if (open && order) {
            setReceivedDate(new Date().toISOString().split('T')[0]);
            // Default to full remaining amount or 0? 
            // Usually partial is common, but auto-filling remaining is helpful.
            // Let's default to remaining.
            setPaidAmount(order.remaining_balance > 0 ? order.remaining_balance : 0);
        }
    }, [open, order]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!order) return;

        if (!receivedDate) {
            toast.error(t('requiredField'));
            return;
        }

        setLoading(true);
        try {
            const result = await receiveLabOrder({
                orderId: order.order_id,
                receivedDate,
                paidAmount
            });

            if (result.success) {
                toast.success(language === 'ar' ? 'تم استلام الطلب بنجاح' : 'Order marked as received');
                onSuccess();
                onOpenChange(false);
            } else {
                toast.error(t('error'));
            }
        } catch (error) {
            console.error(error);
            toast.error(t('error'));
        } finally {
            setLoading(false);
        }
    };

    if (!order) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]" dir={isRTL ? 'rtl' : 'ltr'}>
                <DialogHeader>
                    <DialogTitle>{language === 'ar' ? 'استلام الطلب' : 'Receive Lab Order'}</DialogTitle>
                    <DialogDescription>
                        {order.service_name} - {order.patient_name}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">

                    {/* Received Date */}
                    <div className="grid gap-2">
                        <Label>{language === 'ar' ? 'تاريخ الاستلام' : 'Received Date'}</Label>
                        <div className="relative">
                            <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="date"
                                className="pl-9"
                                value={receivedDate}
                                onChange={(e) => setReceivedDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Financial Summary (Read Only) */}
                    <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{language === 'ar' ? 'التكلفة الكلية:' : 'Total Cost:'}</span>
                            <span className="font-medium ltr-nums">{formatCurrency(order.total_lab_cost, language)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{language === 'ar' ? 'المدفوع مسبقاً:' : 'Already Paid:'}</span>
                            <span className="font-medium ltr-nums">{formatCurrency(order.total_paid, language)}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t mt-1">
                            <span className="font-bold">{language === 'ar' ? 'المتبقي:' : 'Remaining:'}</span>
                            <span className="font-bold ltr-nums text-red-600">{formatCurrency(order.remaining_balance, language)}</span>
                        </div>
                    </div>

                    {/* Payment Input */}
                    <div className="grid gap-2">
                        <Label>{language === 'ar' ? 'دفعة جديدة (إدراج في المصروفات)' : 'New Payment (Add to Expenses)'}</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="number"
                                step="0.01"
                                className="pl-9"
                                value={paidAmount}
                                onChange={(e) => setPaidAmount(parseFloat(e.target.value))}
                            />
                        </div>
                        <p className="text-[0.8rem] text-muted-foreground">
                            {language === 'ar'
                                ? 'سيتم إنشاء سجل مصروفات تلقائياً لهذا المبلغ.'
                                : 'An expense record will be automatically created for this amount.'}
                        </p>
                    </div>

                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {t('cancel')}
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {language === 'ar' ? 'تأكيد الاستلام' : 'Confirm & Receive'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default LabPaymentDialog;
