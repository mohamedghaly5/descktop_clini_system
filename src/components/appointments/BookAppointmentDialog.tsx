import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, FileText, Stethoscope } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { createAppointment } from '@/services/appointmentService';
import { getActivePatients, Patient } from '@/services/patientService';
import { db } from '@/services/db';
import { toast } from '@/hooks/use-toast';

// Helper to get patient name
const getPatientName = (patient: Patient) => {
  return patient.name || 'Unknown';
};

interface BookAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Service {
  id: string;
  name: string;
  name_ar?: string; // Optional depending on DB schema
  price: number;
}

interface Doctor {
  id: string;
  name: string;
}

export const BookAppointmentDialog: React.FC<BookAppointmentDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { language, isRTL } = useLanguage();
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  useEffect(() => {
    if (open) {
      getActivePatients(user?.email).then(setPatients);

      db.services.getAll(user?.email).then((data: any) => {
        setAvailableServices(Array.isArray(data) ? data : []);
      }).catch(err => console.error("Failed to load services", err));

      db.doctors.getAll(user?.email).then((data: any) => {
        setDoctors(Array.isArray(data) ? data : []);
      }).catch(err => console.error("Failed to load doctors", err));
    }
  }, [open]);

  const [openPatientSelect, setOpenPatientSelect] = useState(false);

  const [formData, setFormData] = useState({
    patientId: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    service: '', // This will now store the Service ID
    doctorId: '', // Doctor ID
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.patientId) {
      toast({
        title: "Error",
        description: "Please select a patient",
        variant: "destructive"
      });
      return;
    }

    if (!formData.date || !formData.time || !formData.service) {
      toast({
        title: "Error",
        description: "Please fill all required fields",
        variant: "destructive"
      });
      return;
    }

    // Doctor is NOT strictly required by generic logic but schema has it as optional, 
    // but User Request says "dropdown must not allow submission if doctor is not selected".
    if (!formData.doctorId) {
      toast({
        title: "Error",
        description: language === 'ar' ? 'يرجى اختيار الطبيب المعالج' : 'Please select a treating doctor',
        variant: "destructive"
      });
      return;
    }

    const patient = patients.find(p => p.id === formData.patientId);
    if (!patient) return;

    const selectedService = availableServices.find(s => s.id === formData.service);
    if (!selectedService) {
      console.error("Selected service not found in available list");
      return;
    }

    const patientName = getPatientName(patient);

    try {
      await createAppointment({
        patientId: formData.patientId,
        patientName: patientName,
        patientNameAr: patientName, // Use same fullName for both
        date: formData.date,
        time: formData.time,
        service: selectedService.id, // Store ID
        serviceAr: selectedService.name_ar || selectedService.name,
        doctorId: formData.doctorId, // Store Doctor ID
        status: 'booked',
        notes: formData.notes,
      }, user?.email);

      toast({
        title: language === 'ar' ? 'تم الحجز' : 'Appointment Booked',
        description: language === 'ar' ? 'تم حجز الموعد بنجاح' : 'Appointment has been booked successfully',
      });

      // Reset form
      setFormData({
        patientId: '',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        service: '',
        doctorId: '',
        notes: '',
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Booking error:", error);

      let title = "Booking Failed";
      let description = error.message || "Unknown error occurred";

      // Handle User-Facing License Errors
      if (description.includes('LICENSE_EXPIRED')) {
        title = language === 'ar' ? 'فشل الحفظ' : 'Booking Failed';
        description = language === 'ar' ? 'يرجى تفعيل الرخصة' : 'Please activate the license';
      }

      toast({
        title: title,
        description: description,
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <Calendar className="w-5 h-5 text-primary" />
            {language === 'ar' ? 'حجز موعد جديد' : 'Book New Appointment'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient Selection (Searchable) */}
          <div className="space-y-2">
            <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <User className="w-4 h-4" />
              {language === 'ar' ? 'المريض' : 'Patient'}
            </Label>

            <Popover open={openPatientSelect} onOpenChange={setOpenPatientSelect}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openPatientSelect}
                  className={cn(
                    "w-full justify-between",
                    !formData.patientId && "text-muted-foreground",
                    isRTL && "flex-row-reverse"
                  )}
                >
                  {formData.patientId
                    ? patients.find((patient) => patient.id === formData.patientId)?.name
                    : (language === 'ar' ? 'ابحث عن مريض...' : 'Search patient...')}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[450px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder={language === 'ar' ? 'بحث بالاسم أو الهاتف...' : 'Search by name or phone...'}
                    className={cn(isRTL && "text-right")}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {language === 'ar' ? 'لا يوجد مريض بهذا الاسم' : 'No patient found.'}
                    </CommandEmpty>
                    <CommandGroup>
                      {patients.map((patient) => (
                        <CommandItem
                          key={patient.id}
                          value={`${patient.name} ${patient.phone}`}
                          onSelect={() => {
                            setFormData(prev => ({ ...prev, patientId: patient.id }));
                            setOpenPatientSelect(false);
                          }}
                          className={cn(
                            "flex items-center gap-2 cursor-pointer aria-selected:bg-orange-100",
                            isRTL && "flex-row-reverse"
                          )}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.patientId === patient.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{patient.name}</span>
                            <span className="text-xs text-gray-700">{patient.phone}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                <Calendar className="w-4 h-4" />
                {language === 'ar' ? 'التاريخ' : 'Date'}
              </Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                <Clock className="w-4 h-4" />
                {language === 'ar' ? 'الوقت' : 'Time'}
              </Label>
              <Input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
              />
            </div>
          </div>

          {/* Service */}
          <div className="space-y-2">
            <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>{language === 'ar' ? 'الخدمة' : 'Service'}</Label>
            <Select
              value={formData.service}
              onValueChange={(value) => setFormData(prev => ({ ...prev, service: value }))}
            >
              <SelectTrigger className={cn(isRTL && "flex-row-reverse")}>
                <SelectValue placeholder={language === 'ar' ? 'اختر الخدمة' : 'Select service'} />
              </SelectTrigger>
              <SelectContent>
                {availableServices.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    {language === 'ar' ? 'لا يوجد خدمات' : 'No services found'}
                  </div>
                ) : (
                  availableServices.map((service) => (
                    <SelectItem key={service.id} value={service.id} className={cn(isRTL && "flex-row-reverse")}>
                      {language === 'ar' && service.name_ar ? service.name_ar : service.name} - {service.price} {language === 'ar' ? 'ج.م' : 'EGP'}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Doctor */}
          <div className="space-y-2">
            <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <Stethoscope className="w-4 h-4" />
              {language === 'ar' ? 'الطبيب' : 'Doctor'}
            </Label>
            <Select
              value={formData.doctorId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, doctorId: value }))}
            >
              <SelectTrigger className={cn(isRTL && "flex-row-reverse")}>
                <SelectValue placeholder={language === 'ar' ? 'اختر الطبيب' : 'Select doctor'} />
              </SelectTrigger>
              <SelectContent>
                {doctors.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    {language === 'ar' ? 'لا يوجد أطباء' : 'No doctors found'}
                  </div>
                ) : (
                  doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id} className={cn(isRTL && "flex-row-reverse")}>
                      {doctor.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <FileText className="w-4 h-4" />
              {language === 'ar' ? 'ملاحظات' : 'Notes'}
            </Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder={language === 'ar' ? 'ملاحظات إضافية...' : 'Additional notes...'}
              rows={3}
              className={cn(isRTL && "text-right")}
            />
          </div>

          <DialogFooter className={cn(isRTL && "flex-row-reverse gap-2 sm:gap-0")}>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="submit" variant="gradient">
              {language === 'ar' ? 'حجز الموعد' : 'Book Appointment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BookAppointmentDialog;
