import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { User, Calendar, DollarSign, FileText, TrendingUp, Percent } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings } from '@/contexts/SettingsContext';
import { getDoctorReports } from '@/services/appointmentService';

interface DoctorStats {
  doctorId: string;
  doctorName: string;
  totalInvoices: number;
  totalRevenue: number;
  totalPaid: number;
  appointmentsAttended: number;
  uniquePatients: number;
  commission: number;
}

const DoctorReports: React.FC = () => {
  const { language } = useLanguage();
  const { doctors, formatCurrency, calculateDoctorCommission, getDoctorById } = useSettings();

  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all');

  const [invoices, setInvoices] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);

  React.useEffect(() => {
    const fetchData = async () => {
      const { invoices: inv, appointments: apt } = await getDoctorReports(dateFrom, dateTo, selectedDoctor);
      setInvoices(inv);
      setAppointments(apt);
    };
    fetchData();
  }, [dateFrom, dateTo, selectedDoctor]);

  const doctorStats = useMemo(() => {
    // invoices and appointments are now from state

    // Data is already filtered by backend
    const filteredInvoices = invoices;
    const filteredAppointments = appointments;

    // Group by doctor
    const statsMap = new Map<string, DoctorStats>();

    filteredInvoices.forEach(inv => {
      if (selectedDoctor !== 'all' && inv.doctorId !== selectedDoctor) return;

      const doctor = getDoctorById(inv.doctorId);
      const doctorName = doctor
        ? doctor.name
        : (language === 'ar' ? 'طبيب غير نشط' : 'Inactive Doctor');

      if (!statsMap.has(inv.doctorId)) {
        statsMap.set(inv.doctorId, {
          doctorId: inv.doctorId,
          doctorName,
          totalInvoices: 0,
          totalRevenue: 0,
          totalPaid: 0,
          appointmentsAttended: 0,
          uniquePatients: 0,
          commission: 0,
        });
      }

      const stats = statsMap.get(inv.doctorId)!;
      stats.totalInvoices += 1;
      stats.totalRevenue += inv.cost;
      stats.totalPaid += inv.amountPaid;
      stats.commission += calculateDoctorCommission(inv.doctorId, inv.amountPaid);
    });

    // Count appointments and unique patients
    filteredAppointments.forEach(apt => {
      if (!apt.invoiceId) return;
      const invoice = filteredInvoices.find(inv => inv.id === apt.invoiceId);
      if (!invoice) return;
      if (selectedDoctor !== 'all' && invoice.doctorId !== selectedDoctor) return;

      const stats = statsMap.get(invoice.doctorId);
      if (stats) {
        stats.appointmentsAttended += 1;
      }
    });

    // Calculate unique patients per doctor
    const patientsByDoctor = new Map<string, Set<string>>();
    filteredInvoices.forEach(inv => {
      if (selectedDoctor !== 'all' && inv.doctorId !== selectedDoctor) return;

      if (!patientsByDoctor.has(inv.doctorId)) {
        patientsByDoctor.set(inv.doctorId, new Set());
      }
      patientsByDoctor.get(inv.doctorId)!.add(inv.patientId);
    });

    patientsByDoctor.forEach((patients, doctorId) => {
      const stats = statsMap.get(doctorId);
      if (stats) {
        stats.uniquePatients = patients.size;
      }
    });

    return Array.from(statsMap.values());
  }, [dateFrom, dateTo, selectedDoctor, language, getDoctorById, calculateDoctorCommission]);

  const totals = useMemo(() => ({
    totalInvoices: doctorStats.reduce((sum, s) => sum + s.totalInvoices, 0),
    totalRevenue: doctorStats.reduce((sum, s) => sum + s.totalRevenue, 0),
    totalPaid: doctorStats.reduce((sum, s) => sum + s.totalPaid, 0),
    totalCommission: doctorStats.reduce((sum, s) => sum + s.commission, 0),
    totalPatients: doctorStats.reduce((sum, s) => sum + s.uniquePatients, 0),
  }), [doctorStats]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-start flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {language === 'ar' ? 'فلاتر التقرير' : 'Report Filters'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'من تاريخ' : 'From Date'}</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'إلى تاريخ' : 'To Date'}</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'الطبيب' : 'Doctor'}</Label>
              <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">
                    {language === 'ar' ? 'جميع الأطباء' : 'All Doctors'}
                  </SelectItem>
                  {doctors.map(doc => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.name}
                      {!doc.active && ` (${language === 'ar' ? 'غير نشط' : 'Inactive'})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="gradient-primary text-primary-foreground">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 opacity-80" />
              <div className="text-start">
                <p className="text-sm opacity-80">{language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.totalRevenue, language)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gradient-accent text-primary-foreground">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 opacity-80" />
              <div className="text-start">
                <p className="text-sm opacity-80">{language === 'ar' ? 'إجمالي المدفوع' : 'Total Paid'}</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.totalPaid, language)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gradient-success text-primary-foreground">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Percent className="w-8 h-8 opacity-80" />
              <div className="text-start">
                <p className="text-sm opacity-80">{language === 'ar' ? 'إجمالي العمولات' : 'Total Commission'}</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.totalCommission, language)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <User className="w-8 h-8 text-muted-foreground" />
              <div className="text-start">
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'إجمالي المرضى' : 'Total Patients'}</p>
                <p className="text-2xl font-bold text-foreground">{totals.totalPatients}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Doctor Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-start flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            {language === 'ar' ? 'تفاصيل الأداء حسب الطبيب' : 'Performance by Doctor'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {doctorStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{language === 'ar' ? 'لا توجد بيانات في هذه الفترة' : 'No data for this period'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">{language === 'ar' ? 'الطبيب' : 'Doctor'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'الفواتير' : 'Invoices'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'المرضى' : 'Patients'}</TableHead>
                    <TableHead className="text-end">{language === 'ar' ? 'الإيرادات' : 'Revenue'}</TableHead>
                    <TableHead className="text-end">{language === 'ar' ? 'المدفوع' : 'Paid'}</TableHead>
                    <TableHead className="text-end">{language === 'ar' ? 'العمولة' : 'Commission'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doctorStats.map(stats => (
                    <TableRow key={stats.doctorId}>
                      <TableCell className="font-medium text-start">{stats.doctorName}</TableCell>
                      <TableCell className="text-center">{stats.totalInvoices}</TableCell>
                      <TableCell className="text-center">{stats.uniquePatients}</TableCell>
                      <TableCell className="text-end">{formatCurrency(stats.totalRevenue, language)}</TableCell>
                      <TableCell className="text-end">{formatCurrency(stats.totalPaid, language)}</TableCell>
                      <TableCell className="text-end font-semibold text-success">{formatCurrency(stats.commission, language)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DoctorReports;
