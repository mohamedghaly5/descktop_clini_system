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
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/contexts/LanguageContext';
import { createLab } from '@/services/labService';
import { toast } from 'sonner';

interface AddLabDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

const AddLabDialog: React.FC<AddLabDialogProps> = ({ open, onOpenChange, onSuccess }) => {
    const { t, isRTL } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [isDefault, setIsDefault] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        try {
            const result = await createLab({ name, is_default: isDefault });
            if (result.success) {
                toast.success(t('success'));
                onSuccess();
                onOpenChange(false);
                // Reset
                setName('');
                setIsDefault(false);
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
                    <DialogTitle>Add New Lab</DialogTitle>
                    <DialogDescription>
                        Create a new dental lab profile.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="grid gap-2">
                        <Label>Lab Name</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            placeholder="e.g. Future Lab"
                            className={isRTL ? "text-right" : "text-left"}
                        />
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                        <Checkbox
                            id="is_default"
                            checked={isDefault}
                            onCheckedChange={(checked) => setIsDefault(checked as boolean)}
                        />
                        <Label htmlFor="is_default">Set as Default Lab</Label>
                    </div>
                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || !name.trim()}>
                            {loading ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AddLabDialog;
