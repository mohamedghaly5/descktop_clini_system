import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface SubtractItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    item: {
        id: number;
        name: string;
        quantity: number; // Current quantity
    } | null;
}

export const SubtractItemModal: React.FC<SubtractItemModalProps> = ({ isOpen, onClose, onSuccess, item }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        amount: '',
        reason: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!item) return;

        const amount = parseInt(formData.amount);
        if (!amount || amount <= 0) {
            toast.error('يرجى إدخال كمية صحيحة');
            return;
        }

        if (amount > item.quantity) {
            toast.error('الكمية المراد خصمها أكبر من الرصيد الحالي');
            return;
        }

        setLoading(true);
        try {
            // @ts-ignore
            const result = await window.electron.ipcRenderer.invoke('stock:subtract-item', {
                id: item.id,
                amount: amount,
                reason: formData.reason
            });

            if (result.success) {
                toast.success(`تم خصم ${amount} من ${item.name}`);
                setFormData({ amount: '', reason: '' });
                onSuccess();
                onClose();
            } else {
                toast.error('فشل العملية: ' + result.error);
            }
        } catch (error: any) {
            toast.error('حدث خطأ غير متوقع');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!item) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>صرف / خصم كمية - {item.name}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">

                    <div className="p-3 bg-muted rounded-md text-sm">
                        الرصيد الحالي: <span className="font-bold">{item.quantity}</span>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="amount">الكمية المراد خصمها</Label>
                        <Input
                            id="amount"
                            type="number"
                            min="1"
                            max={item.quantity}
                            autoFocus
                            value={formData.amount}
                            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reason">السبب / الملاحظات (اختياري)</Label>
                        <Textarea
                            id="reason"
                            placeholder="مثال: استهلاك العيادة، تالف، ..."
                            value={formData.reason}
                            onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            إلغاء
                        </Button>
                        <Button type="submit" variant="destructive" disabled={loading}>
                            {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            تأكيد الخصم
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
