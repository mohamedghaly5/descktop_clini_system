import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Plus, CheckCircle, XCircle, AlertCircle, Trash2, MessageCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Appointment,
  getAppointments,
  updateAppointment,
  deleteAppointment,
} from '@/services/appointmentService';
import { getPatientById, Patient } from '@/services/patientService';
import { BookAppointmentDialog } from '@/components/appointments/BookAppointmentDialog';
import { MarkAttendedDialog } from '@/components/appointments/MarkAttendedDialog';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/utils/format';

// Helper to get patient name from appointment (handles deleted patients)
const getAppointmentPatientName = (appointment: Appointment, patientsCache: Map<string, Patient | null>, language: string): string => {
  const cached = patientsCache.get(appointment.patientId);
  if (cached === null) {
    return language === 'ar' ? 'مريض محذوف' : 'Deleted Patient';
  }
  if (cached) {
    return cached.name || appointment.patientName;
  }
  return appointment.patientName || appointment.patientNameAr || (language === 'ar' ? 'مريض محذوف' : 'Deleted Patient');
};

const AppointmentsPage: React.FC = () => {
  const { t, isRTL, language } = useLanguage();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patientsCache, setPatientsCache] = useState<Map<string, Patient | null>>(new Map());
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [attendedDialogOpen, setAttendedDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);

  const loadAppointments = async () => {
    try {
      const loadedAppointments = await getAppointments(user?.email);
      setAppointments(loadedAppointments);

      const cache = new Map<string, Patient | null>();
      // Gather unique patient IDs
      const uniqueIds = Array.from(new Set(loadedAppointments.map(a => a.patientId)));

      // Fetch patients in parallel (or optimized if service supported bulk)
      await Promise.all(uniqueIds.map(async (id) => {
        const patient = await getPatientById(id);
        cache.set(id, patient || null);
      }));
      setPatientsCache(cache);
    } catch (error) {
      console.error("Failed to load appointments", error);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const statusConfig = {
    booked: {
      label: language === 'ar' ? 'محجوز' : 'Booked',
      className: 'bg-info/10 text-info border-info/20'
    },
    confirmed: {
      label: language === 'ar' ? 'مؤكد' : 'Confirmed',
      className: 'bg-primary/10 text-primary border-primary/20'
    },
    attended: {
      label: language === 'ar' ? 'حضر' : 'Attended',
      className: 'bg-success/10 text-success border-success/20'
    },
    cancelled: {
      label: language === 'ar' ? 'ملغي' : 'Cancelled',
      className: 'bg-destructive/10 text-destructive border-destructive/20'
    },
  };

  const handleStatusChange = async (appointmentId: string, newStatus: string) => {
    if (newStatus === 'attended') {
      const appointment = appointments.find(a => a.id === appointmentId);
      if (appointment) {
        setSelectedAppointment(appointment);
        setAttendedDialogOpen(true);
      }
      return;
    }

    const updated = await updateAppointment(appointmentId, { status: newStatus as Appointment['status'] });
    if (updated) {
      loadAppointments();
      toast({
        title: language === 'ar' ? 'تم التحديث' : 'Status Updated',
        description: language === 'ar' ? 'تم تحديث حالة الموعد' : 'Appointment status has been updated',
      });
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    const updated = await updateAppointment(appointmentId, { status: 'cancelled' });
    if (updated) {
      loadAppointments();
      toast({
        title: language === 'ar' ? 'تم الإلغاء' : 'Cancelled',
        description: language === 'ar' ? 'تم إلغاء الموعد' : 'Appointment has been cancelled',
      });
    }
  };

  const handleDeleteClick = (appointment: Appointment) => {
    setAppointmentToDelete(appointment);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (appointmentToDelete) {
      const deleted = await deleteAppointment(appointmentToDelete.id);
      if (deleted) {
        loadAppointments();
        toast({
          title: language === 'ar' ? 'تم الحذف' : 'Deleted',
          description: language === 'ar' ? 'تم حذف الموعد بنجاح' : 'Appointment has been deleted',
        });
      }
    }
    setDeleteDialogOpen(false);
    setAppointmentToDelete(null);
  };

  const todayDate = new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
    calendar: 'gregory',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter(a => a.date === today);
  const upcomingAppointments = appointments.filter(a => a.date > today);
  const pastAppointments = appointments.filter(a => a.date < today);

  // Format phone number for WhatsApp (remove spaces, dashes, handle leading 0)
  const formatPhoneForWhatsApp = (phone: string): string => {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // If starts with 0, replace with Egypt country code (+20)
    if (cleaned.startsWith('0')) {
      cleaned = '+20' + cleaned.substring(1);
    }

    // Ensure it starts with +
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  };

  // Get patient phone from cache
  const getPatientPhone = (patientId: string): string | null => {
    const patient = patientsCache.get(patientId);
    return patient?.phone || null;
  };

  // Handle WhatsApp confirmation
  const handleWhatsAppConfirmation = (appointment: Appointment) => {
    const patient = patientsCache.get(appointment.patientId);
    if (!patient?.phone) return;

    const phone = formatPhoneForWhatsApp(patient.phone);
    const patientName = patient.name || appointment.patientName;

    // Format date in Arabic-friendly format
    const formattedDate = new Date(appointment.date).toLocaleDateString(
      language === 'ar' ? 'ar-EG' : 'en-US',
      { calendar: 'gregory', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    );

    // Construct message
    const message = language === 'ar'
      ? `مرحباً ${patientName}، نود تذكيركم بموعدكم في العيادة يوم ${formattedDate} الساعة ${appointment.time}. يرجى تأكيد الحضور.`
      : `Hello ${patientName}, this is a reminder about your appointment on ${formattedDate} at ${appointment.time}. Please confirm your attendance.`;

    // Encode and open WhatsApp
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phone.replace('+', '')}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
  };

  const renderAppointmentCard = (appointment: Appointment, index: number) => (
    <div
      key={appointment.id}
      className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors animate-fade-in opacity-0"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Time - Start side (right in RTL, left in LTR) */}
      <div className="flex items-center gap-2 min-w-[80px]">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono font-medium">{appointment.time}</span>
      </div>

      {/* Patient Info - Center */}
      <div className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 text-start">
          <p className="font-medium">
            {getAppointmentPatientName(appointment, patientsCache, language)}
          </p>
          <p className="text-sm text-muted-foreground">
            {language === 'ar' ? appointment.serviceAr : appointment.service}
          </p>
        </div>
      </div>

      {/* Status Badge */}
      <Badge
        variant="outline"
        className={cn(statusConfig[appointment.status].className, "shrink-0")}
      >
        {statusConfig[appointment.status].label}
      </Badge>

      {/* Actions - End side (left in RTL, right in LTR) */}
      <div className="flex items-center gap-2 shrink-0">
        {appointment.status !== 'cancelled' && appointment.status !== 'attended' && (
          <>
            <Select
              value={appointment.status}
              onValueChange={(value) => handleStatusChange(appointment.id, value)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="booked">
                  {language === 'ar' ? 'محجوز' : 'Booked'}
                </SelectItem>
                <SelectItem value="confirmed">
                  {language === 'ar' ? 'مؤكد' : 'Confirmed'}
                </SelectItem>
                <SelectItem value="attended">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    {language === 'ar' ? 'حضر' : 'Attended'}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => handleCancelAppointment(appointment.id)}
              className="text-destructive hover:bg-destructive/10"
            >
              <XCircle className="w-4 h-4" />
            </Button>
          </>
        )}

        {/* WhatsApp Confirmation Button - only show if patient has phone */}
        {getPatientPhone(appointment.patientId) && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleWhatsAppConfirmation(appointment)}
                  className="text-green-600 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950"
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{language === 'ar' ? 'تأكيد الموعد عبر واتساب' : 'Confirm via WhatsApp'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Delete Button - available for all appointments */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleDeleteClick(appointment)}
          className="text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('appointments')}</h1>
          <p className="text-muted-foreground">{todayDate}</p>
        </div>
        <Button variant="gradient" onClick={() => setBookDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t('newAppointment')}
        </Button>
      </div>

      {/* Today's Appointments */}
      <Card variant="elevated" className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {t('todayAppointments')} ({todayAppointments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {todayAppointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{language === 'ar' ? 'لا توجد مواعيد اليوم' : 'No appointments today'}</p>
            </div>
          ) : (
            todayAppointments.map((appointment, index) => renderAppointmentCard(appointment, index))
          )}
        </CardContent>
      </Card>

      {/* Upcoming Appointments */}
      {upcomingAppointments.length > 0 && (
        <Card variant="elevated" className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-info" />
              {language === 'ar' ? 'المواعيد القادمة' : 'Upcoming Appointments'} ({upcomingAppointments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingAppointments.map((appointment, index) => (
              <div key={appointment.id}>
                <p className="text-xs text-muted-foreground mb-2 text-start">
                  {formatDate(appointment.date, language)}
                </p>
                {renderAppointmentCard(appointment, index)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Past Appointments */}
      {pastAppointments.length > 0 && (
        <Card variant="ghost" className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-5 h-5" />
              {language === 'ar' ? 'المواعيد السابقة' : 'Past Appointments'} ({pastAppointments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 opacity-70">
            {pastAppointments.slice(0, 5).map((appointment, index) => (
              <div key={appointment.id}>
                <p className="text-xs text-muted-foreground mb-2 text-start">
                  {formatDate(appointment.date, language)}
                </p>
                {renderAppointmentCard(appointment, index)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Book Appointment Dialog */}
      <BookAppointmentDialog
        open={bookDialogOpen}
        onOpenChange={setBookDialogOpen}
        onSuccess={loadAppointments}
      />

      {/* Mark Attended Dialog */}
      <MarkAttendedDialog
        open={attendedDialogOpen}
        onOpenChange={setAttendedDialogOpen}
        appointment={selectedAppointment}
        onSuccess={loadAppointments}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {language === 'ar'
                  ? 'هل أنت متأكد من حذف هذا الموعد؟ لا يمكن التراجع عن هذا الإجراء.'
                  : 'Are you sure you want to delete this appointment? This action cannot be undone.'}
              </span>
              {appointmentToDelete?.status === 'attended' && (
                <span className="block text-warning font-medium">
                  {language === 'ar'
                    ? 'تنبيه: هذا الموعد تم حضوره. لا تنسَ حذف الفاتورة المرتبطة به من صفحة الحسابات.'
                    : 'Warning: This appointment was attended. Do not forget to delete the associated invoice from the Accounts page.'}
                </span>
              )}
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

export default AppointmentsPage;