import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Calendar, Trash2, FileSpreadsheet, Wallet, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getInvoices, Invoice, deleteInvoice } from '@/services/appointmentService';
import { getPatients, Patient } from '@/services/patientService';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/utils/format';

const AccountsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { formatCurrency } = useSettings();
  const { user, hasPermission } = useAuth();
  const canViewFinancials = hasPermission('VIEW_FINANCIAL_REPORTS');
  const canViewPayments = hasPermission('VIEW_PAYMENTS');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  const loadData = async () => {
    const fetchedInvoices = await getInvoices(user?.email);
    setInvoices(fetchedInvoices);
    const fetchedPatients = await getPatients(user?.email);
    setPatients(fetchedPatients);
  };

  useEffect(() => {
    loadData();

    const handleStorage = () => loadData();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const getPatientName = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return language === 'ar' ? 'مريض محذوف' : 'Deleted Patient';
    return patient.name || (language === 'ar' ? 'مريض محذوف' : 'Deleted Patient');
  };

  const handleDeleteClick = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (invoiceToDelete) {
      const deleted = deleteInvoice(invoiceToDelete.id);
      if (deleted) {
        loadData();
        toast({
          title: language === 'ar' ? 'تم الحذف' : 'Deleted',
          description: language === 'ar' ? 'تم حذف الفاتورة بنجاح' : 'Invoice has been deleted successfully',
        });
      }
    }
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
  };

  const handleExport = async () => {
    try {
      const result = await window.api.exportFinancials();
      if (result && result.success) {
        toast({
          title: language === 'ar' ? 'تم التصدير' : 'Exported',
          description: language === 'ar' ? `تم حفظ الملف بنجاح فى: ${result.filePath}` : `File saved successfully to: ${result.filePath}`,
        });
      } else if (result && result.reason === 'canceled') {
        // User canceled
      } else {
        toast({
          title: language === 'ar' ? 'فشل التصدير' : 'Export Failed',
          description: result?.error || 'Unknown error',
          variant: 'destructive'
        });
      }
    } catch (e) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: String(e),
        variant: 'destructive'
      });
    }
  };

  // Calculate summaries
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const summary = {
    thisMonth: invoices
      .filter(inv => {
        const d = new Date(inv.date);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      })
      .reduce((sum, inv) => sum + inv.amountPaid, 0),
    lastMonth: invoices
      .filter(inv => {
        const d = new Date(inv.date);
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
      })
      .reduce((sum, inv) => sum + inv.amountPaid, 0),
    thisYear: invoices
      .filter(inv => new Date(inv.date).getFullYear() === thisYear)
      .reduce((sum, inv) => sum + inv.amountPaid, 0),
  };

  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 50); // Show more items but scrollable

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 animate-fade-in pb-20 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-gray-900 dark:to-gray-800 min-h-screen rounded-3xl">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card/50 p-4 rounded-2xl border backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-600 ring-1 ring-emerald-500/20 shadow-sm">
            <Wallet className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('accounts')}</h1>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? 'إدارة الدفعات والحسابات المالية' : 'Manage payments and financial accounts'}
            </p>
          </div>
        </div>
        <Button
          onClick={handleExport}
          className="w-full md:w-auto gap-2 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-300 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {language === 'ar' ? 'تصدير إكسل' : 'Export Excel'}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Card 1: This Month */}
        <div className="bg-card hover:bg-card/80 border text-card-foreground shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Calendar className="w-16 h-16 text-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">{t('thisMonth')}</span>
            <span className={cn("text-3xl font-bold text-blue-600 dark:text-blue-400 ltr-nums", !canViewFinancials && "blur-md")}>
              {formatCurrency(summary.thisMonth, language)}
            </span>
            <div className="flex items-center gap-1 text-xs text-blue-600/80 mt-2 font-medium bg-blue-50 dark:bg-blue-900/20 w-fit px-2 py-1 rounded-full">
              <ArrowUpRight className="w-3 h-3" />
              {language === 'ar' ? 'إيرادات الشهر الحالي' : 'Current Month Revenue'}
            </div>
          </div>
        </div>

        {/* Card 2: Last Month */}
        <div className="bg-card hover:bg-card/80 border text-card-foreground shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ArrowDownLeft className="w-16 h-16 text-purple-500" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">{t('lastMonth')}</span>
            <span className={cn("text-3xl font-bold text-purple-600 dark:text-purple-400 ltr-nums", !canViewFinancials && "blur-md")}>
              {formatCurrency(summary.lastMonth, language)}
            </span>
            <div className="flex items-center gap-1 text-xs text-purple-600/80 mt-2 font-medium bg-purple-50 dark:bg-purple-900/20 w-fit px-2 py-1 rounded-full">
              <Calendar className="w-3 h-3" />
              {language === 'ar' ? 'الشهر السابق' : 'Previous Month'}
            </div>
          </div>
        </div>

        {/* Card 3: This Year */}
        <div className="bg-card hover:bg-card/80 border text-card-foreground shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp className="w-16 h-16 text-emerald-500" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">{language === 'ar' ? 'هذا العام' : 'This Year'}</span>
            <span className={cn("text-3xl font-bold text-emerald-600 dark:text-emerald-400 ltr-nums", !canViewFinancials && "blur-md")}>
              {formatCurrency(summary.thisYear, language)}
            </span>
            <div className="flex items-center gap-1 text-xs text-emerald-600/80 mt-2 font-medium bg-emerald-50 dark:bg-emerald-900/20 w-fit px-2 py-1 rounded-full">
              <TrendingUp className="w-3 h-3" />
              {language === 'ar' ? 'إجمالي السنة' : 'Total Year Revenue'}
            </div>
          </div>
        </div>

      </div>

      {/* Recent Payments List */}
      <Card className="border-none shadow-md bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <div className="h-6 w-1 rounded-full bg-emerald-500" />
            {language === 'ar' ? 'آخر الدفعات' : 'Recent Payments'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("space-y-3 transition-all duration-300", !canViewPayments && "blur-md select-none pointer-events-none")}>
            {recentInvoices.length === 0 ? (
              <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed border-muted">
                <DollarSign className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-lg">
                  {language === 'ar' ? 'لا توجد فواتير بعد' : 'No invoices yet'}
                </p>
              </div>
            ) : (
              recentInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="group flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-card border hover:border-emerald-500/30 hover:shadow-md transition-all duration-200"
                >
                  {/* Icon & Amount */}
                  <div className="flex items-center gap-4 min-w-[200px]">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-emerald-600 ltr-nums">{formatCurrency(invoice.amountPaid, language)}</p>
                      <p className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded w-fit mt-1">
                        {formatDate(invoice.date, language)}
                      </p>
                    </div>
                  </div>

                  {/* Patient Info */}
                  <div className="flex-1 space-y-1">
                    <h4 className="font-bold text-foreground">{getPatientName(invoice.patientId)}</h4>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <span className="bg-secondary px-2 py-0.5 rounded text-xs">
                        {language === 'ar' ? invoice.serviceNameAr : invoice.serviceName}
                      </span>
                    </p>
                  </div>

                  {/* Details & Actions */}
                  <div className="flex items-center justify-between w-full sm:w-auto gap-6 sm:pl-4 sm:border-l">
                    <div className="text-end">
                      <div className="text-xs text-muted-foreground mb-1">
                        {language === 'ar' ? 'التكلفة الكلية' : 'Total Cost'}
                      </div>
                      <div className="font-medium">{invoice.cost}</div>
                    </div>
                    <div className="text-end">
                      <div className="text-xs text-muted-foreground mb-1">
                        {language === 'ar' ? 'المتبقي' : 'Balance'}
                      </div>
                      <div className={cn("font-medium", invoice.balance > 0 ? "text-destructive" : "text-muted-foreground")}>
                        {invoice.balance}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => canViewPayments && handleDeleteClick(invoice)} // Prevent click
                      disabled={!canViewPayments}
                      className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-full h-10 w-10 transition-colors"
                      title={language === 'ar' ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' ? 'هل تريد حذف هذه الفاتورة؟' : 'Do you want to delete this invoice?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {language === 'ar' ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AccountsPage;