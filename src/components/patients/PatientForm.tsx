import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Phone, MapPin, FileText, CreditCard } from 'lucide-react';
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
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const patientSchema = z.object({
  name: z.string().min(2, 'الاسم مطلوب'),
  phone: z.string().min(8, 'رقم الهاتف مطلوب'),
  gender: z.enum(['male', 'female']).optional(),
  age: z.string().optional(),
  cityId: z.string().min(1, 'المدينة مطلوبة'),
  notes: z.string().optional(),
  // Visit details
  serviceType: z.string().min(1, 'الخدمة مطلوبة'),
  amountPaid: z.string().min(1, 'المبلغ مطلوب'),
  paymentMethod: z.enum(['cash', 'card', 'insurance']),
  visitNotes: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

interface PatientFormProps {
  onSubmit?: (data: PatientFormData) => void;
  onCancel?: () => void;
}

const PatientForm: React.FC<PatientFormProps> = ({ onSubmit, onCancel }) => {
  const { t, isRTL, language } = useLanguage();
  const { services, cities, getCurrencySymbol, getServiceById } = useSettings();

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
    const service = getServiceById(serviceId);
    if (service) {
      setValue('amountPaid', service.defaultPrice.toString());
    }
  };

  const handleFormSubmit = async (data: PatientFormData) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('تم حفظ بيانات المريض بنجاح');
      reset();
      onSubmit?.(data);
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

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

          {/* Field 4: Age */}
          <InputWrapper label="العمر">
            <Input
              {...register('age')}
              type="number"
              inputMode="numeric"
              placeholder="أدخل العمر"
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
              className="min-h-[80px] text-right"
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
          <InputWrapper label="نوع الخدمة" error={errors.serviceType?.message} required>
            <Select onValueChange={handleServiceChange}>
              <SelectTrigger className="text-right" dir="rtl">
                <SelectValue placeholder="اختر الخدمة" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50" dir="rtl">
                {services.map(service => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} - {getCurrencySymbol(language)} {service.defaultPrice}
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

      {/* Actions - aligned to the left as per Arabic UX standards */}
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