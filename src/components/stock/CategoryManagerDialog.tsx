import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Trash2, Plus } from "lucide-react";
import { db } from '@/services/db';

interface Category {
    id: string;
    name: string;
}

interface CategoryManagerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void; // Trigger parent refresh
}

export const CategoryManagerDialog: React.FC<CategoryManagerDialogProps> = ({ isOpen, onClose, onUpdate }) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [adding, setAdding] = useState(false);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const data = await db.stock.getCategories();
            setCategories(data || []);
        } catch (error) {
            console.error(error);
            toast.error('فشل تحميل الفئات');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
        }
    }, [isOpen]);

    const handleAdd = async () => {
        if (!newCategoryName.trim()) return;
        setAdding(true);
        try {
            const res = await db.stock.addCategory(newCategoryName);
            if (res.success) {
                toast.success('تم إضافة الفئة');
                setNewCategoryName('');
                fetchCategories();
                onUpdate();
            } else {
                toast.error('فشل الإضافة');
            }
        } catch (e) {
            toast.error('حدث خطأ');
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذه الفئة؟ ستصبح الأصناف التابعة لها "غير مصنفة".')) return;
        try {
            const res = await db.stock.deleteCategory(id);
            if (res.success) {
                toast.success('تم الحذف');
                fetchCategories();
                onUpdate();
            } else {
                toast.error('فشل الحذف');
            }
        } catch (e) {
            toast.error('حدث خطأ');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>إدارة فئات الأصناف</DialogTitle>
                    <DialogDescription>
                        قم بإضافة أو حذف الفئات لتنظيم المخزون.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex gap-2 items-end">
                        <div className="grid w-full gap-1.5">
                            <Label htmlFor="cat_name">اسم الفئة الجديدة</Label>
                            <Input
                                id="cat_name"
                                placeholder="مثال: حشو عصب، تركيبات..."
                                value={newCategoryName}
                                onChange={e => setNewCategoryName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            />
                        </div>
                        <Button onClick={handleAdd} disabled={adding || !newCategoryName.trim()}>
                            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            إضافة
                        </Button>
                    </div>

                    <div className="border rounded-md max-h-[300px] overflow-y-auto mt-4">
                        {loading ? (
                            <div className="p-4 text-center text-gray-500">جاري التحميل...</div>
                        ) : categories.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">لا توجد فئات مضافة حالياً.</div>
                        ) : (
                            <div className="divide-y">
                                {categories.map(cat => (
                                    <div key={cat.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                                        <span className="font-medium">{cat.name}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                                            onClick={() => handleDelete(cat.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button variant="outline" onClick={onClose}>إغلاق</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
