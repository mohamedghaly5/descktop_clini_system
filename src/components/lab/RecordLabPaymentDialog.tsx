import React, { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface RecordLabPaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    labName: string;
    labId: string;
    onSuccess: () => void;
}

import { createLabGeneralPayment } from '@/services/labService';

const RecordLabPaymentDialog: React.FC<RecordLabPaymentDialogProps> = ({ open, onOpenChange, labName, labId, onSuccess }) => {
    const { t, isRTL } = useLanguage();
    const [loading, setLoading] = useState(false);

    const [amount, setAmount] = useState(0);
    const [notes, setNotes] = useState('');

    // Reset form when opening
    React.useEffect(() => {
        if (open) {
            setAmount(0);
            setNotes('');
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (amount <= 0) {
            toast.error(t('expenses.validation.amountPositive') || 'Amount must be greater than zero');
            return;
        }

        setLoading(true);

        const description = `Lab Payment - ${labName} ${notes ? `(${notes})` : ''}`;

        try {
            const result = await createLabGeneralPayment({
                labId: labId,
                amount: amount,
                notes: notes,
                paymentDate: new Date().toISOString().split('T')[0]
            });

            if (result.success) {
                const successMsg = isRTL
                    ? 'تم الحفظ بنجاح وإنشاء مصروف'
                    : 'Payment recorded successfully and expense created';
                toast.success(successMsg);
                onSuccess();
                onOpenChange(false);
            } else {
                toast.error(result.error || t('error'));
            }
        } catch (error) {
            console.error(error);
            toast.error(t('error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]" dir={isRTL ? 'rtl' : 'ltr'}>
                <DialogHeader className="text-start">
                    <DialogTitle>{t('lab.payment.title') || 'Record Lab Payment'}</DialogTitle>
                    <DialogDescription>
                        {t('lab.payment.desc') || `Record a general payment to ${labName}.`}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">

                    <div className="grid gap-2">
                        <Label>{t('lab.payment.amount') || 'Amount'}</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(parseFloat(e.target.value))}
                            required
                            min="0.1"
                            className={isRTL ? "text-right" : "text-left"}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label>{t('lab.payment.notes') || 'Notes (Optional)'}</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={t('lab.payment.notesPlaceholder') || 'Check number, transaction ID, etc.'}
                            className={isRTL ? "text-right" : "text-left"}
                        />
                    </div>

                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {t('cancel')}
                        </Button>
                        <Button type="submit" disabled={loading || amount <= 0}>
                            {loading ? (t('saving') || 'Saving...') : (t('save') || 'Record Payment')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default RecordLabPaymentDialog;
