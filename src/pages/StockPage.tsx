import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Package,
    Search,
    Plus,
    Minus,
    AlertTriangle,
    RefreshCw,
    FolderPlus,
    Tags,
    Trash2,
    FileBarChart
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AddItemModal } from '@/components/stock/AddItemModal';
import { SubtractItemModal } from '@/components/stock/SubtractItemModal';
import { StockReportDialog } from '@/components/stock/StockReportDialog';
import { CategoryManagerDialog } from '@/components/stock/CategoryManagerDialog';
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StockItem {
    id: number;
    clinic_id: string;
    name: string;
    quantity: number;
    min_quantity: number;
    updated_at: string;
    category_id?: string;
    category_name?: string;
}

const StockPage = () => {
    const { hasPermission, user } = useAuth();
    const [items, setItems] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Modals State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const [subtractItem, setSubtractItem] = useState<StockItem | null>(null);

    const fetchItems = async () => {
        setLoading(true);
        try {
            // @ts-ignore
            if ((window as any).electron) {
                // @ts-ignore
                const data = await window.electron.ipcRenderer.invoke('stock:get-items');
                setItems(data || []);
            } else {
                const serverUrl = localStorage.getItem('server_url');
                if (serverUrl) {
                    const token = localStorage.getItem('session_token') || sessionStorage.getItem('session_token');
                    const res = await axios.get(`${serverUrl}/api/stock/items`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setItems(res.data || []);
                }
            }
        } catch (error) {
            console.error('Failed to fetch stock items', error);
            toast.error('فشل تحميل بيانات المخزن');
        } finally {
            setLoading(false);
        }
    };

    const handleQuickAdjust = async (item: StockItem, change: number) => {
        if (change < 0 && item.quantity <= 0) return;

        try {
            // @ts-ignore
            if ((window as any).electron) {
                const amountToSend = -change;
                // @ts-ignore
                const res = await window.electron.ipcRenderer.invoke('stock:subtract-item', {
                    id: item.id,
                    amount: amountToSend,
                    reason: 'تعديل سريع'
                });

                if (res.error) throw new Error(res.error);
                toast.success(change > 0 ? 'تم إضافة 1' : 'تم خصم 1');
                fetchItems();
            } else {
                toast.error('التعديل السريع غير متاح على الموبايل حالياً');
            }
        } catch (error) {
            console.error(error);
            toast.error('فشل تعديل الكمية');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('هل أنت متأكد من حذف هذا الصنف نهائياً؟')) return;
        try {
            // @ts-ignore
            if ((window as any).api && (window as any).api.dbDelete) {
                // @ts-ignore
                const res = await window.api.dbDelete('stock_items', id);
                if (res.error) throw new Error(res.error);
                toast.success('تم حذف الصنف');
                fetchItems();
            } else {
                toast.error('الحذف غير متاح من الموبايل حالياً');
            }
        } catch (error) {
            console.error(error);
            toast.error('فشل حذف الصنف');
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase())
    );

    // Group items by category
    const groupedItems = React.useMemo(() => {
        const groups: Record<string, StockItem[]> = {};
        const uncategorized: StockItem[] = [];

        filteredItems.forEach(item => {
            if (item.category_name) {
                if (!groups[item.category_name]) {
                    groups[item.category_name] = [];
                }
                groups[item.category_name].push(item);
            } else {
                uncategorized.push(item);
            }
        });

        const sortedGroups = Object.keys(groups).sort().map(key => ({
            name: key,
            items: groups[key]
        }));

        return { sortedGroups, uncategorized };
    }, [filteredItems]);

    // Sub-component for individual item card
    const StockItemCard = ({ item }: { item: StockItem }) => {
        const isLow = item.quantity <= item.min_quantity;
        return (
            <div className={`
                group relative flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl border
                transition-all duration-300 hover:shadow-md bg-card
                ${isLow ? 'border-red-200/50 bg-red-50/10 dark:bg-red-950/10' : 'hover:border-primary/20'}
            `}>
                {/* Visual Indicator for Low Stock */}
                {isLow && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-l-xl" />}

                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className={`p-3 rounded-xl shadow-sm ${isLow ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-secondary/50 text-primary'}`}>
                        {isLow ? <AlertTriangle className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                    </div>
                    <div>
                        <h4 className="font-bold text-lg text-foreground">{item.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>الحد الأدنى: {item.min_quantity}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between w-full sm:w-auto gap-6 sm:mt-0 mt-4 border-t sm:border-t-0 pt-4 sm:pt-0">
                    <div className="text-center min-w-[3rem]">
                        <span className={cn("text-2xl font-bold ltr-nums", isLow ? "text-red-500" : "text-foreground")}>
                            {item.quantity}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">الكمية</span>
                    </div>

                    {hasPermission('SUBTRACT_ITEM') && (
                        <div className="flex items-center bg-muted/40 p-1 rounded-lg border">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-red-100 hover:text-red-600 rounded-md"
                                onClick={() => handleQuickAdjust(item, -1)}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <div className="w-px h-4 bg-border mx-1" />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-emerald-100 hover:text-emerald-600 rounded-md"
                                onClick={() => handleQuickAdjust(item, 1)}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {user?.role === 'admin' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                            onClick={() => handleDelete(item.id)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-6 animate-fade-in pb-20 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-gray-900 dark:to-gray-800 min-h-screen rounded-3xl">

            {/* Header Section */}
            <div className="flex flex-col items-start gap-4 bg-card/50 p-6 rounded-2xl border backdrop-blur-sm">
                <div className="flex items-center gap-3 w-full">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 text-cyan-600 ring-1 ring-cyan-500/20 shadow-sm">
                        <Package className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            المخزن والمستلزمات
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            إدارة وتصنيف المستلزمات الطبية ومتابعة الكميات
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full">
                    <StockReportDialog disabled={!hasPermission('VIEW_STOCK_REPORTS')} />

                    {hasPermission('ADD_ITEM') && (
                        <>
                            <Button onClick={() => setIsCategoryOpen(true)} variant="outline" className="gap-2 bg-background/50 backdrop-blur-sm">
                                <Tags className="h-4 w-4" />
                                الفئات
                            </Button>
                            <Button
                                onClick={() => setIsAddOpen(true)}
                                className="gap-2 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all duration-300 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white border-0"
                            >
                                <Plus className="h-4 w-4" />
                                إضافة صنف
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Content & Search */}
            <div className="space-y-4">
                <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md p-2 -m-2 mb-2 rounded-xl border shadow-sm">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="بحث عن صنف بالاسم..."
                            className="pr-10 h-11 bg-card border-none shadow-none focus-visible:ring-1"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={fetchItems}
                            disabled={loading}
                            className="absolute left-1 top-1 h-9 w-9 p-0"
                        >
                            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", loading && "animate-spin")} />
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw className="w-10 h-10 animate-spin text-primary opacity-50" />
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed border-muted">
                        <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground text-lg">
                            لا توجد أصناف تطابق بحثك
                        </p>
                    </div>
                ) : (
                    <Accordion type="multiple" defaultValue={groupedItems.sortedGroups.map(g => g.name)} className="space-y-4">
                        {/* Categorized Items */}
                        {groupedItems.sortedGroups.map((group) => (
                            <AccordionItem key={group.name} value={group.name} className="border-none rounded-2xl bg-white/40 dark:bg-gray-900/40 shadow-sm overflow-hidden">
                                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-white/60 dark:hover:bg-gray-800/60 font-semibold text-lg group">
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300">
                                            <FolderPlus className="w-5 h-5" />
                                        </div>
                                        <span>{group.name}</span>
                                        <Badge variant="secondary" className="mr-auto font-normal">
                                            {group.items.length}
                                        </Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-0 p-4">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {group.items.map(item => (
                                            <StockItemCard key={item.id} item={item} />
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}

                        {/* Uncategorized Items */}
                        {groupedItems.uncategorized.length > 0 && (
                            <AccordionItem value="uncategorized" className="border-none rounded-2xl bg-white/40 dark:bg-gray-900/40 shadow-sm overflow-hidden">
                                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-white/60 dark:hover:bg-gray-800/60 font-semibold text-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                            <Package className="w-5 h-5" />
                                        </div>
                                        <span>أصناف عامة</span>
                                        <Badge variant="secondary" className="mr-auto font-normal">
                                            {groupedItems.uncategorized.length}
                                        </Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-0 p-4">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {groupedItems.uncategorized.map(item => (
                                            <StockItemCard key={item.id} item={item} />
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )}
                    </Accordion>
                )}
            </div>

            <AddItemModal
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                onSuccess={fetchItems}
            />

            <SubtractItemModal
                isOpen={!!subtractItem}
                item={subtractItem}
                onClose={() => setSubtractItem(null)}
                onSuccess={fetchItems}
            />

            <CategoryManagerDialog
                isOpen={isCategoryOpen}
                onClose={() => setIsCategoryOpen(false)}
                onUpdate={fetchItems}
            />
        </div>
    );
};

export default StockPage;
