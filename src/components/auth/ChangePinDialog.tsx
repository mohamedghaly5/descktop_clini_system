import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ChangePinDialogProps {
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

const ChangePinDialog = ({ trigger, open, onOpenChange }: ChangePinDialogProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
    });

    const handleOpenChange = (newOpen: boolean) => {
        setIsOpen(newOpen);
        if (onOpenChange) onOpenChange(newOpen);
        if (!newOpen) {
            setFormData({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.newPassword !== formData.confirmNewPassword) {
            toast.error("New PINs do not match");
            return;
        }
        if (formData.newPassword.length < 4) {
            toast.error("PIN must be at least 4 digits");
            return;
        }

        setLoading(true);
        try {
            // @ts-ignore
            const result = await window.electron.ipcRenderer.invoke('auth:change-password', formData);
            if (result.success) {
                toast.success("PIN changed successfully");
                handleOpenChange(false);
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error("Failed to change PIN");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open !== undefined ? open : isOpen} onOpenChange={handleOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Change PIN</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="current">Current PIN</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="current"
                                type="password"
                                placeholder="****"
                                className="pl-9"
                                value={formData.currentPassword}
                                onChange={e => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                required
                                maxLength={20}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="new">New PIN</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="new"
                                type="password"
                                placeholder="****"
                                className="pl-9"
                                value={formData.newPassword}
                                onChange={e => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                                required
                                maxLength={20}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirm">Confirm New PIN</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="confirm"
                                type="password"
                                placeholder="****"
                                className="pl-9"
                                value={formData.confirmNewPassword}
                                onChange={e => setFormData(prev => ({ ...prev, confirmNewPassword: e.target.value }))}
                                required
                                maxLength={20}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ChangePinDialog;
