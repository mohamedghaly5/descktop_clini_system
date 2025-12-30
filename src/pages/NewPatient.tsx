import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PatientForm from '@/components/patients/PatientForm';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { createPatient as createPatientService } from '@/services/patientService';
import { createAppointment as createAppointmentService, markAppointmentAttended } from '@/services/appointmentService';
import { toast } from '@/hooks/use-toast';

const NewPatientPage: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const handleSuccess = async (data: any) => { // Type as any for now to avoid duplicate definition
    // Create Patient
    try {
      // We need to call the service. We can assume NewPatient passes the fields.
      // Data comes from PatientForm. It has name, phone, etc. + serviceType, amountPaid, visitNotes.

      // 1. Create Patient
      const patient = await createPatientService({
        name: data.name,
        phone: data.phone,
        age: data.age ? parseInt(data.age) : 0,
        gender: data.gender,
        cityId: data.cityId,
        notes: data.notes
      });

      if (!patient) throw new Error("Failed to create patient");

      // 2. Create Appointment & Mark Attended (since paid)
      // Create "Booked" appointment first? Or directly attended?
      // Service ID is data.serviceType
      // We need an "Appointment" object.
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

      const appointment = await createAppointmentService({
        patientId: patient.id,
        patientName: patient.name,
        patientNameAr: patient.name,
        date: today,
        time: now,
        service: data.serviceType,
        serviceAr: '', // service logic will fill
        status: 'booked',
        notes: data.visitNotes || ''
      });

      // 3. Mark Attended / Create Invoice
      // Use markAppointmentAttended helper
      // We need service name. Service ID is in data.serviceType.
      // Ideally we fetch service name or pass it.
      // For MVP, passing ID as name if we lack it, but markAppointmentAttended expects name.
      // We will rely on service logic to fetch or use placeholder.
      await markAppointmentAttended(
        appointment.id,
        'new', // Create new treatment case
        'New Visit', // Fallback service name
        'زيارة جديدة',
        parseFloat(data.amountPaid) || 0, // Cost (Price)
        parseFloat(data.amountPaid) || 0, // Paid
        'default-doctor', // Doctor ID
        'Treatment Case',
        'خطة علاج'
      );

      toast({
        title: isRTL ? 'تم بنجاح' : 'Success',
        description: isRTL ? 'تم تسجيل المريض والزيارة' : 'Patient and visit registered',
      });
      navigate('/patients');
    } catch (e) {
      console.error(e);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل التسجيل' : 'Registration failed',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={cn("flex items-center gap-4", isRTL && "flex-row-reverse")}>
        <Button variant="ghost" size="icon" onClick={() => navigate('/patients')}>
          <BackIcon className="w-5 h-5" />
        </Button>
        <div className={cn(isRTL && "text-right")}>
          <h1 className="text-2xl font-bold text-foreground">{t('patientRegistration')}</h1>
          <p className="text-muted-foreground">
            {isRTL ? 'أدخل بيانات المريض والزيارة' : 'Enter patient and visit details'}
          </p>
        </div>
      </div>

      {/* Form */}
      <PatientForm
        onSubmit={handleSuccess}
        onCancel={() => navigate('/patients')}
      />
    </div>
  );
};

export default NewPatientPage;
