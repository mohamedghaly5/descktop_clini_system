import React, { useState } from 'react';
import { Globe, Building2, DollarSign, MapPin, Briefcase, Plus, Trash2, Edit2, Stethoscope, UserCheck, UserX, Percent, Upload, Key, FlaskConical, KeyRound } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { UpdateCard } from '@/components/features/settings/update-card';
import LicenseSettings from './LicenseSettings';
import BackupSettings from '@/components/BackupSettings';
import LabServicesSettings from '@/components/settings/LabServicesSettings';
import ChangePinDialog from '@/components/auth/ChangePinDialog';

// Local Interfaces
interface Service { id: string; name: string; defaultPrice: number; }
interface City { id: string; name: string; }
interface Doctor { id: string; name: string; role: string; active: boolean; commissionType?: 'percentage' | 'fixed'; commissionValue?: number; }

const CURRENCY_OPTIONS = [
  { code: 'EGP', symbol: 'EGP', displayName: 'Egyptian Pound' },
  { code: 'USD', symbol: '$', displayName: 'US Dollar' },
  { code: 'SAR', symbol: 'SAR', displayName: 'Saudi Riyal' },
  { code: 'AED', symbol: 'AED', displayName: 'UAE Dirham' },
];

const SettingsPage: React.FC = () => {
  const { t, isRTL, language, setLanguage } = useLanguage();
  const { user } = useAuth();

  // NOTE: Context Removed. Logic is now local.
  // We manage 'currency' and 'clinicInfo' via local state + IPC
  const [currency, setCurrency] = useState('EGP');
  const [clinicInfo, setClinicInfo] = useState<any>({
    name: '', ownerName: '', phone: '', email: '', whatsappNumber: '',
    address: '', logo: '', currency: 'EGP'
  });

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
    try {
      if (editingService) {
        // Update
        const res = await window.electron.ipcRenderer.invoke('db:update', {
          table: 'services',
          id: editingService.id,
          data: {
            name: serviceForm.name,
            default_price: parseFloat(serviceForm.defaultPrice.toString()) || 0
          }
        });
        success = !res.error;
      } else {
        // Create
        const res = await window.electron.ipcRenderer.invoke('db:insert', {
          table: 'services',
          data: {
            name: serviceForm.name,
            default_price: parseFloat(serviceForm.defaultPrice.toString()) || 0
          }
        });
        success = !res.error;
      }
    } catch (e) {
      console.error(e);
      success = false;
    }

    if (success) {
      toast.success(language === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully');
      setServiceDialogOpen(false);
      fetchLocalLists();
    } else {
      toast.error(language === 'ar' ? 'فشل الحفظ' : 'Failed to save');
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await window.electron.ipcRenderer.invoke('db:delete', { table: 'services', id });
      toast.success(language === 'ar' ? 'تم حذف الخدمة' : 'Service deleted');
      fetchLocalLists();
    } catch (e) {
      toast.error('Error deleting');
    }
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
    try {
      if (editingCity) {
        const res = await window.electron.ipcRenderer.invoke('db:update', {
          table: 'cities',
          id: editingCity.id,
          data: { name: cityForm.name }
        });
        success = !res.error;
      } else {
        const res = await window.electron.ipcRenderer.invoke('db:insert', {
          table: 'cities',
          data: { name: cityForm.name }
        });
        success = !res.error;
      }
    } catch (e) { success = false; }

    if (success) {
      toast.success(language === 'ar' ? 'تم الحفظ' : 'Saved');
      setCityDialogOpen(false);
      fetchLocalLists();
    } else {
      toast.error(language === 'ar' ? 'فشل الحفظ' : 'Failed to save');
    }
  };

  const handleDeleteCity = async (id: string) => {
    try {
      await window.electron.ipcRenderer.invoke('db:delete', { table: 'cities', id });
      toast.success(language === 'ar' ? 'تم الحذف' : 'Deleted');
      fetchLocalLists();
    } catch (e) { }
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
      role: (doctor.role as any),
      commissionType: (doctor.commissionType as any) || 'percentage',
      commissionValue: doctor.commissionValue || 0
    });
    setDoctorDialogOpen(true);
  };

  // Clinic Info Local State (for smooth typing)
  const [localClinicInfo, setLocalClinicInfo] = useState(clinicInfo);
  const [isSaving, setIsSaving] = useState(false);
  const [localStaff, setLocalStaff] = useState<Doctor[]>([]); // New local state for staff
  const [localServices, setLocalServices] = useState<Service[]>([]); // Local state for services
  const [localCities, setLocalCities] = useState<City[]>([]); // Local state for cities

  const [isReadOnly, setIsReadOnly] = useState(false);

  const checkSystemStatus = async () => {
    try {
      // @ts-ignore
      const status = await window.api.getSystemStatus();
      setIsReadOnly(!!status?.isReadOnly);
    } catch (e) {
      console.error("Failed to check system status", e);
    }
  };

  const fetchStaff = async () => {
    try {
      // Direct IPC call, robust against missing email
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('staff:get-all');
      if (Array.isArray(result)) {
        setLocalStaff(result.map((d: any) => ({
          id: d.id,
          name: d.name,
          role: d.role,
          active: Boolean(d.active),
          commissionType: d.commission_type,
          commissionValue: d.commission_value
        })));
      }
    } catch (e) {
      console.error("Failed to fetch staff:", e);
    }
  };

  const fetchLocalLists = async () => {
    try {
      // Fetch Services
      // @ts-ignore
      const sResult = await window.electron.ipcRenderer.invoke('services:getAll');
      if (Array.isArray(sResult)) {
        setLocalServices(sResult.map((s: any) => ({ id: s.id, name: s.name, defaultPrice: s.default_price })));
      }

      // Fetch Cities
      // @ts-ignore
      const cResult = await window.electron.ipcRenderer.invoke('cities:getAll');
      if (Array.isArray(cResult)) {
        setLocalCities(cResult.map((c: any) => ({ id: c.id, name: c.name })));
      }
    } catch (e) {
      console.error("Failed to fetch local lists:", e);
    }
  };

  // Initial Fetch
  React.useEffect(() => {
    checkSystemStatus();
    fetchStaff();
    fetchLocalLists();
  }, []);

  // Sync local state when context data arrives
  React.useEffect(() => {
    setLocalClinicInfo(clinicInfo);
  }, [clinicInfo]);

  // FIX: Load from Local DB on mount to ensure data exists even if Context is slow/blocked
  React.useEffect(() => {
    const loadLocalData = async () => {
      try {
        const response = await window.electron.ipcRenderer.invoke('settings:getClinicInfo');
        if (response && response.data) {
          const dbData = response.data;
          setLocalClinicInfo(prev => ({
            ...prev,
            // Map DB snake_case to CamelCase
            name: dbData.clinic_name || prev.name || '',
            ownerName: dbData.owner_name || prev.ownerName || '',
            address: dbData.address || prev.address || '',
            phone: dbData.phone || prev.phone || '',
            whatsappNumber: dbData.whatsapp_number || prev.whatsappNumber || '',
            logo: dbData.clinic_logo || prev.logo || '',
            // Keep email from Auth (prev.email) if available, else DB
            email: prev.email || dbData.email || ''
          }));
        }
      } catch (error) {
        console.error("Failed to load local clinic info:", error);
      }
    };
    loadLocalData();
  }, []);

  const handleSaveDoctor = async () => {
    if (!doctorForm.name.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال اسم الطبيب' : 'Please enter doctor name');
      return;
    }
    let success = false;
    const docData: any = {
      name: doctorForm.name,
      role: doctorForm.role || 'doctor',
      commission_type: doctorForm.commissionType || 'percentage',
      commission_value: isNaN(Number(doctorForm.commissionValue)) ? 0 : Number(doctorForm.commissionValue),
      active: 1 // Send as integer 1 for SQLite
    };

    try {
      if (editingDoctor) {
        const res = await window.electron.ipcRenderer.invoke('db:update', {
          table: 'doctors',
          id: editingDoctor.id,
          data: docData
        });
        success = !res.error;
      } else {
        const res = await window.electron.ipcRenderer.invoke('db:insert', {
          table: 'doctors',
          data: docData
        });
        success = !res.error;
      }
    } catch (e) { console.error(e); }

    if (success) {
      setDoctorDialogOpen(false);
      fetchStaff();
      toast.success(language === 'ar' ? 'تم الحفظ' : 'Saved');
    } else {
      toast.error('Error saving');
    }
  };

  const handleToggleDoctorActive = async (id: string, currentActive: boolean) => {
    try {
      await window.electron.ipcRenderer.invoke('db:update', {
        table: 'doctors',
        id,
        data: { active: !currentActive }
      });
      fetchStaff();
      toast.success(language === 'ar' ? 'تم التحديث' : 'Updated');
    } catch (e) { console.error(e); }
  };

  const handleDeleteDoctor = async (id: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا الطبيب؟' : 'Are you sure you want to delete this doctor?')) return;
    try {
      // Soft Delete: Set is_deleted = 1
      await window.electron.ipcRenderer.invoke('db:update', {
        table: 'doctors',
        id,
        data: { is_deleted: 1 }
      });
      fetchStaff();
      toast.success(language === 'ar' ? 'تم الحذف بنجاح' : 'Deleted successfully');
    } catch (e) {
      console.error(e);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء الحذف' : 'Error deleting');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB
        toast.error(language === 'ar' ? 'حجم الصورة يجب أن لا يتعدى 2 ميجابايت' : 'Image size must be less than 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // CORRECT FIX: Update local form state (localClinicInfo), NOT the synced state (setClinicInfo)
        // Updating `setClinicInfo` triggers a `useEffect` that overwrites `localClinicInfo` with old data, causing the reset.
        setLocalClinicInfo((prev: any) => ({ ...prev, logo: base64String }));

        toast.info(language === 'ar' ? 'اضغط حفظ التعديلات لتأكيد الشعار' : 'Click Save Changes to confirm logo');
      };
      reader.readAsDataURL(file);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'doctor': return language === 'ar' ? 'طبيب' : 'Doctor';
      case 'assistant': return language === 'ar' ? 'مساعد' : 'Assistant';
      case 'hygienist': return language === 'ar' ? 'أخصائي تنظيف' : 'Hygienist';
      default: return role;
    }
  };

  // Generic handler for local updates
  const handleClinicInfoChange = (field: keyof typeof localClinicInfo, value: string) => {
    setLocalClinicInfo(prev => ({ ...prev, [field]: value }));
  };

  // Use Context for GLOBAL updates (Sidebar etc)
  const { updateClinicInfo } = useSettings();

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      // 1. Update Global Context & Persist to DB via Context
      // This ensures Sidebar and other components update immediately
      await updateClinicInfo(localClinicInfo);

      // 2. Refresh local data to be sure (optional, but good for consistency)
      setClinicInfo({ ...localClinicInfo });

      toast.success(language === 'ar' ? 'تم تحديث بيانات العيادة بنجاح' : 'Clinic info updated successfully');
    } catch (error) {
      console.error(error);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'Error saving changes');
    } finally {
      setIsSaving(false);
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

      <Tabs defaultValue="general" className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <TabsList className="flex flex-wrap h-auto w-full justify-start gap-2 bg-muted/50 p-2 lg:w-fit">
          <TabsTrigger value="general" className="flex-1 lg:flex-none flex items-center gap-2 px-4">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'عام' : 'General'}</span>
          </TabsTrigger>
          <TabsTrigger value="clinic" className="flex-1 lg:flex-none flex items-center gap-2 px-4">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'العيادة' : 'Clinic'}</span>
          </TabsTrigger>
          <TabsTrigger value="doctors" className="flex-1 lg:flex-none flex items-center gap-2 px-4">
            <Stethoscope className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'الأطباء' : 'Doctors'}</span>
          </TabsTrigger>
          <TabsTrigger value="services" className="flex-1 lg:flex-none flex items-center gap-2 px-4">
            <Briefcase className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'الخدمات' : 'Services'}</span>
          </TabsTrigger>
          <TabsTrigger value="lab-services" className="flex-1 lg:flex-none flex items-center gap-2 px-4">
            <FlaskConical className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'خدمات المعمل' : 'Lab Services'}</span>
          </TabsTrigger>
          <TabsTrigger value="lists" className="flex-1 lg:flex-none flex items-center gap-2 px-4">
            <MapPin className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'القوائم' : 'Lists'}</span>
          </TabsTrigger>

          <TabsTrigger value="license" className="flex-1 lg:flex-none flex items-center gap-2 px-4">
            <Key className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'الرخصة' : 'License'}</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex-1 lg:flex-none flex items-center gap-2 px-4">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'النسخ الاحتياطي' : 'Backup'}</span>
          </TabsTrigger>
        </TabsList>



        {/* License Tab */}
        <TabsContent value="license" className="space-y-6">
          <LicenseSettings />
        </TabsContent>

        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-6">
          <BackupSettings />
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

          {/* Security Card (Change PIN) */}
          <Card variant="elevated" className="animate-fade-in border-destructive/20" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <KeyRound className="w-6 h-6 text-destructive" />
                </div>
                <div className="text-start">
                  <CardTitle>{language === 'ar' ? 'الأمان' : 'Security'}</CardTitle>
                  <CardDescription>
                    {language === 'ar' ? 'قم بتغيير الرقم السري الخاص بك' : 'Change your PIN code'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChangePinDialog
                trigger={
                  <Button variant="outline" className="w-full sm:w-auto">
                    {language === 'ar' ? 'تغيير الرقم السري' : 'Change PIN'}
                  </Button>
                }
              />
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

          {/* Software Update */}
          <UpdateCard language={language} />

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
                    value={localClinicInfo.name || ''}
                    onChange={(e) => handleClinicInfoChange('name', e.target.value)}
                    placeholder={language === 'ar' ? 'اسم العيادة' : 'Clinic Name'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'اسم صاحب العيادة / الطبيب' : 'Owner / Doctor Name'}</Label>
                  <Input
                    value={localClinicInfo.ownerName || ''}
                    onChange={(e) => handleClinicInfoChange('ownerName', e.target.value)}
                    placeholder={language === 'ar' ? 'د. أحمد' : 'Dr. Ahmed'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'العنوان' : 'Address'}</Label>
                  <Input
                    value={localClinicInfo.address || ''}
                    onChange={(e) => handleClinicInfoChange('address', e.target.value)}
                    placeholder={language === 'ar' ? 'عنوان العيادة' : 'Clinic Address'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</Label>
                  <Input
                    value={localClinicInfo.phone || ''}
                    onChange={(e) => handleClinicInfoChange('phone', e.target.value)}
                    placeholder="+20 123 456 7890"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'رقم الواتساب' : 'WhatsApp Number'}</Label>
                  <Input
                    value={localClinicInfo.whatsappNumber || ''}
                    onChange={(e) => handleClinicInfoChange('whatsappNumber', e.target.value)}
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
                    value={user?.email || ''}
                    disabled
                    readOnly
                    className="bg-muted/50 cursor-not-allowed"
                    placeholder="info@clinic.com"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {language === 'ar'
                      ? 'البريد الإلكتروني مرتبط بحسابك ولا يمكن تغييره من هنا'
                      : 'Email is linked to your account and cannot be changed here'}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'شعار العيادة' : 'Clinic Logo'}</Label>
                <div className="flex items-start gap-4 border rounded-lg p-4 bg-secondary/10">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('logo-upload')?.click()}
                        className="gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        {language === 'ar' ? 'اختر الشعار' : 'Choose Logo'}
                      </Button>
                      <Input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      {localClinicInfo.logo && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                          onClick={() => setLocalClinicInfo((prev: any) => ({ ...prev, logo: '' }))}
                        >
                          {language === 'ar' ? 'حذف' : 'Remove'}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {language === 'ar'
                        ? 'يفضل أن تكون الصورة مربعة (500x500) وبحجم لا يزيد عن 2 ميجابايت'
                        : 'Recommended: Square 500x500px, Max 2MB'}
                    </p>
                  </div>

                  {localClinicInfo.logo ? (
                    <div className="w-20 h-20 border rounded-lg bg-background flex items-center justify-center p-1 shadow-sm overflow-hidden relative group">
                      <img src={localClinicInfo.logo} alt="Clinic Logo" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground bg-muted/50">
                      <Building2 className="w-8 h-8 opacity-50" />
                    </div>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSaveChanges} disabled={isSaving} className="min-w-[120px]">
                  {isSaving
                    ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...')
                    : (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes')
                  }
                </Button>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* Doctors Tab */}
        <TabsContent value="doctors" className="space-y-6">
          {isReadOnly && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-center gap-2" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              <div className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-200 text-amber-700 shrink-0">!</div>
              <p className="text-sm font-medium">
                {language === 'ar'
                  ? 'إدارة فريق العمل غير متاحة في وضع القراءة فقط (تجديد الترخيص مطلوب)'
                  : 'Staff management is disabled in Read-Only mode (License renewal required)'}
              </p>
            </div>
          )}
          {/* Note: We disable interactions properly but keep visibility */}
          <Card variant="elevated" className={cn("animate-fade-in")}>
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
                {!isReadOnly && (
                  <Button onClick={handleAddDoctor} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    {language === 'ar' ? 'إضافة' : 'Add'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {localStaff.map(doctor => (
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
                      {!isReadOnly && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleEditDoctor(doctor)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteDoctor(doctor.id)}
                            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {localStaff.length === 0 && (
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
                {localServices.map(service => (
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

        {/* Lab Services Tab */}
        <TabsContent value="lab-services" className="space-y-6">
          <LabServicesSettings />
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
                {localCities.map(city => (
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
            {language === 'ar' ? 'دينتال فلو - نظام إدارة عيادات الأسنان' : 'Dental Flow - Dental Clinic Management System'}
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
