import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Phone, MapPin, FileText, CreditCard, Stethoscope } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
// import { toast } from 'sonner';

// Local interfaces
interface Service { id: string; name: string; default_price: number; }
interface City { id: string; name: string; }
interface Doctor { id: string; name: string; }

const patientSchema = z.object({
  name: z.string().min(2, 'الاسم مطلوب'),
  phone: z.string().min(8, 'رقم الهاتف مطلوب'),
  gender: z.enum(['male', 'female']).optional(),
  birthDate: z.string().optional(),
  cityId: z.string().min(1, 'المدينة مطلوبة'),
  notes: z.string().optional(),
  medicalHistory: z.string().optional(),
  // Visit details
  serviceType: z.string().min(1, 'الخدمة مطلوبة'),
  amountPaid: z.string().min(1, 'المبلغ مطلوب'),
  paymentMethod: z.enum(['cash', 'card', 'insurance']),
  visitNotes: z.string().optional(),
  doctorId: z.string().min(1, 'الطبيب مطلوب'),
});

type PatientFormData = z.infer<typeof patientSchema>;

interface PatientFormProps {
  onSubmit?: (data: PatientFormData) => void;
  onCancel?: () => void;
}

const PatientForm: React.FC<PatientFormProps> = ({ onSubmit, onCancel }) => {
  const { language } = useLanguage();

  const [services, setServices] = useState<Service[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // @ts-ignore
        if (window.electron && window.electron.ipcRenderer) {
          // @ts-ignore
          const s = await window.electron.ipcRenderer.invoke('services:getAll');
          if (Array.isArray(s)) setServices(s);

          // @ts-ignore
          const c = await window.electron.ipcRenderer.invoke('cities:getAll');
          if (Array.isArray(c)) setCities(c);

          // @ts-ignore
          const d = await window.electron.ipcRenderer.invoke('doctors:getAll'); // Using doctors:getAll or staff:get-all
          if (Array.isArray(d)) setDoctors(d);
        }
      } catch (e) { console.error(e); }
    };
    fetchData();
  }, []);

  const getCurrencySymbol = (lang: string) => lang === 'ar' ? 'ج.م' : 'EGP';

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      gender: 'male',
      paymentMethod: 'cash',
    },
  });

  // Auto-fill price when service is selected
  const handleServiceChange = (serviceId: string) => {
    setValue('serviceType', serviceId);
    const service = services.find(s => s.id === serviceId);
    if (service) {
      setValue('amountPaid', (service.default_price || 0).toString());
    }
  };

  const handleFormSubmit = async (data: PatientFormData) => {
    // Pass data to parent. Parent handles saving.
    onSubmit?.(data);
  };

  /* Watch birthDate for age calculation */
  const watchedBirthDate = watch('birthDate');

  const InputWrapper = ({ children, label, error, icon: Icon, required }: {
    children: React.ReactNode;
    label: string;
    error?: string;
    icon?: React.ComponentType<{ className?: string }>;
    required?: boolean;
  }) => (
    <div className="space-y-2" dir="rtl">
      <Label className="text-sm font-medium flex items-center gap-2 flex-row-reverse justify-end">
        {required && <span className="text-destructive">*</span>}
        {label}
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive text-right">{error}</p>}
    </div>
  );

  const noCities = cities.length === 0;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" dir="rtl">
      {/* Patient Information */}
      <Card variant="elevated" className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-row-reverse justify-end">
            <User className="w-5 h-5 text-primary" />
            بيانات المريض
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Field 1: Patient Name */}
          <InputWrapper label="اسم المريض" error={errors.name?.message} icon={User} required>
            <Input
              {...register('name')}
              placeholder="أدخل اسم المريض"
              className="text-right"
              dir="rtl"
            />
          </InputWrapper>

          {/* Field 2: Phone Number */}
          <InputWrapper label="رقم الهاتف" error={errors.phone?.message} icon={Phone} required>
            <Input
              {...register('phone')}
              type="tel"
              inputMode="numeric"
              placeholder="أدخل رقم الهاتف"
              className="text-right"
              dir="rtl"
            />
          </InputWrapper>

          {/* Field 3: Gender */}
          <InputWrapper label="الجنس">
            <Select onValueChange={(value) => setValue('gender', value as 'male' | 'female')} defaultValue="male">
              <SelectTrigger className="text-right" dir="rtl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50" dir="rtl">
                <SelectItem value="male">ذكر</SelectItem>
                <SelectItem value="female">أنثى</SelectItem>
              </SelectContent>
            </Select>
          </InputWrapper>

          {/* Field 4: Birth Date */}
          <InputWrapper label={
            watchedBirthDate ?
              `تاريخ الميلاد (${Math.floor((new Date().getTime() - new Date(watchedBirthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} سنة)`
              : "تاريخ الميلاد"
          }>
            <Input
              {...register('birthDate')}
              type="date"
              className="text-right"
              dir="rtl"
            />
          </InputWrapper>

          {/* Field 5: City */}
          <InputWrapper label="المدينة" error={noCities ? 'يرجى إضافة مدن من الإعدادات أولاً' : errors.cityId?.message} icon={MapPin} required>
            <Select
              onValueChange={(value) => setValue('cityId', value)}
              disabled={noCities}
            >
              <SelectTrigger className={cn("text-right", noCities && "border-destructive")} dir="rtl">
                <SelectValue placeholder="اختر المدينة" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50" dir="rtl">
                {cities.map(city => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </InputWrapper>

          {/* Field 6: Notes */}
          <InputWrapper label="ملاحظات" icon={FileText}>
            <Textarea
              {...register('notes')}
              placeholder="ملاحظات إضافية..."
              className="min-h-[60px] text-right"
              dir="rtl"
            />
          </InputWrapper>

          {/* Field 7: Medical History */}
          <InputWrapper label="التاريخ الطبي" icon={FileText}>
            <Textarea
              {...register('medicalHistory')}
              placeholder="أمراض مزمنة، حساسيات، عمليات سابقة..."
              className="min-h-[60px] text-right"
              dir="rtl"
            />
          </InputWrapper>
        </CardContent>
      </Card>

      {/* Visit Details */}
      <Card variant="elevated" className="animate-fade-in delay-100" style={{ animationDelay: '100ms' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-row-reverse justify-end">
            <CreditCard className="w-5 h-5 text-accent" />
            تفاصيل الزيارة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Doctor - New Required Field */}
          <InputWrapper label="الطبيب المعالج" error={errors.doctorId?.message} icon={Stethoscope} required>
            <Select onValueChange={(value) => setValue('doctorId', value)}>
              <SelectTrigger className="text-right" dir="rtl">
                <SelectValue placeholder="اختر الطبيب" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50" dir="rtl">
                {doctors.length === 0 ? (
                  <SelectItem value="default" disabled>لا يوجد أطباء</SelectItem>
                ) : (
                  doctors.map(doctor => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </InputWrapper>

          <InputWrapper label="نوع الخدمة" error={errors.serviceType?.message} required>
            <Select onValueChange={handleServiceChange}>
              <SelectTrigger className="text-right" dir="rtl">
                <SelectValue placeholder="اختر الخدمة" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50" dir="rtl">
                {services.map(service => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} - {getCurrencySymbol(language)} {service.default_price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </InputWrapper>

          <InputWrapper label="المبلغ المدفوع" error={errors.amountPaid?.message} required>
            <div className="relative">
              <Input
                {...register('amountPaid')}
                type="number"
                placeholder="0"
                className="text-right pr-16"
                dir="rtl"
              />
              <span className="absolute top-1/2 -translate-y-1/2 right-3 text-sm text-muted-foreground">
                {getCurrencySymbol(language)}
              </span>
            </div>
          </InputWrapper>

          <InputWrapper label="طريقة الدفع" error={errors.paymentMethod?.message}>
            <Select onValueChange={(value) => setValue('paymentMethod', value as 'cash' | 'card' | 'insurance')} defaultValue="cash">
              <SelectTrigger className="text-right" dir="rtl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50" dir="rtl">
                <SelectItem value="cash">نقدي</SelectItem>
                <SelectItem value="card">بطاقة</SelectItem>
                <SelectItem value="insurance">تأمين</SelectItem>
              </SelectContent>
            </Select>
          </InputWrapper>

          <InputWrapper label="ملاحظات الزيارة">
            <Textarea
              {...register('visitNotes')}
              placeholder="ملاحظات الزيارة..."
              className="min-h-[80px] text-right"
              dir="rtl"
            />
          </InputWrapper>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 flex-row-reverse justify-end">
        <Button type="submit" variant="gradient" size="lg" disabled={isSubmitting || noCities}>
          {isSubmitting ? 'جاري الحفظ...' : 'حفظ'}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => reset()}>
          مسح
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
            إلغاء
          </Button>
        )}
      </div>
    </form>
  );
};

export default PatientForm;