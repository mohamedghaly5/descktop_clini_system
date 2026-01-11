import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import {
  Calendar, DollarSign, CheckCircle, XCircle, Clock,
  Send, FileText
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useSettings } from '@/contexts/SettingsContext';

interface DailyReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email?: string | null;
}

const DailyReportDialog: React.FC<DailyReportDialogProps> = ({ open, onOpenChange, email }) => {
  const { clinicInfo, formatCurrency } = useSettings();
  const [selectedDate, setSelectedDate] = React.useState(() => format(new Date(), 'yyyy-MM-dd'));

  const [reportData, setReportData] = React.useState({
    totalRevenue: 0,
    patientCount: 0,
    completedAppointments: 0
  });

  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await window.api.getDailyReport(selectedDate, email);
        setReportData(data);
      } catch (e) {
        console.error("Failed to load daily report", e);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchReport();
    }
  }, [open, selectedDate, email]);

  const generateWhatsAppMessage = () => {
    const lines = [
      `📊 *تقرير اليوم (${selectedDate})*`,
      `💰 الإجمالي: ${formatCurrency(reportData.totalRevenue, 'ar')}`,
      `👥 عدد المرضى: ${reportData.patientCount}`,
      `✅ تم الكشف: ${reportData.completedAppointments}`,
    ];
    return lines.join('\\n');
  };

  const handleSendWhatsApp = () => {
    const message = generateWhatsAppMessage();
    const encodedMessage = encodeURIComponent(message);
    // Use WhatsApp number if available, otherwise use phone
    const phoneToUse = clinicInfo.whatsappNumber || clinicInfo.phone;
    // Clean phone number - remove spaces and special chars except +
    const cleanPhone = phoneToUse.replace(/[^\d+]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-start">
            <Calendar className="w-5 h-5 text-primary" />
            التقرير اليومي
          </DialogTitle>
        </DialogHeader>

        {/* Date Picker */}
        <div className="space-y-2">
          <Label>اختر التاريخ</Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full"
          />
        </div>

        {loading ? (
          <div className="flex justify-center p-10">
            <span className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : reportData.totalRevenue === 0 && reportData.patientCount === 0 && reportData.completedAppointments === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">لا توجد بيانات لهذا اليوم</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Appointments Summary */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                ملخص المواعيد
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-primary/10">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-primary">{reportData.patientCount}</p>
                    <p className="text-xs text-muted-foreground">عدد المرضى</p>
                  </CardContent>
                </Card>
                <Card className="bg-success/10">
                  <CardContent className="p-4 text-center">
                    <CheckCircle className="w-5 h-5 mx-auto text-success mb-1" />
                    <p className="text-xl font-bold text-success">{reportData.completedAppointments}</p>
                    <p className="text-xs text-muted-foreground">تم الكشف</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Separator />

            {/* Financial Summary */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                الملخص المالي
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <Card className="gradient-primary text-primary-foreground">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs opacity-80">إجمالي الإيرادات</p>
                    <p className="text-xl font-bold ltr-nums">{formatCurrency(reportData.totalRevenue, 'ar')}</p>
                  </CardContent>
                </Card>
              </div>
            </div>





            <Separator />

            {/* WhatsApp Button */}
            <Button
              onClick={handleSendWhatsApp}
              className="w-full gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white"
              size="lg"
            >
              <Send className="w-5 h-5" />
              إرسال عبر واتساب
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DailyReportDialog;
