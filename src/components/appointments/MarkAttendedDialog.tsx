import React, { useState, useEffect } from 'react';
import { CheckCircle, DollarSign, Briefcase, Plus, BadgeCheck, Stethoscope } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
// import { useSettings } from '@/contexts/SettingsContext'; // Removing reliance on SettingsContext due to user report
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Appointment,
  TreatmentCase,
  getActiveTreatmentCasesByPatient,
  markAppointmentAttended,
} from '@/services/appointmentService';
import { toast } from '@/hooks/use-toast';
import { db } from '@/services/db';

interface MarkAttendedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  onSuccess: () => void;
}

// Local interfaces used in fetching
interface Service {
  id: string;
  name: string;
  default_price: number;
  // Map backend's underscore to standard if needed, or stick to snake_case if used in component
  // Typically services table has default_price.
  // SettingsContext might have mapped it to defaultPrice.
  // I will assume backend returns default_price and map it or use it directly.
  defaultPrice?: number; // Mapped
}

interface Doctor {
  id: string;
  name: string;
}

export const MarkAttendedDialog: React.FC<MarkAttendedDialogProps> = ({
  open,
  onOpenChange,
  appointment,
  onSuccess,
}) => {
  const { language, isRTL } = useLanguage();
  // const { services, getCurrencySymbol, activeDoctors, getDoctorById } = useSettings(); // Removed
  const { user } = useAuth();
  const [activeCases, setActiveCases] = useState<TreatmentCase[]>([]);

  // Local State replacement for SettingsContext
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    if (open) {
      // Fetch Doctors
      // @ts-ignore
      if (window.electron && window.electron.ipcRenderer) {
        // @ts-ignore
        window.electron.ipcRenderer.invoke('doctors:getAll')
          .then((data: any) => {
            if (Array.isArray(data)) {
              setDoctors(data);
            }
          })
          .catch((err: any) => console.error("Failed to load doctors", err));

        // @ts-ignore
        window.electron.ipcRenderer.invoke('services:getAll')
          .then((data: any) => {
            if (Array.isArray(data)) {
              // Map if necessary, assuming raw DB rows
              setServices(data.map((s: any) => ({
                ...s,
                defaultPrice: s.default_price // Map snake to camel
              })));
            }
          })
          .catch((err: any) => console.error("Failed to load services", err));
      }
    }
  }, [open]);

  const getCurrencySymbol = (lang: string) => lang === 'ar' ? 'ج.م' : 'EGP';
  const currencySymbol = getCurrencySymbol(language as 'en' | 'ar');

  const [formData, setFormData] = useState({
    treatmentCaseId: 'new',
    serviceName: '',
    cost: 0,
    amountPaidToday: 0,
    doctorId: '',
    newCaseName: '',
  });

  // Selected treatment case data for display
  const [selectedCaseData, setSelectedCaseData] = useState<{
    totalCost: number;
    totalPaid: number;
    balance: number;
  } | null>(null);

  useEffect(() => {
    if (appointment) {
      getActiveTreatmentCasesByPatient(appointment.patientId, user?.email).then(cases => {
        setActiveCases(cases);

        // Pre-fill service from appointment - look up in settings by ID (preferred) or Name (legacy)
        const serviceById = services.find(s => s.id === appointment.service);
        const serviceByName = services.find(s => s.name === appointment.service);
        const service = serviceById || serviceByName;

        // Auto-select first active doctor
        const defaultDoctorId = doctors.length > 0 ? doctors[0].id : '';
        const appointmentDoctorId = appointment.doctorId || defaultDoctorId;

        setFormData({
          treatmentCaseId: 'new',
          serviceName: service ? service.name : (appointment.serviceName || ''),
          cost: service?.defaultPrice || 0,
          amountPaidToday: 0,
          doctorId: appointmentDoctorId,
          newCaseName: service ? service.name : (appointment.serviceName || ''),
        });
        setSelectedCaseData(null);
      });
    }
  }, [appointment, services, doctors]); // Added doctors dependency

  // Handle treatment case selection - auto-load data and sync service
  const handleTreatmentCaseChange = (value: string) => {
    if (value === 'new') {
      setSelectedCaseData(null);
      // Reset to appointment's original service - look up in settings
      const serviceById = services.find(s => s.id === appointment?.service);
      const serviceByName = services.find(s => s.name === appointment?.service);
      const service = serviceById || serviceByName;

      setFormData(prev => ({
        ...prev,
        treatmentCaseId: value,
        serviceName: service ? service.name : (appointment?.serviceName || ''),
        cost: service?.defaultPrice || 0,
        amountPaidToday: 0,
      }));
    } else {
      const selectedCase = activeCases.find(tc => tc.id === value);
      if (selectedCase) {
        setSelectedCaseData({
          totalCost: selectedCase.totalCost,
          totalPaid: selectedCase.totalPaid,
          balance: selectedCase.balance,
        });
        // Auto-sync service name from treatment case (locked)
        setFormData(prev => ({
          ...prev,
          treatmentCaseId: value,
          serviceName: selectedCase.name,
          cost: 0, // No new cost for existing cases - only payments
          amountPaidToday: 0,
        }));
      }
    }
  };

  const handleServiceChange = (serviceName: string) => {
    // Only allow service change for new treatment cases
    if (formData.treatmentCaseId !== 'new') return;

    // We store service NAME in formData currently, maybe we should switch to ID later,
    // but the backend expects name string for legacy reasons or we pass ID as name?
    // Wait, createAppointment stores ID.
    // Here we are creating an Invoice or updating Treatment Case.
    // The markAttended API expects 'serviceName' (string).
    // So we need to look up the service object by name if user selects from dropdown.

    // UI dropdown value is service NAME (based on existing code).
    const service = services.find(s => s.name === serviceName);
    setFormData(prev => ({
      ...prev,
      serviceName,
      cost: service?.defaultPrice || prev.cost,
      newCaseName: serviceName,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('MarkAttendedDialog: Submit button clicked');

    if (!appointment) {
      console.error('MarkAttendedDialog: No appointment selected');
      return;
    }

    // Validate doctor selection
    if (!formData.doctorId) {
      console.warn('MarkAttendedDialog: Missing doctorId');
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'يرجى اختيار الطبيب المعالج' : 'Please select a treating doctor',
        variant: 'destructive',
      });
      return;
    }

    const isExistingCase = formData.treatmentCaseId !== 'new';

    // Smart validation: different rules for existing vs new cases
    if (isExistingCase) {
      // For existing cases: only need a valid treatment case selected (service comes from case)
      if (!selectedCaseData) {
        console.warn('MarkAttendedDialog: Missing selectedCaseData for existing case');
        toast({
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: language === 'ar' ? 'يرجى اختيار خطة علاج صحيحة' : 'Please select a valid treatment case',
          variant: 'destructive',
        });
        return;
      }
    } else {
      // For new cases: require service name and cost
      if (!formData.serviceName || formData.cost < 0) { // allow 0 cost? Maybe free checkup
        // Just check serviceName presence
      }
      if (!formData.serviceName) {
        toast({
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: language === 'ar' ? 'يرجى اختيار الخدمة' : 'Please select a service',
          variant: 'destructive',
        });
        return;
      }
    }

    console.log('MarkAttendedDialog: Submitting payload:', {
      appointmentId: appointment.id,
      treatmentCaseId: formData.treatmentCaseId,
      serviceName: formData.serviceName,
      cost: formData.cost,
      amountPaid: formData.amountPaidToday,
      doctorId: formData.doctorId,
      newCaseName: formData.newCaseName
    });

    try {
      const result = await markAppointmentAttended(
        appointment.id,
        formData.treatmentCaseId,
        formData.serviceName,
        formData.serviceName, // Using same name for both (no more Arabic/English split)
        formData.cost,
        formData.amountPaidToday,
        formData.doctorId,
        formData.newCaseName,
        formData.newCaseName, // newCaseNameAr
        user?.email
      );

      console.log('MarkAttendedDialog: Result:', result);

      if (result && result.success) {
        toast({
          title: language === 'ar' ? 'تم التسجيل' : 'Attendance Recorded',
          description: language === 'ar'
            ? 'تم تسجيل الحضور وإنشاء الفاتورة بنجاح'
            : 'Attendance recorded and invoice created successfully',
        });
        onSuccess();
        onOpenChange(false);
      } else {
        console.error('MarkAttendedDialog: Result failed:', result);
        toast({
          title: language === 'ar' ? 'فشل التسجيل' : 'Registration Failed',
          description: (language === 'ar' ? 'حدث خطأ أثناء تسجيل الحضور: ' : 'An error occurred: ') + (result?.error || 'Unknown error'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('MarkAttendedDialog: Exception during submit:', error);
      toast({
        title: language === 'ar' ? 'فشل التسجيل' : 'Registration Failed',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <CheckCircle className="w-5 h-5 text-success" />
            {language === 'ar' ? 'تسجيل حضور وإنشاء فاتورة' : 'Mark Attended & Create Invoice'}
          </DialogTitle>
          <DialogDescription>
            {language === 'ar'
              ? 'سجل حضور المريض وأنشئ فاتورة للجلسة'
              : 'Record patient attendance and create an invoice for this session'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient Info */}
          <div className="p-3 rounded-lg bg-secondary/30">
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? 'المريض' : 'Patient'}
            </p>
            <p className="font-medium">
              {language === 'ar' ? appointment.patientNameAr : appointment.patientName}
            </p>
          </div>

          {/* Using Plan Badge - Show when existing case selected */}
          {formData.treatmentCaseId !== 'new' && selectedCaseData && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
              <BadgeCheck className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                {language === 'ar' ? 'يستخدم خطة:' : 'Using plan:'} {formData.serviceName}
              </span>
            </div>
          )}

          {/* Doctor Selection - Required */}
          <div className="space-y-2">
            <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <Stethoscope className="w-4 h-4" />
              {language === 'ar' ? 'الطبيب المعالج' : 'Treating Doctor'} *
            </Label>
            <Select
              value={formData.doctorId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, doctorId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={language === 'ar' ? 'اختر الطبيب' : 'Select doctor'} />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {doctors.length === 0 ? (
                  <SelectItem value="none" disabled>
                    {language === 'ar' ? 'لا يوجد أطباء' : 'No doctors found'}
                  </SelectItem>
                ) : (
                  doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Treatment Case Selection */}
          <div className="space-y-2">
            <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <Briefcase className="w-4 h-4" />
              {language === 'ar' ? 'خطة العلاج' : 'Treatment Case'}
            </Label>
            <Select
              value={formData.treatmentCaseId}
              onValueChange={handleTreatmentCaseChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="new">
                  <span className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                    <Plus className="w-4 h-4" />
                    {language === 'ar' ? 'إنشاء خطة علاج جديدة' : 'Create New Treatment Case'}
                  </span>
                </SelectItem>
                {activeCases.map((tc) => (
                  <SelectItem key={tc.id} value={tc.id}>
                    {tc.name} -
                    {language === 'ar' ? ` الرصيد: ${tc.balance} ${currencySymbol}` : ` Balance: ${tc.balance} ${currencySymbol}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* New Case Name (only if creating new) */}
          {formData.treatmentCaseId === 'new' && (
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'اسم الخطة' : 'Case Name'}</Label>
              <Input
                value={formData.newCaseName}
                onChange={(e) => setFormData(prev => ({ ...prev, newCaseName: e.target.value }))}
                placeholder={language === 'ar' ? 'اكتب اسم خطة العلاج' : 'Treatment case name'}
              />
            </div>
          )}

          {/* Service Selection - Only editable for new cases */}
          <div className="space-y-2">
            <Label>{language === 'ar' ? 'الخدمة' : 'Service'}</Label>
            {formData.treatmentCaseId !== 'new' ? (
              <Input
                value={formData.serviceName}
                readOnly
                disabled
                className="bg-muted cursor-not-allowed"
              />
            ) : (
              <Select
                value={formData.serviceName}
                onValueChange={handleServiceChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر الخدمة' : 'Select service'} />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.name}>
                      {service.name} - {service.defaultPrice} {currencySymbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Existing Treatment Case Data Display */}
          {selectedCaseData && formData.treatmentCaseId !== 'new' && (
            <div className="p-3 rounded-lg bg-secondary/50 border border-border space-y-2">
              <p className="text-sm font-medium text-foreground">
                {language === 'ar' ? 'بيانات خطة العلاج الحالية' : 'Current Treatment Case Data'}
              </p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">{language === 'ar' ? 'إجمالي التكلفة' : 'Total Cost'}</p>
                  <p className="font-semibold">{selectedCaseData.totalCost} {currencySymbol}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{language === 'ar' ? 'المدفوع' : 'Paid'}</p>
                  <p className="font-semibold text-success">{selectedCaseData.totalPaid} {currencySymbol}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{language === 'ar' ? 'المتبقي' : 'Balance'}</p>
                  <p className="font-semibold text-warning">{selectedCaseData.balance} {currencySymbol}</p>
                </div>
              </div>
            </div>
          )}

          {/* Cost and Payment */}
          <div className={cn("grid gap-4", formData.treatmentCaseId === 'new' ? "grid-cols-2" : "grid-cols-1")}>
            {/* Service Cost - Only for new treatment cases */}
            {formData.treatmentCaseId === 'new' && (
              <div className="space-y-2">
                <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                  <DollarSign className="w-4 h-4" />
                  {language === 'ar' ? 'تكلفة الخدمة' : 'Service Cost'}
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.cost}
                  onChange={(e) => setFormData(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                <DollarSign className="w-4 h-4" />
                {language === 'ar' ? 'المدفوع اليوم' : 'Amount Paid Today'}
              </Label>
              <Input
                type="number"
                min="0"
                max={selectedCaseData ? selectedCaseData.balance : undefined}
                value={formData.amountPaidToday}
                onChange={(e) => setFormData(prev => ({ ...prev, amountPaidToday: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          {/* Balance Display - Updated Preview */}
          <div className={cn(
            "p-3 rounded-lg border space-y-2",
            selectedCaseData && (selectedCaseData.balance - formData.amountPaidToday) === 0
              ? "bg-success/10 border-success/20"
              : "bg-warning/10 border-warning/20"
          )}>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? 'معاينة بعد هذه الجلسة' : 'Preview After This Session'}
            </p>
            {selectedCaseData && formData.treatmentCaseId !== 'new' ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'إجمالي التكلفة' : 'Total Cost'}</p>
                    <p className="font-bold">{selectedCaseData.totalCost} {currencySymbol}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'مدفوع جديد' : 'New Paid'}</p>
                    <p className="font-bold text-success">{selectedCaseData.totalPaid + formData.amountPaidToday} {currencySymbol}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'متبقي جديد' : 'New Balance'}</p>
                    <p className={cn("font-bold", (selectedCaseData.balance - formData.amountPaidToday) === 0 ? "text-success" : "text-warning")}>
                      {selectedCaseData.balance - formData.amountPaidToday} {currencySymbol}
                    </p>
                  </div>
                </div>
                {(selectedCaseData.balance - formData.amountPaidToday) === 0 && (
                  <p className="text-xs text-success font-medium">
                    {language === 'ar' ? '✓ سيتم إغلاق خطة العلاج تلقائياً' : '✓ Treatment case will be automatically closed'}
                  </p>
                )}
              </>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'ar' ? 'تكلفة الخدمة' : 'Service Cost'}</p>
                  <p className="font-bold">{formData.cost} {currencySymbol}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'ar' ? 'المدفوع' : 'Paid'}</p>
                  <p className="font-bold text-success">{formData.amountPaidToday} {currencySymbol}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'ar' ? 'المتبقي' : 'Remaining'}</p>
                  <p className={cn("font-bold", (formData.cost - formData.amountPaidToday) === 0 ? "text-success" : "text-warning")}>
                    {formData.cost - formData.amountPaidToday} {currencySymbol}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="submit" className="gap-2">
              <CheckCircle className="w-4 h-4" />
              {language === 'ar' ? 'تسجيل الحضور' : 'Mark Attended'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MarkAttendedDialog;
