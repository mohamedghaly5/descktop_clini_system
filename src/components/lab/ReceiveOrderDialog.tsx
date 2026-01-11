import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';
import { receiveLabOrder, LabOrderOverview } from '@/services/labService';

interface ReceiveOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: LabOrderOverview | null;
    onSuccess: () => void;
}

const ReceiveOrderDialog: React.FC<ReceiveOrderDialogProps> = ({ open, onOpenChange, order, onSuccess }) => {
    const { t, isRTL, language } = useLanguage();
    const { formatCurrency } = useSettings();
    const [loading, setLoading] = useState(false);
    const [paidAmount, setPaidAmount] = useState<string | number>('');

    // Reset form when dialog opens with a new order
    useEffect(() => {
        if (open && order) {
            setPaidAmount(''); // Start empty
        }
    }, [open, order]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!order) return;

        const amountToPay = typeof paidAmount === 'string' && paidAmount === '' ? 0 : Number(paidAmount);

        if (amountToPay < 0) {
            toast.error(language === 'ar' ? 'المبلغ المدفوع يجب أن يكون صفر أو أكثر' : 'Paid amount must be 0 or more');
            return;
        }

        if (amountToPay > order.remaining_balance + 0.1) { // small buffer for float
            toast.error(language === 'ar' ? 'المبلغ المدفوع أكبر من المبلغ المتبقي' : 'Paid amount exceeds remaining balance');
            return;
        }

        setLoading(true);
        try {
            const result = await receiveLabOrder({
                orderId: order.order_id,
                receivedDate: new Date().toISOString().split('T')[0],
                paidAmount: amountToPay
            });

            if (result.success) {
                toast.success(language === 'ar' ? 'تم استلام الطلب وتسجيل الدفع بنجاح' : 'Order received and payment recorded');
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
            <DialogContent className="sm:max-w-[450px]" dir={isRTL ? 'rtl' : 'ltr'}>
                <DialogHeader className="text-start">
                    <DialogTitle>{language === 'ar' ? 'تأكيد استلام الطلب' : 'Confirm Order Receipt'}</DialogTitle>
                    <DialogDescription>
                        {language === 'ar'
                            ? 'يرجى تأكيد استلام العمل من المعمل وتسجيل أي مبالغ مدفوعة.'
                            : 'Please confirm receiving the work from the lab and record any payment made.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    {/* Read-only Info */}
                    <div className="grid grid-cols-2 gap-4 p-3 bg-secondary/20 rounded-lg text-sm">
                        <div>
                            <span className="text-muted-foreground block">{t('lab.dialog.service')}</span>
                            <span className="font-semibold">{order.service_name}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block">{language === 'ar' ? 'المعمل' : 'Lab'}</span>
                            <span className="font-semibold">{language === 'ar' ? 'الافتراضي' : 'Default'}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block">{t('lab.dialog.cost')}</span>
                            <span className="font-semibold">{formatCurrency(order.total_lab_cost, language)}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block">{language === 'ar' ? 'المتبقي' : 'Remaining'}</span>
                            <span className="font-bold text-destructive">{formatCurrency(order.remaining_balance, language)}</span>
                        </div>
                    </div>

                    {/* Payment Input */}
                    <div className="space-y-2">
                        <Label>{language === 'ar' ? 'المبلغ المدفوع الآن' : 'Amount Paid Now'}</Label>
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max={order.remaining_balance}
                            placeholder={language === 'ar' ? `المتبقي: ${order.remaining_balance}` : `Remaining: ${order.remaining_balance}`}
                            value={paidAmount}
                            onChange={(e) => setPaidAmount(e.target.value)}
                            className="font-bold text-lg"
                        />
                        <p className="text-xs text-muted-foreground">
                            {language === 'ar'
                                ? `سيتم تسجيل مصروف بقيمة ${formatCurrency(Number(paidAmount || 0), language)}`
                                : `An expense of ${formatCurrency(Number(paidAmount || 0), language)} will be recorded`}
                        </p>
                    </div>

                    <DialogFooter className="mt-4 gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {t('lab.dialog.cancel')}
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
                            {loading ? (language === 'ar' ? 'جاري التأكيد...' : 'Confirming...') : (language === 'ar' ? 'تأكيد الاستلام' : 'Confirm Receipt')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ReceiveOrderDialog;
