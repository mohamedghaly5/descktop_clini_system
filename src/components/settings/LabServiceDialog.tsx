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
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/contexts/LanguageContext';
import { createLabService, updateLabService, LabService } from '@/services/labService';
import { toast } from 'sonner';

interface LabServiceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    serviceToEdit: LabService | null;
    onSuccess: () => void;
    labId?: string;
}

const LabServiceDialog: React.FC<LabServiceDialogProps> = ({ open, onOpenChange, serviceToEdit, onSuccess, labId }) => {
    const { t, isRTL } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        default_cost: 0,
        is_active: true
    });

    useEffect(() => {
        if (open) {
            if (serviceToEdit) {
                setFormData({
                    name: serviceToEdit.name,
                    default_cost: serviceToEdit.default_cost,
                    is_active: serviceToEdit.is_active === 1
                });
            } else {
                setFormData({
                    name: '',
                    default_cost: 0,
                    is_active: true
                });
            }
        }
    }, [open, serviceToEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let result;
            if (serviceToEdit) {
                result = await updateLabService({
                    ...serviceToEdit,
                    name: formData.name,
                    default_cost: formData.default_cost,
                    is_active: formData.is_active ? 1 : 0
                });
            } else {
                result = await createLabService({
                    name: formData.name,
                    default_cost: formData.default_cost,
                    is_active: formData.is_active ? 1 : 0,
                    lab_id: labId
                });
            }

            if (result.success) {
                toast.success(t('success'));
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]" dir={isRTL ? 'rtl' : 'ltr'}>
                <DialogHeader className="text-start">
                    <DialogTitle>
                        {serviceToEdit ? t('settings.labServices.title') : t('settings.labServices.add')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('settings.labServices.description')}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="grid gap-2">
                        <Label>{t('settings.labServices.name')}</Label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            required
                            className={isRTL ? "text-right" : "text-left"}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>{t('settings.labServices.cost')}</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={formData.default_cost}
                            onChange={(e) => setFormData(prev => ({ ...prev, default_cost: parseFloat(e.target.value) }))}
                            className={isRTL ? "text-right" : "text-left"}
                        />
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                        <Checkbox
                            id="is_active"
                            checked={formData.is_active}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked as boolean }))}
                        />
                        <Label htmlFor="is_active">{t('settings.labServices.active')}</Label>
                    </div>
                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {t('settings.labServices.cancel')}
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {t('settings.labServices.save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default LabServiceDialog;
