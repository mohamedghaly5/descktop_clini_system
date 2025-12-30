import React, { useState } from 'react';
import { Globe, Building2, DollarSign, MapPin, Briefcase, Plus, Trash2, Edit2, Stethoscope, UserCheck, UserX, Percent, Database } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings, CURRENCY_OPTIONS, Service, City, Doctor } from '@/contexts/SettingsContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import DataManagement from '@/components/DataManagement';

const SettingsPage: React.FC = () => {
  const { t, isRTL, language, setLanguage } = useLanguage();
  const {
    services, addService, updateService, deleteService,
    cities, addCity, updateCity, deleteCity,
    doctors, addDoctor, updateDoctor, toggleDoctorActive,
    currency, setCurrency,
    clinicInfo, updateClinicInfo
  } = useSettings();

  // Dialog states
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [cityDialogOpen, setCityDialogOpen] = useState(false);
  const [doctorDialogOpen, setDoctorDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);

  // Form states - simplified to single name fields
  const [serviceForm, setServiceForm] = useState({ name: '', defaultPrice: 0 });
  const [cityForm, setCityForm] = useState({ name: '' });
  const [doctorForm, setDoctorForm] = useState({
    name: '',
    role: 'doctor' as 'doctor' | 'assistant' | 'hygienist',
    commissionType: 'percentage' as 'percentage' | 'fixed' | undefined,
    commissionValue: 0
  });

  // Handlers for Services
  const handleAddService = () => {
    setEditingService(null);
    setServiceForm({ name: '', defaultPrice: 0 });
    setServiceDialogOpen(true);
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setServiceForm({ name: service.name, defaultPrice: service.defaultPrice });
    setServiceDialogOpen(true);
  };

  const handleSaveService = async () => {
    if (!serviceForm.name.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال اسم الخدمة' : 'Please enter service name');
      return;
    }
    let success = false;
    if (editingService) {
      success = await updateService(editingService.id, serviceForm);
      if (success) toast.success(language === 'ar' ? 'تم تحديث الخدمة' : 'Service updated');
    } else {
      success = await addService(serviceForm);
      if (success) toast.success(language === 'ar' ? 'تم إضافة الخدمة' : 'Service added');
    }
    if (success) setServiceDialogOpen(false);
    else toast.error(language === 'ar' ? 'فشل حفظ الخدمة' : 'Failed to save service');
  };

  const handleDeleteService = async (id: string) => {
    await deleteService(id);
    toast.success(language === 'ar' ? 'تم حذف الخدمة' : 'Service deleted');
  };

  // Handlers for Cities
  const handleAddCity = () => {
    setEditingCity(null);
    setCityForm({ name: '' });
    setCityDialogOpen(true);
  };

  const handleEditCity = (city: City) => {
    setEditingCity(city);
    setCityForm({ name: city.name });
    setCityDialogOpen(true);
  };

  const handleSaveCity = async () => {
    if (!cityForm.name.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال اسم المدينة' : 'Please enter city name');
      return;
    }
    let success = false;
    if (editingCity) {
      success = await updateCity(editingCity.id, cityForm);
      if (success) toast.success(language === 'ar' ? 'تم تحديث المدينة' : 'City updated');
    } else {
      success = await addCity(cityForm);
      if (success) toast.success(language === 'ar' ? 'تم إضافة المدينة' : 'City added');
    }
    if (success) setCityDialogOpen(false);
    else toast.error(language === 'ar' ? 'فشل حفظ المدينة' : 'Failed to save city');
  };

  const handleDeleteCity = async (id: string) => {
    await deleteCity(id);
    toast.success(language === 'ar' ? 'تم حذف المدينة' : 'City deleted');
  };

  // Handlers for Doctors
  const handleAddDoctor = () => {
    setEditingDoctor(null);
    setDoctorForm({ name: '', role: 'doctor', commissionType: 'percentage', commissionValue: 0 });
    setDoctorDialogOpen(true);
  };

  const handleEditDoctor = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setDoctorForm({
      name: doctor.name,
      role: doctor.role,
      commissionType: doctor.commissionType || 'percentage',
      commissionValue: doctor.commissionValue || 0
    });
    setDoctorDialogOpen(true);
  };

  const handleSaveDoctor = async () => {
    if (!doctorForm.name.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال اسم الطبيب' : 'Please enter doctor name');
      return;
    }
    let success = false;
    if (editingDoctor) {
      success = await updateDoctor(editingDoctor.id, doctorForm);
      if (success) toast.success(language === 'ar' ? 'تم تحديث الطبيب' : 'Doctor updated');
    } else {
      success = await addDoctor({ ...doctorForm, active: true });
      if (success) toast.success(language === 'ar' ? 'تم إضافة الطبيب' : 'Doctor added');
    }
    if (success) setDoctorDialogOpen(false);
    else toast.error(language === 'ar' ? 'فشل حفظ الطبيب' : 'Failed to save doctor');
  };

  const handleToggleDoctorActive = async (id: string, currentActive: boolean) => {
    await toggleDoctorActive(id);
    toast.success(language === 'ar'
      ? (currentActive ? 'تم إلغاء تفعيل الطبيب' : 'تم تفعيل الطبيب')
      : (currentActive ? 'Doctor deactivated' : 'Doctor activated')
    );
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'doctor': return language === 'ar' ? 'طبيب' : 'Doctor';
      case 'assistant': return language === 'ar' ? 'مساعد' : 'Assistant';
      case 'hygienist': return language === 'ar' ? 'أخصائي تنظيف' : 'Hygienist';
      default: return role;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-start">
        <h1 className="text-2xl font-bold text-foreground">{t('settings')}</h1>
        <p className="text-muted-foreground">
          {language === 'ar' ? 'إدارة إعدادات التطبيق' : 'Manage application settings'}
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex justify-end">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'عام' : 'General'}</span>
          </TabsTrigger>
          <TabsTrigger value="clinic" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'العيادة' : 'Clinic'}</span>
          </TabsTrigger>
          <TabsTrigger value="doctors" className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'الأطباء' : 'Doctors'}</span>
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'الخدمات' : 'Services'}</span>
          </TabsTrigger>


          <TabsTrigger value="lists" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'القوائم' : 'Lists'}</span>
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'البيانات والنسخ الاحتياطي' : 'Data & Backup'}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-6">
          <DataManagement />
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          {/* Language Selection */}
          <Card variant="primary" className="animate-fade-in" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                  <Globe className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="text-start">
                  <CardTitle>{language === 'ar' ? 'اللغة' : 'Language'}</CardTitle>
                  <CardDescription>
                    {language === 'ar' ? 'اختر لغة العرض المفضلة' : 'Choose your preferred display language'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button
                  variant={language === 'en' ? 'default' : 'outline'}
                  onClick={() => setLanguage('en')}
                  className="flex-1"
                >
                  <span className="me-2">🇺🇸</span>
                  English
                </Button>
                <Button
                  variant={language === 'ar' ? 'default' : 'outline'}
                  onClick={() => setLanguage('ar')}
                  className="flex-1"
                >
                  <span className="me-2">🇸🇦</span>
                  العربية
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Currency Selection */}
          <Card variant="elevated" className="animate-fade-in" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="text-start">
                  <CardTitle>{language === 'ar' ? 'العملة' : 'Currency'}</CardTitle>
                  <CardDescription>
                    {language === 'ar' ? 'اختر العملة المستخدمة في العيادة' : 'Select the currency used in the clinic'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Select value={currency} onValueChange={(value) => setCurrency(value as any)} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                <SelectTrigger className="w-full text-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {CURRENCY_OPTIONS.map(option => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.symbol} - {option.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>


        </TabsContent>

        {/* Clinic Tab */}
        <TabsContent value="clinic" className="space-y-6">
          <Card variant="elevated" className="animate-fade-in">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="text-start">
                  <CardTitle>{language === 'ar' ? 'معلومات العيادة' : 'Clinic Information'}</CardTitle>
                  <CardDescription>
                    {language === 'ar' ? 'تظهر هذه المعلومات في الفواتير والتقارير' : 'This information appears on invoices and reports'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'اسم العيادة' : 'Clinic Name'}</Label>
                  <Input
                    value={clinicInfo.name}
                    onChange={(e) => updateClinicInfo({ name: e.target.value })}
                    placeholder={language === 'ar' ? 'اسم العيادة' : 'Clinic Name'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'اسم صاحب العيادة / الطبيب' : 'Owner / Doctor Name'}</Label>
                  <Input
                    value={clinicInfo.ownerName || ''}
                    onChange={(e) => updateClinicInfo({ ownerName: e.target.value })}
                    placeholder={language === 'ar' ? 'د. أحمد' : 'Dr. Ahmed'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'العنوان' : 'Address'}</Label>
                  <Input
                    value={clinicInfo.address}
                    onChange={(e) => updateClinicInfo({ address: e.target.value })}
                    placeholder={language === 'ar' ? 'عنوان العيادة' : 'Clinic Address'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</Label>
                  <Input
                    value={clinicInfo.phone}
                    onChange={(e) => updateClinicInfo({ phone: e.target.value })}
                    placeholder="+20 123 456 7890"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'رقم الواتساب' : 'WhatsApp Number'}</Label>
                  <Input
                    value={clinicInfo.whatsappNumber || ''}
                    onChange={(e) => updateClinicInfo({ whatsappNumber: e.target.value })}
                    placeholder="+201234567890"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'يستخدم لإرسال التقارير عبر واتساب' : 'Used for sending reports via WhatsApp'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</Label>
                  <Input
                    value={clinicInfo.email}
                    onChange={(e) => updateClinicInfo({ email: e.target.value })}
                    placeholder="info@clinic.com"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'شعار العيادة (رابط الصورة)' : 'Clinic Logo (Image URL)'}</Label>
                <Input
                  value={clinicInfo.logo}
                  onChange={(e) => updateClinicInfo({ logo: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  dir="ltr"
                />
                {clinicInfo.logo && (
                  <div className="mt-2 p-4 border rounded-lg bg-secondary/30">
                    <img src={clinicInfo.logo} alt="Clinic Logo" className="max-h-20 object-contain" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Doctors Tab */}
        <TabsContent value="doctors" className="space-y-6">
          <Card variant="elevated" className="animate-fade-in">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                    <Stethoscope className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div className="text-start">
                    <CardTitle>{language === 'ar' ? 'الأطباء والطاقم الطبي' : 'Doctors & Staff'}</CardTitle>
                    <CardDescription>
                      {language === 'ar' ? 'إدارة أطباء العيادة والطاقم الطبي' : 'Manage clinic doctors and medical staff'}
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={handleAddDoctor} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  {language === 'ar' ? 'إضافة' : 'Add'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {doctors.map(doctor => (
                  <div
                    key={doctor.id}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg transition-colors",
                      doctor.active
                        ? "bg-secondary/30 hover:bg-secondary/50"
                        : "bg-muted/50 opacity-60"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                      doctor.active ? "bg-primary/10" : "bg-muted"
                    )}>
                      <Stethoscope className={cn(
                        "w-5 h-5",
                        doctor.active ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1 text-start">
                      <p className="font-medium">{doctor.name}</p>
                      <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                        <span>{getRoleLabel(doctor.role)}</span>
                        {doctor.commissionValue && doctor.commissionValue > 0 && (
                          <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">
                            {doctor.commissionType === 'percentage'
                              ? `${doctor.commissionValue}%`
                              : (language === 'ar' ? `${doctor.commissionValue} ثابت` : `${doctor.commissionValue} fixed`)
                            }
                          </span>
                        )}
                        {!doctor.active && (
                          <span className="text-destructive">
                            ({language === 'ar' ? 'غير نشط' : 'Inactive'})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleDoctorActive(doctor.id, doctor.active)}
                        title={doctor.active
                          ? (language === 'ar' ? 'إلغاء التفعيل' : 'Deactivate')
                          : (language === 'ar' ? 'تفعيل' : 'Activate')
                        }
                      >
                        {doctor.active
                          ? <UserX className="w-4 h-4 text-warning" />
                          : <UserCheck className="w-4 h-4 text-success" />
                        }
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEditDoctor(doctor)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {doctors.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    {language === 'ar' ? 'لا يوجد أطباء مسجلين' : 'No doctors registered'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6">
          <Card variant="elevated" className="animate-fade-in">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl gradient-accent flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-accent-foreground" />
                  </div>
                  <div className="text-start">
                    <CardTitle>{language === 'ar' ? 'الخدمات والأسعار' : 'Services & Pricing'}</CardTitle>
                    <CardDescription>
                      {language === 'ar' ? 'إدارة خدمات العيادة والأسعار الافتراضية' : 'Manage clinic services and default prices'}
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={handleAddService} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  {language === 'ar' ? 'إضافة' : 'Add'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {services.map(service => (
                  <div
                    key={service.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex-1 text-start">
                      <p className="font-medium">{service.name}</p>
                    </div>
                    <div className="text-end min-w-[100px]">
                      <p className="font-bold text-primary">{service.defaultPrice}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditService(service)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteService(service.id)} className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lists Tab (Cities) */}
        <TabsContent value="lists" className="space-y-6">
          <Card variant="elevated" className="animate-fade-in">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-info flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-info-foreground" />
                  </div>
                  <div className="text-start">
                    <CardTitle>{language === 'ar' ? 'قائمة المدن' : 'Cities List'}</CardTitle>
                    <CardDescription>
                      {language === 'ar' ? 'المدن المتاحة في نموذج المريض' : 'Available cities in patient form'}
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={handleAddCity} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  {language === 'ar' ? 'إضافة' : 'Add'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {cities.map(city => (
                  <div
                    key={city.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 text-start min-w-0">
                      <p className="font-medium truncate">{city.name}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditCity(city)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCity(city.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* App Info */}
      <Card variant="ghost" className="border border-border">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">
            {language === 'ar' ? 'دينتا كير - نظام إدارة عيادات الأسنان' : 'DentaCare - Dental Clinic Management System'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {language === 'ar' ? 'الإصدار 1.0.0' : 'Version 1.0.0'}
          </p>
        </CardContent>
      </Card>

      {/* Service Dialog - Single Name Field */}
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService
                ? (language === 'ar' ? 'تعديل الخدمة' : 'Edit Service')
                : (language === 'ar' ? 'إضافة خدمة' : 'Add Service')
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'اسم الخدمة' : 'Service Name'}</Label>
              <Input
                value={serviceForm.name}
                onChange={(e) => setServiceForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder={language === 'ar' ? 'اكتب اسم الخدمة' : 'Enter service name'}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'السعر الافتراضي' : 'Default Price'}</Label>
              <Input
                type="number"
                value={serviceForm.defaultPrice}
                onChange={(e) => setServiceForm(prev => ({ ...prev, defaultPrice: Number(e.target.value) }))}
                placeholder="100"
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceDialogOpen(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSaveService}>
              {language === 'ar' ? 'حفظ' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* City Dialog - Single Name Field */}
      <Dialog open={cityDialogOpen} onOpenChange={setCityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCity
                ? (language === 'ar' ? 'تعديل المدينة' : 'Edit City')
                : (language === 'ar' ? 'إضافة مدينة' : 'Add City')
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'المدينة' : 'City Name'}</Label>
              <Input
                value={cityForm.name}
                onChange={(e) => setCityForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder={language === 'ar' ? 'اكتب اسم المدينة' : 'Enter city name'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCityDialogOpen(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSaveCity}>
              {language === 'ar' ? 'حفظ' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Doctor Dialog - Single Name Field */}
      <Dialog open={doctorDialogOpen} onOpenChange={setDoctorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDoctor
                ? (language === 'ar' ? 'تعديل الطبيب' : 'Edit Doctor')
                : (language === 'ar' ? 'إضافة طبيب' : 'Add Doctor')
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'اسم الطبيب' : 'Doctor Name'}</Label>
              <Input
                value={doctorForm.name}
                onChange={(e) => setDoctorForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder={language === 'ar' ? 'اكتب الاسم الكامل' : 'Enter full name'}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'الدور' : 'Role'}</Label>
              <Select
                value={doctorForm.role}
                onValueChange={(value) => setDoctorForm(prev => ({ ...prev, role: value as 'doctor' | 'assistant' | 'hygienist' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="doctor">{language === 'ar' ? 'طبيب' : 'Doctor'}</SelectItem>
                  <SelectItem value="assistant">{language === 'ar' ? 'مساعد' : 'Assistant'}</SelectItem>
                  <SelectItem value="hygienist">{language === 'ar' ? 'أخصائي تنظيف' : 'Hygienist'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'نوع العمولة' : 'Commission Type'}</Label>
                <Select
                  value={doctorForm.commissionType || 'percentage'}
                  onValueChange={(value) => setDoctorForm(prev => ({ ...prev, commissionType: value as 'percentage' | 'fixed' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="percentage">{language === 'ar' ? 'نسبة مئوية %' : 'Percentage %'}</SelectItem>
                    <SelectItem value="fixed">{language === 'ar' ? 'مبلغ ثابت' : 'Fixed Amount'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {doctorForm.commissionType === 'percentage'
                    ? (language === 'ar' ? 'النسبة %' : 'Percentage %')
                    : (language === 'ar' ? 'المبلغ لكل فاتورة' : 'Amount per Invoice')
                  }
                </Label>
                <Input
                  type="number"
                  value={doctorForm.commissionValue}
                  onChange={(e) => setDoctorForm(prev => ({ ...prev, commissionValue: Number(e.target.value) }))}
                  placeholder={doctorForm.commissionType === 'percentage' ? '30' : '100'}
                  dir="ltr"
                  min={0}
                  max={doctorForm.commissionType === 'percentage' ? 100 : undefined}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDoctorDialogOpen(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSaveDoctor}>
              {language === 'ar' ? 'حفظ' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
