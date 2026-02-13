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
import { toast } from "sonner";
import { db } from '@/services/db';

import { Loader2 } from "lucide-react";

interface AddItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        quantity: '',
        min_quantity: '',
        category_id: ''
    });

    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);

    React.useEffect(() => {
        if (isOpen) {
            db.stock.getCategories().then(cats => {
                setCategories(cats || []);
            });
        }
    }, [isOpen]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            toast.error('يرجى إدخال اسم الصنف');
            return;
        }

        setLoading(true);
        try {
            const result = await db.stock.createItem({
                name: formData.name,
                quantity: parseInt(formData.quantity) || 0,
                min_quantity: parseInt(formData.min_quantity) || 0,
                category_id: formData.category_id || null
            });

            if (result.success) {
                toast.success('تمت إضافة الصنف بنجاح');
                setFormData({ name: '', quantity: '', min_quantity: '', category_id: '' });
                onSuccess();
                onClose();
            } else {
                toast.error('فشل إضافة الصنف: ' + result.error);
            }
        } catch (error: any) {
            toast.error('حدث خطأ غير متوقع');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>إضافة صنف جديد للمخزن</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">اسم الصنف</Label>
                        <Input
                            id="name"
                            placeholder="مثال: قطن طبي، حقن بنج..."
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">الفئة (اختياري)</Label>
                        <select
                            id="category"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.category_id}
                            onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                        >
                            <option value="">-- بدون فئة --</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="quantity">الكمية الحالية</Label>
                            <Input
                                id="quantity"
                                type="number"
                                min="0"
                                placeholder="0"
                                value={formData.quantity}
                                onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="min_quantity">الحد الأدنى (للتنبيه)</Label>
                            <Input
                                id="min_quantity"
                                type="number"
                                min="0"
                                placeholder="0"
                                value={formData.min_quantity}
                                onChange={(e) => setFormData(prev => ({ ...prev, min_quantity: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            حفظ
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
