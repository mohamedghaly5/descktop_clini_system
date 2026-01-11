import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings } from '@/contexts/SettingsContext';
import { getLabOrders, getLabs, LabOrderOverview, Lab } from '@/services/labService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FlaskConical, Loader2, Plus, CheckSquare, Search, Filter } from 'lucide-react';
import LabOrderDialog from '@/components/lab/LabOrderDialog';
import LabBalanceSummary from '@/components/lab/LabBalanceSummary';
import ReceiveOrderDialog from '@/components/lab/ReceiveOrderDialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
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
    // ...
    const { t, language } = useLanguage();
    // ...
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

    // Check for late status dynamically for display
    const isLate = (order: LabOrderOverview) => {
        if (order.order_status !== 'in_progress') return false;
        if (!order.expected_receive_date) return false;
        const today = new Date().toISOString().split('T')[0];
        return order.expected_receive_date < today;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'received': return 'success'; // Green
            case 'late': return 'destructive'; // Red
            case 'in_progress':
            default: return 'outline'; // Neutral/Gray
        }
    };

    const getStatusLabel = (status: string) => {
        return t(`lab.status.${status}`);
    };



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
        <div className="container mx-auto p-6 space-y-6 animate-fade-in pb-20">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary">
                        <FlaskConical className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {language === 'ar' ? 'طلبات المعمل' : 'Lab Orders'}
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {language === 'ar' ? 'عرض ومتابعة طلبات المعمل' : 'View and track lab orders'}
                        </p>
                    </div>
                </div>
                <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    {language === 'ar' ? 'طلب جديد' : 'New Order'}
                </Button>
            </div>

            {/* Lab Balance Summary */}
            <LabBalanceSummary orders={orders} onRefresh={fetchOrders} />

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

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={language === 'ar' ? 'بحث (مريض، طبيب، خدمة)...' : 'Search (Patient, Doctor, Service)...'}
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={labFilter} onValueChange={setLabFilter}>
                    <SelectTrigger className="w-[180px]">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder={language === 'ar' ? 'المعمل' : 'Lab'} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{language === 'ar' ? 'كل المعامل' : 'All Labs'}</SelectItem>
                        {labs.map((lab) => (
                            <SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">
                        {language === 'ar' ? 'قائمة الطلبات' : 'Orders List'} ({filteredOrders.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground">
                            {language === 'ar' ? 'لا توجد طلبات تطابق بحثك' : 'No orders matching your filters'}
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-start">{language === 'ar' ? 'المريض' : 'Patient'}</TableHead>
                                        <TableHead className="text-start">{language === 'ar' ? 'الخدمة' : 'Service'}</TableHead>
                                        <TableHead className="text-start">{language === 'ar' ? 'الطبيب' : 'Doctor'}</TableHead>
                                        <TableHead className="text-center">{language === 'ar' ? 'تاريخ الارسال' : 'Sent Date'}</TableHead>
                                        <TableHead className="text-center">{language === 'ar' ? 'التاريخ المتوقع' : 'Expected Date'}</TableHead>
                                        <TableHead className="text-center">{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                                        <TableHead className="text-end">{language === 'ar' ? 'التكلفة' : 'Cost'}</TableHead>
                                        <TableHead className="text-end">{language === 'ar' ? 'المدفوع' : 'Paid'}</TableHead>
                                        <TableHead className="text-end">{language === 'ar' ? 'المتبقي' : 'Remaining'}</TableHead>
                                        <TableHead className="text-center w-[100px]">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredOrders.map((order) => {
                                        const isLate = order.order_status === 'in_progress' && new Date(order.expected_receive_date) < new Date(new Date().setHours(0, 0, 0, 0));
                                        return (
                                            <TableRow key={order.order_id}>
                                                <TableCell className="font-medium">{order.patient_name || '-'}</TableCell>
                                                <TableCell>{order.service_name || '-'}</TableCell>
                                                <TableCell>{order.doctor_name || '-'}</TableCell>
                                                <TableCell className="text-center ltr-nums text-muted-foreground text-sm">
                                                    {order.sent_date}
                                                </TableCell>
                                                <TableCell className={`text-center ltr-nums text-sm ${isLate ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                                                    {order.expected_receive_date}
                                                    {isLate && <span className="block text-[10px] text-red-500">{t('lab.status.late')}</span>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={getStatusColor(order.order_status) as any}>
                                                        {getStatusLabel(order.order_status)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-end ltr-nums font-medium">
                                                    {formatCurrency(order.total_lab_cost, language)}
                                                </TableCell>
                                                <TableCell className="text-end ltr-nums text-green-600">
                                                    {formatCurrency(order.total_paid, language)}
                                                </TableCell>
                                                <TableCell className={formatCurrency(order.remaining_balance, language) !== formatCurrency(0, language) ? "text-end ltr-nums text-red-600 font-bold" : "text-end ltr-nums text-muted-foreground"}>
                                                    {formatCurrency(order.remaining_balance, language)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {order.order_status !== 'received' && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => handleReceive(order)}
                                                            title={language === 'ar' ? 'تحديد كمستلم' : 'Mark Received'}
                                                        >
                                                            <CheckSquare className="h-4 w-4 text-primary" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDeleteClick(order)}
                                                        title={t('delete')}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default LabOrders;
