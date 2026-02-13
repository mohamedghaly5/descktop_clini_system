import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { getLabOrders, getLabs, LabOrderOverview, Lab } from '@/services/labService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FlaskConical, Loader2, Plus, CheckSquare, Search, Filter, Trash2 } from 'lucide-react';
import LabOrderDialog from '@/components/lab/LabOrderDialog';
import LabBalanceSummary from '@/components/lab/LabBalanceSummary';
import ReceiveOrderDialog from '@/components/lab/ReceiveOrderDialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteLabOrder } from '@/services/labService';
import { toast } from 'sonner';

const LabOrders: React.FC = () => {
    const { t, language } = useLanguage();
    const { hasPermission } = useAuth();
    const { formatCurrency } = useSettings();
    const [orders, setOrders] = useState<LabOrderOverview[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<LabOrderOverview | null>(null);
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

    // Delete State
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState<LabOrderOverview | null>(null);

    const handleDeleteClick = (order: LabOrderOverview) => {
        setOrderToDelete(order);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async (deleteExpense: boolean) => {
        if (!orderToDelete) return;

        try {
            const result = await deleteLabOrder(orderToDelete.order_id, deleteExpense);
            if (result.success) {
                toast.success(t('expenses.toast.deleted'));
                fetchOrders();
            } else {
                toast.error(t('error'));
            }
        } catch (e) {
            console.error(e);
            toast.error(t('error'));
        } finally {
            setDeleteConfirmOpen(false);
            setOrderToDelete(null);
        }
    };

    const handleReceive = (order: LabOrderOverview) => {
        setSelectedOrder(order);
        setIsPaymentDialogOpen(true);
    };

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [labFilter, setLabFilter] = useState<string>('all');
    const [labs, setLabs] = useState<Lab[]>([]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const data = await getLabOrders();
            setOrders(data);
        } finally {
            setLoading(false);
        }
    };

    const fetchLabs = async () => {
        const data = await getLabs();
        setLabs(data);
    };

    useEffect(() => {
        fetchOrders();
        fetchLabs();
    }, []);

    const filteredOrders = orders.filter(order => {
        const matchesSearch =
            (order.patient_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.doctor_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.service_name || '').toLowerCase().includes(searchTerm.toLowerCase());

        let matchesLab = true;
        if (labFilter !== 'all') {
            matchesLab = order.lab_id === labFilter;
        }

        return matchesSearch && matchesLab;
    });

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-6 animate-fade-in pb-20 min-h-screen">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card/50 p-4 rounded-2xl border backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 text-blue-600 ring-1 ring-blue-500/20 shadow-sm">
                        <FlaskConical className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            {language === 'ar' ? 'تتبع طلبات المعمل' : 'Track Lab Orders'}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {language === 'ar' ? 'إدارة سير عمل الحالات ومتابعة التكاليف' : 'Manage workflow and track costs'}
                        </p>
                    </div>
                </div>

                {hasPermission('ADD_LAB_ORDER') && (
                    <Button
                        onClick={() => setIsDialogOpen(true)}
                        className="w-full md:w-auto gap-2 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0"
                    >
                        <Plus className="w-5 h-5" />
                        {language === 'ar' ? 'طلب جديد' : 'New Order'}
                    </Button>
                )}
            </div>

            {/* Stats Summary */}
            <LabBalanceSummary orders={orders} onRefresh={fetchOrders} />

            {/* Search & Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-background/50 p-1 rounded-xl">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={language === 'ar' ? 'بحث عن مريض، طبيب، أو خدمة...' : 'Search patient, doctor, or service...'}
                        className="pl-10 h-11 bg-card border-transparent shadow-sm hover:bg-card/80 transition-colors"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={labFilter} onValueChange={setLabFilter}>
                    <SelectTrigger className="w-full md:w-[220px] h-11 bg-card border-transparent shadow-sm">
                        <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder={language === 'ar' ? 'تصفية حسب المعمل' : 'Filter by Lab'} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{language === 'ar' ? 'كل المعامل' : 'All Labs'}</SelectItem>
                        {labs.map((lab) => (
                            <SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Kanban Board Layout */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed border-muted">
                    <FlaskConical className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground text-lg">
                        {language === 'ar' ? 'لا توجد طلبات تطابق بحثك' : 'No orders matching your filters'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                    {/* Column 1: Active / In Progress */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                            <h3 className="font-bold text-lg text-foreground/80">
                                {language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}
                            </h3>
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-mono">
                                {filteredOrders.filter(o => o.order_status === 'in_progress').length}
                            </span>
                        </div>

                        <div className="grid gap-3">
                            {filteredOrders.filter(o => o.order_status === 'in_progress').map(order =>
                                <LabOrderCard
                                    key={order.order_id}
                                    order={order}
                                    labName={labs.find(l => l.id === order.lab_id)?.name}
                                    onReceive={() => handleReceive(order)}
                                    onDelete={() => handleDeleteClick(order)}
                                    language={language}
                                    t={t}
                                    formatCurrency={formatCurrency}
                                    hasPermission={hasPermission}
                                />
                            )}
                            {filteredOrders.filter(o => o.order_status === 'in_progress').length === 0 && (
                                <div className="p-8 text-center text-muted-foreground/50 bg-muted/10 rounded-2xl border border-dashed">
                                    {language === 'ar' ? 'لا توجد طلبات جارية' : 'No active orders'}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column 2: Received / Completed */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <h3 className="font-bold text-lg text-foreground/80">
                                {language === 'ar' ? 'تم الاستلام' : 'Received'}
                            </h3>
                            <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full text-xs font-mono">
                                {filteredOrders.filter(o => o.order_status === 'received').length}
                            </span>
                        </div>

                        <div className="grid gap-3">
                            {filteredOrders.filter(o => o.order_status === 'received').map(order =>
                                <LabOrderCard
                                    key={order.order_id}
                                    order={order}
                                    labName={labs.find(l => l.id === order.lab_id)?.name}
                                    onReceive={() => handleReceive(order)}
                                    onDelete={() => handleDeleteClick(order)}
                                    language={language}
                                    t={t}
                                    formatCurrency={formatCurrency}
                                    hasPermission={hasPermission}
                                />
                            )}
                            {filteredOrders.filter(o => o.order_status === 'received').length === 0 && (
                                <div className="p-8 text-center text-muted-foreground/50 bg-muted/10 rounded-2xl border border-dashed">
                                    {language === 'ar' ? 'لا توجد طلبات مستلمة' : 'No received orders'}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            )}

            <LabOrderDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={fetchOrders}
            />

            <ReceiveOrderDialog
                open={isPaymentDialogOpen}
                onOpenChange={setIsPaymentDialogOpen}
                order={selectedOrder}
                onSuccess={fetchOrders}
            />

            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('expenses.delete.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {orderToDelete && orderToDelete.total_paid > 0
                                ? (language === 'ar'
                                    ? 'هذا الطلب مرتبط بمصروفات مالية. هل تريد حذف الطلب فقط أم حذف الطلب والمصروفات المرتبطة به؟'
                                    : 'This order has linked financial expenses. Do you want to delete only the order, or also delete the linked expenses?')
                                : t('expenses.delete.desc')
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>

                        {orderToDelete && orderToDelete.total_paid > 0 ? (
                            <>
                                <Button variant="destructive" onClick={() => confirmDelete(true)}>
                                    {language === 'ar' ? 'حذف الطلب والمصروفات' : 'Delete Order & Expenses'}
                                </Button>
                                <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => confirmDelete(false)}>
                                    {language === 'ar' ? 'حذف الطلب فقط' : 'Delete Order Only'}
                                </Button>
                            </>
                        ) : (
                            <AlertDialogAction onClick={() => confirmDelete(false)} className="bg-destructive hover:bg-destructive/90">
                                {t('delete')}
                            </AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

// --- Sub-Component: Lab Order Card ---
const LabOrderCard = ({
    order,
    labName,
    onReceive,
    onDelete,
    language,
    t,
    formatCurrency,
    hasPermission
}: {
    order: LabOrderOverview;
    labName?: string;
    onReceive: () => void;
    onDelete: () => void;
    language: string;
    t: any;
    formatCurrency: any;
    hasPermission: any;
}) => {
    const isReceived = order.order_status === 'received';
    const statusColor = isReceived ? 'bg-emerald-500' : 'bg-blue-500';
    const borderColor = isReceived ? 'group-hover:border-emerald-500/50' : 'group-hover:border-blue-500/50';

    return (
        <div className={`group relative bg-card hover:bg-card/80 border text-card-foreground shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl overflow-hidden ${borderColor}`}>
            {/* Colored Status Strip */}
            <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${statusColor} opacity-70 group-hover:opacity-100 transition-opacity`} />
            <div className={`absolute top-0 bottom-0 right-0 w-1.5 ${statusColor} opacity-70 group-hover:opacity-100 transition-opacity`} style={{ left: 'auto' }} />
            {/* Only show strip on logical "start" side based on dir? actually one side is enough usually, let's stick to start side via css logical props or just left for now, but UI shows left strips in image. Let's do simple Start strip. */}
            <div className={`absolute inset-y-0 ${language === 'ar' ? 'right-0' : 'left-0'} w-1.5 ${statusColor}`} />

            <div className={`p-4 ${language === 'ar' ? 'pr-5' : 'pl-5'}`}>
                {/* Header: Name and Status */}
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h4 className="font-bold text-lg leading-tight text-foreground/90">{order.patient_name || (language === 'ar' ? 'مريض غير معروف' : 'Unknown Patient')}</h4>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground font-medium">
                            <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">{order.service_name}</span>
                            <span>•</span>
                            <span className="text-primary/70">{labName}</span>
                        </div>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                        <span className="truncate max-w-[100px]">{order.doctor_name}</span>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                        <span className="ltr-nums bg-secondary/30 px-2 py-1 rounded font-mono">{order.sent_date}</span>
                    </div>
                </div>

                {/* Cost Info */}
                <div className="bg-secondary/10 -mx-4 -mb-4 p-3 mt-auto border-t flex items-center justify-between group-hover:bg-secondary/20 transition-colors">
                    <div className="flex flex-col text-xs">
                        <span className="text-muted-foreground/70 mb-0.5">{language === 'ar' ? 'التكلفة' : 'Cost'}</span>
                        <span className="font-bold text-sm ltr-nums">{formatCurrency(order.total_lab_cost, language)}</span>
                    </div>

                    {order.remaining_balance > 0 && (
                        <div className="flex flex-col text-xs text-end">
                            <span className="text-muted-foreground/70 mb-0.5">{language === 'ar' ? 'المتبقي' : 'Due'}</span>
                            <span className="font-bold text-sm text-destructive ltr-nums">{formatCurrency(order.remaining_balance, language)}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 ltr:ml-4 rtl:mr-4 border-l ltr:pl-3 rtl:pr-3 rtl:border-l-0 rtl:border-r border-border/50">
                        {!isReceived && hasPermission('LAB_STATUS_UPDATE') && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 rounded-full"
                                onClick={(e) => { e.stopPropagation(); onReceive(); }}
                                title={language === 'ar' ? 'استلام' : 'Receive'}
                            >
                                <CheckSquare className="w-4 h-4" />
                            </Button>
                        )}
                        {hasPermission('DELETE_LAB_ORDER') && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                title={t('delete')}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LabOrders;
