import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { db } from '@/services/db';

interface Expense {
    id?: string;
    amount: number;
    date: string;
    category: string;
    description: string;
}

interface ExpenseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    expenseToEdit?: Expense | null;
    onSave: () => void;
}

import { EXPENSE_CATEGORIES } from '@/constants/expenseCategories';

// Helper for non-secure contexts (HTTP)
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const ExpenseDialog: React.FC<ExpenseDialogProps> = ({ open, onOpenChange, expenseToEdit, onSave }) => {
    const { t, isRTL } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Expense>({
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        category: '',
        description: ''
    });

    useEffect(() => {
        if (expenseToEdit) {
            setFormData(expenseToEdit);
        } else {
            setFormData({
                amount: 0,
                date: new Date().toISOString().split('T')[0],
                category: '',
                description: ''
            });
        }
    }, [expenseToEdit, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.amount || !formData.date || !formData.category) {
            toast.error(t('requiredField') || 'Changes required');
            return;
        }

        setLoading(true);
        try {
            if (expenseToEdit?.id) {
                // Update
                const result = await db.expenses.update(expenseToEdit.id, formData);
                if (result.success) {
                    toast.success(t('expenses.toast.updated'));
                    onSave();
                    onOpenChange(false);
                } else {
                    toast.error(t('error'));
                }


            } else {
                // Create
                const result = await db.expenses.create({
                    ...formData,
                    id: generateUUID()
                });
                if (result.success) {
                    toast.success(t('expenses.toast.added'));
                    onSave();
                    onOpenChange(false);
                } else {
                    toast.error(t('error'));
                }
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
                <DialogHeader>
                    <DialogTitle>{expenseToEdit ? t('expenses.dialog.title.edit') : t('expenses.dialog.title.add')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="date">{t('visitDate') || 'Date'}</Label>
                        <Input
                            id="date"
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                            required
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="amount">{t('expenses.table.amount')}</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            value={formData.amount}
                            onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                            required
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="category">{t('expenses.table.category')}</Label>
                        <Select
                            value={formData.category}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={t('expenses.input.selectCategory')} />
                            </SelectTrigger>
                            <SelectContent>
                                {EXPENSE_CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat}>{t(`expenses.cat.${cat}` as any)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="description">{t('notes') || 'Description'}</Label>
                        <Input
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        />
                    </div>

                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {t('cancel')}
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (t('save') + '...') : t('save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ExpenseDialog;
