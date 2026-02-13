import React, { useState } from 'react';
import axios from 'axios';
import { db } from '@/services/db';
import {
  Globe,
  Building2,
  DollarSign,
  MapPin,
  Briefcase,
  Plus,
  Trash2,
  Edit2,
  Stethoscope,
  UserCheck,
  UserX,
  Percent,
  Upload,
  Key,
  FlaskConical,
  KeyRound,
  Settings as SettingsIcon,
  ShieldCheck,
  Save,
  ArrowRight,
  UserCircle
} from 'lucide-react';
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
import UserManagementTab from '@/components/settings/UserManagementTab';
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
  const { user, hasPermission } = useAuth();
  const canEditSettings = hasPermission('CLINIC_SETTINGS');

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

  // Form states
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
        const res = await db.services.update(editingService.id, {
          name: serviceForm.name,
          default_price: parseFloat(serviceForm.defaultPrice.toString()) || 0
        });
        success = !res?.error;
      } else {
        const res = await db.services.create({
          name: serviceForm.name,
          default_price: parseFloat(serviceForm.defaultPrice.toString()) || 0
        });
        success = !res?.error;
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
    if (!canEditSettings) {
      toast.error(language === 'ar' ? 'ليس لديك صلاحية' : 'Permission denied');
      return;
    }
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذه الخدمة؟' : 'Are you sure you want to delete this service?')) return;
    try {
      const res = await db.services.delete(id);
      if (res?.error) throw new Error(res.error);

      toast.success(language === 'ar' ? 'تم حذف الخدمة' : 'Service deleted');
      fetchLocalLists();
    } catch (e: any) {
      console.error(e);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء الحذف' : 'Error deleting');
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
        const res = await db.cities.update(editingCity.id, { name: cityForm.name });
        success = !res?.error;
      } else {
        const res = await db.cities.create({ name: cityForm.name });
        success = !res?.error;
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
    if (!canEditSettings) return;
    if (!confirm(language === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?')) return;

    try {
      const res = await db.cities.delete(id);
      if (res?.error) throw new Error(res.error);

      toast.success(language === 'ar' ? 'تم الحذف' : 'Deleted');
      fetchLocalLists();
    } catch (e: any) {
      toast.error(language === 'ar' ? 'حدث خطأ' : 'Error');
    }
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

  // Clinic Info Local State
  const [localClinicInfo, setLocalClinicInfo] = useState(clinicInfo);
  const [isSaving, setIsSaving] = useState(false);
  const [localStaff, setLocalStaff] = useState<Doctor[]>([]);
  const [localServices, setLocalServices] = useState<Service[]>([]);
  const [localCities, setLocalCities] = useState<City[]>([]);

  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isClientMode, setIsClientMode] = useState(false);

  const checkSystemStatus = async () => {
    try {
      // @ts-ignore
      if ((window as any).api && (window as any).api.getSystemStatus) {
        // @ts-ignore
        const status = await window.api.getSystemStatus();
        setIsReadOnly(!!status?.isReadOnly);
        if (status && status.mode === 'client') setIsClientMode(true);
      } else {
        setIsClientMode(true);
      }
    } catch (e) {
      console.error("Failed to check system status", e);
    }
  };

  const fetchStaff = async () => {
    try {
      const result = await db.doctors.getAll();
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
      const sResult = await db.services.getAll();
      if (Array.isArray(sResult)) {
        setLocalServices(sResult.map((s: any) => ({ id: s.id, name: s.name, defaultPrice: s.default_price })));
      }
      const cResult = await db.cities.getAll();
      if (Array.isArray(cResult)) {
        setLocalCities(cResult.map((c: any) => ({ id: c.id, name: c.name })));
      }
    } catch (e) {
      console.error("Failed to fetch local lists:", e);
    }
  };

  React.useEffect(() => {
    checkSystemStatus();
    fetchStaff();
    fetchLocalLists();
  }, []);

  React.useEffect(() => {
    setLocalClinicInfo(clinicInfo);
  }, [clinicInfo]);

  React.useEffect(() => {
    const loadLocalData = async () => {
      try {
        let dbData = null;
        const response = await db.settings.getClinicInfo();
        dbData = (response && response.data) ? response.data : response;

        if (dbData) {
          setLocalClinicInfo((prev: any) => ({
            ...prev,
            name: dbData.clinic_name || prev.name || '',
            ownerName: dbData.owner_name || prev.ownerName || '',
            address: dbData.address || prev.address || '',
            phone: dbData.phone || prev.phone || '',
            whatsappNumber: dbData.whatsapp_number || prev.whatsappNumber || '',
            logo: dbData.clinic_logo || prev.logo || '',
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
      active: 1
    };

    try {
      if (editingDoctor) {
        const res = await db.doctors.update(editingDoctor.id, docData);
        if (res?.error) console.error("Update doctor failed:", res.error);
        success = !res?.error;
      } else {
        const res = await db.doctors.create(docData);
        if (res?.error) console.error("Insert doctor failed:", res.error);
        success = !res?.error;
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

  const handleDeleteDoctor = async (id: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا الطبيب؟' : 'Are you sure you want to delete this doctor?')) return;
    try {
      const res = await db.doctors.delete(id);
      if (res?.error) throw new Error(res.error);

      fetchStaff();
      toast.success(language === 'ar' ? 'تم الحذف بنجاح' : 'Deleted successfully');
    } catch (e: any) {
      console.error(e);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء الحذف' : 'Error deleting');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error(language === 'ar' ? 'حجم الصورة يجب أن لا يتعدى 2 ميجابايت' : 'Image size must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
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

  const handleClinicInfoChange = (field: keyof typeof localClinicInfo, value: string) => {
    setLocalClinicInfo((prev: any) => ({ ...prev, [field]: value }));
  };

  const { updateClinicInfo } = useSettings();

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      await updateClinicInfo(localClinicInfo);
      setClinicInfo({ ...localClinicInfo });
      toast.success(language === 'ar' ? 'تم تحديث بيانات العيادة بنجاح' : 'Clinic info updated successfully');
    } catch (error) {
      console.error(error);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'Error saving changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper for Tab Triggers with Icons
  const TabTriggerItem = ({ value, icon: Icon, label }: { value: string, icon: any, label: string }) => (
    <TabsTrigger
      value={value}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white transition-all duration-300"
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline font-medium">{label}</span>
    </TabsTrigger>
  );

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 animate-fade-in pb-20 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-gray-900 dark:to-gray-800 min-h-screen rounded-3xl">

      {/* Premium Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card/50 p-6 rounded-2xl border backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-indigo-600 ring-1 ring-indigo-500/20 shadow-sm">
            <SettingsIcon className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('settings')}</h1>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? 'إدارة إعدادات التطبيق الكاملة' : 'Manage full application settings'}
            </p>
          </div>
        </div>

        {/* App Info Badge */}
        <div className="bg-background/50 px-4 py-2 rounded-xl text-xs text-muted-foreground border">
          v1.0.6
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {/* Modern Tabs Navigation */}
        <div className="overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-md p-1.5 rounded-2xl h-auto border inline-flex min-w-full md:min-w-0 md:flex-wrap lg:flex-nowrap gap-1">
            <TabTriggerItem value="general" icon={Globe} label={language === 'ar' ? 'عام' : 'General'} />
            <TabTriggerItem value="clinic" icon={Building2} label={language === 'ar' ? 'العيادة' : 'Clinic'} />
            <TabTriggerItem value="doctors" icon={Stethoscope} label={language === 'ar' ? 'الأطباء' : 'Doctors'} />
            <TabTriggerItem value="services" icon={Briefcase} label={language === 'ar' ? 'الخدمات' : 'Services'} />
            <TabTriggerItem value="lab-services" icon={FlaskConical} label={language === 'ar' ? 'خدمات المعمل' : 'Lab Services'} />
            <TabTriggerItem value="lists" icon={MapPin} label={language === 'ar' ? 'المدن' : 'Cities'} />
            <TabTriggerItem value="license" icon={ShieldCheck} label={language === 'ar' ? 'الرخصة' : 'License'} />
            <TabTriggerItem value="backup" icon={Upload} label={language === 'ar' ? 'نسخ احتياطي' : 'Backup'} />
            {(user?.role === 'admin' || hasPermission('ADD_USER')) && !isClientMode && (
              <TabTriggerItem value="users" icon={UserCheck} label={language === 'ar' ? 'المستخدمين' : 'Users'} />
            )}
          </TabsList>
        </div>

        {/* --- TABS CONTENT --- */}

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Language */}
            <Card className="border-none shadow-md bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-lg">{language === 'ar' ? 'اللغة' : 'Language'}</CardTitle>
                  <CardDescription>{language === 'ar' ? 'لغة العرض في التطبيق' : 'Application display language'}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex gap-4">
                <Button
                  variant={language === 'en' ? 'default' : 'outline'}
                  onClick={() => setLanguage('en')}
                  className={cn("flex-1 h-12 text-lg", language === 'en' && "bg-blue-600 hover:bg-blue-700")}
                >
                  <span className="me-2 text-2xl">🇺🇸</span> English
                </Button>
                <Button
                  variant={language === 'ar' ? 'default' : 'outline'}
                  onClick={() => setLanguage('ar')}
                  className={cn("flex-1 h-12 text-lg", language === 'ar' && "bg-blue-600 hover:bg-blue-700")}
                >
                  <span className="me-2 text-2xl">🇸🇦</span> العربية
                </Button>
              </CardContent>
            </Card>

            {/* Currency */}
            <Card className="border-none shadow-md bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-lg">{language === 'ar' ? 'العملة' : 'Currency'}</CardTitle>
                  <CardDescription>{language === 'ar' ? 'العملة الافتراضية للعيادة' : 'Default clinic currency'}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Select value={currency} onValueChange={(value) => setCurrency(value as any)} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <SelectTrigger className="w-full h-12 text-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    {CURRENCY_OPTIONS.map(option => (
                      <SelectItem key={option.code} value={option.code}>
                        <span className="font-bold me-2">{option.symbol}</span> - {option.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Security - Only for Admin on Server */}
            {user?.role === 'admin' && !isClientMode && (
              <Card className="border-none shadow-md bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/20 text-rose-600 flex items-center justify-center">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{language === 'ar' ? 'الأمان' : 'Security'}</CardTitle>
                    <CardDescription>{language === 'ar' ? 'تغيير رقم المرور الشخصي' : 'Change personal PIN code'}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <ChangePinDialog
                    trigger={
                      <Button variant="outline" className="w-full h-12 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-900/50">
                        {language === 'ar' ? 'تغيير الرقم السري' : 'Change PIN'}
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            )}

            <div className="md:col-span-2">
              <UpdateCard language={language} />
            </div>
          </div>
        </TabsContent>

        {/* Clinic Info Tab */}
        <TabsContent value="clinic" className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <Card className="border-none shadow-md bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
            <CardHeader className="border-b border-border/50 pb-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <CardTitle className="text-xl">{language === 'ar' ? 'بيانات العيادة' : 'Clinic Details'}</CardTitle>
                  <CardDescription>{language === 'ar' ? 'المعلومات التي تظهر في التقارير والفواتير' : 'Details appearing in reports and invoices'}</CardDescription>
                </div>
                <div className="ms-auto">
                  <Button onClick={handleSaveChanges} disabled={isSaving || !canEditSettings} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
                    <Save className="w-4 h-4 me-2" />
                    {isSaving ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes')}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'اسم العيادة' : 'Clinic Name'}</Label>
                  <Input
                    className="h-11"
                    value={localClinicInfo.name || ''}
                    onChange={(e) => handleClinicInfoChange('name', e.target.value)}
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'اسم الطبيب / المالك' : 'Doctor / Owner Name'}</Label>
                  <Input
                    className="h-11"
                    value={localClinicInfo.ownerName || ''}
                    onChange={(e) => handleClinicInfoChange('ownerName', e.target.value)}
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</Label>
                  <Input
                    className="h-11"
                    value={localClinicInfo.phone || ''}
                    onChange={(e) => handleClinicInfoChange('phone', e.target.value)}
                    dir="ltr"
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'رقم الواتساب' : 'WhatsApp Number'}</Label>
                  <Input
                    className="h-11"
                    value={localClinicInfo.whatsappNumber || ''}
                    onChange={(e) => handleClinicInfoChange('whatsappNumber', e.target.value)}
                    dir="ltr"
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{language === 'ar' ? 'العنوان' : 'Address'}</Label>
                  <Input
                    className="h-11"
                    value={localClinicInfo.address || ''}
                    onChange={(e) => handleClinicInfoChange('address', e.target.value)}
                    disabled={!canEditSettings}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-background/50 flex flex-col sm:flex-row items-center gap-6">
                <div className="relative group cursor-pointer" onClick={() => canEditSettings && document.getElementById('logo-upload')?.click()}>
                  {localClinicInfo.logo ? (
                    <img src={localClinicInfo.logo} alt="Logo" className="w-24 h-24 rounded-full object-contain bg-white border shadow-sm" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                      <Upload className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                  )}
                  {canEditSettings && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit2 className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-center sm:text-start space-y-2">
                  <h4 className="font-semibold">{language === 'ar' ? 'شعار العيادة' : 'Clinic Logo'}</h4>
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'انقر على الصورة لرفع شعار جديد (مربع 500x500)' : 'Click image to upload new logo (Square 500x500)'}
                  </p>
                  <Input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={!canEditSettings}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Doctors Tab */}
        <TabsContent value="doctors" className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <Card className="border-none shadow-md bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle>{language === 'ar' ? 'قائمة الأطباء' : 'Doctors List'}</CardTitle>
                  <CardDescription>{language === 'ar' ? 'إدارة الطاقم الطبي والعمولات' : 'Manage staff and commissions'}</CardDescription>
                </div>
              </div>
              {!isReadOnly && canEditSettings && (
                <Button onClick={handleAddDoctor} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                  <Plus className="w-4 h-4" /> {language === 'ar' ? 'إضافة' : 'Add'}
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {localStaff.map(doctor => (
                <div key={doctor.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-all duration-200">
                  <div className={cn("w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold", doctor.active ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500")}>
                    {doctor.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{doctor.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="capitalize">{getRoleLabel(doctor.role)}</span>
                      {doctor.commissionValue > 0 && (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">
                          {doctor.commissionType === 'percentage' ? `${doctor.commissionValue}%` : `${doctor.commissionValue} Fix`}
                        </span>
                      )}
                    </div>
                  </div>
                  {!isReadOnly && canEditSettings && (
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditDoctor(doctor)} className="h-8 w-8 text-blue-600">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteDoctor(doctor.id)} className="h-8 w-8 text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {localStaff.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground">
                  {language === 'ar' ? 'لا يوجد أطباء' : 'No doctors found'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <Card className="border-none shadow-md bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/20 text-orange-600 flex items-center justify-center">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle>{language === 'ar' ? 'الخدمات العلاجية' : 'Services'}</CardTitle>
                  <CardDescription>{language === 'ar' ? 'قائمة الخدمات والأسعار الافتراضية' : 'Services dictionary & prices'}</CardDescription>
                </div>
              </div>
              <Button onClick={handleAddService} disabled={!canEditSettings} className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
                <Plus className="w-4 h-4" /> {language === 'ar' ? 'إضافة' : 'Add'}
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {localServices.map(service => (
                <div key={service.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:border-orange-200 transition-colors">
                  <div>
                    <p className="font-semibold">{service.name}</p>
                    <p className="text-sm font-bold text-orange-600 mt-1">{service.defaultPrice} {currency}</p>
                  </div>
                  <div className="flex gap-1">
                    {canEditSettings && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => handleEditService(service)} className="h-8 w-8 text-muted-foreground">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteService(service.id)} className="h-8 w-8 text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lab Services Tab */}
        <TabsContent value="lab-services" className="animate-in slide-in-from-bottom-4 duration-500">
          <LabServicesSettings />
        </TabsContent>

        {/* Cities Tab */}
        <TabsContent value="lists" className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <Card className="border-none shadow-md bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-900/20 text-teal-600 flex items-center justify-center">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle>{language === 'ar' ? 'المدن والمناطق' : 'Cities & Locations'}</CardTitle>
                  <CardDescription>{language === 'ar' ? 'المدن المتاحة في ملف المريض' : 'Locations available in patient files'}</CardDescription>
                </div>
              </div>
              <Button onClick={handleAddCity} disabled={!canEditSettings} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                <Plus className="w-4 h-4" /> {language === 'ar' ? 'إضافة' : 'Add'}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {localCities.map(city => (
                  <div key={city.id} className="flex items-center gap-2 px-3 py-2 rounded-full border bg-card hover:shadow-sm transition-all">
                    <MapPin className="w-4 h-4 text-teal-500" />
                    <span className="font-medium">{city.name}</span>
                    <div className="w-px h-4 bg-border mx-1" />
                    {canEditSettings && (
                      <>
                        <button onClick={() => handleEditCity(city)} className="text-muted-foreground hover:text-blue-500">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDeleteCity(city.id)} className="text-muted-foreground hover:text-red-500">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other Tabs */}
        <TabsContent value="license" className="animate-in slide-in-from-bottom-4 duration-500">
          <LicenseSettings />
        </TabsContent>
        <TabsContent value="backup" className="animate-in slide-in-from-bottom-4 duration-500">
          <BackupSettings />
        </TabsContent>
        <TabsContent value="users" className="animate-in slide-in-from-bottom-4 duration-500">
          <UserManagementTab />
        </TabsContent>

      </Tabs>

      {/* Dialogs */}
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? (language === 'ar' ? 'تعديل الخدمة' : 'Edit Service') : (language === 'ar' ? 'إضافة خدمة' : 'Add Service')}
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

      <Dialog open={cityDialogOpen} onOpenChange={setCityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCity ? (language === 'ar' ? 'تعديل المدينة' : 'Edit City') : (language === 'ar' ? 'إضافة مدينة' : 'Add City')}
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

      <Dialog open={doctorDialogOpen} onOpenChange={setDoctorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDoctor ? (language === 'ar' ? 'تعديل الطبيب' : 'Edit Doctor') : (language === 'ar' ? 'إضافة طبيب' : 'Add Doctor')}
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
                <SelectContent className="z-50">
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
                  <SelectContent className="z-50">
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
