import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Calendar, Download, Trash2, FileSpreadsheet } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { getInvoices, Invoice, deleteInvoice } from '@/services/appointmentService';
import { getPatients, Patient } from '@/services/patientService';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/utils/format';

const AccountsPage: React.FC = () => {
  const { t, isRTL, language } = useLanguage();
  const { formatCurrency } = useSettings();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  const loadData = async () => {
    const fetchedInvoices = await getInvoices();
    setInvoices(fetchedInvoices);
    const fetchedPatients = await getPatients();
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
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('accounts')}</h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'إدارة الدفعات والحسابات' : 'Manage payments and accounts'}
          </p>
        </div>
        <Button variant="outline" className="flex items-center gap-2" onClick={handleExport}>
          <FileSpreadsheet className="w-4 h-4" />
          {language === 'ar' ? 'تصدير بيانات إكسل شامل' : 'Export Full Excel'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card variant="stat" className="animate-fade-in">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('thisMonth')}</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.thisMonth, language)}</p>
              </div>
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="stat" className="animate-fade-in delay-100" style={{ animationDelay: '100ms' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('lastMonth')}</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.lastMonth, language)}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                <Calendar className="w-6 h-6 text-secondary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="stat" className="animate-fade-in delay-200" style={{ animationDelay: '200ms' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'هذا العام' : 'This Year'}</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.thisYear, language)}</p>
              </div>
              <div className="w-12 h-12 rounded-xl gradient-success flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-success-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments */}
      <Card variant="elevated" className="animate-fade-in delay-300" style={{ animationDelay: '300ms' }}>
        <CardHeader>
          <CardTitle>
            {language === 'ar' ? 'آخر الدفعات' : 'Recent Payments'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentInvoices.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {language === 'ar' ? 'لا توجد فواتير بعد' : 'No invoices yet'}
              </p>
            ) : (
              recentInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  {/* Amount - Start side */}
                  <div className="min-w-[100px] text-start">
                    <p className="font-bold text-success">{formatCurrency(invoice.amountPaid, language)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(invoice.date, language)}
                    </p>
                  </div>

                  {/* Patient & Service Info - Center */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full gradient-accent flex items-center justify-center shrink-0">
                      <DollarSign className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div className="text-start flex-1">
                      <p className="font-medium">{getPatientName(invoice.patientId)}</p>
                      <p className="text-sm text-muted-foreground">
                        {language === 'ar' ? invoice.serviceNameAr : invoice.serviceName}
                      </p>
                    </div>
                  </div>

                  {/* Cost & Balance Info - End side */}
                  <div className="min-w-[120px] text-end">
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? `التكلفة: ${invoice.cost}` : `Cost: ${invoice.cost}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? `المتبقي: ${invoice.balance}` : `Balance: ${invoice.balance}`}
                    </p>
                  </div>

                  {/* Delete Button */}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDeleteClick(invoice)}
                    className="text-destructive hover:bg-destructive/10 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
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