import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Download, Phone, User, RefreshCw, Upload } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import ImportPatientsDialog from '@/components/patients/ImportPatientsDialog';

// interface Patient defined in service
import {
  getPatients,
  createPatient as createPatientService,
  Patient
} from '@/services/patientService'; // Use service types

const PatientsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, isRTL, language } = useLanguage();
  const { cities } = useSettings();
  const { clinicId } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // New patient form state
  const [newPatient, setNewPatient] = useState({
    name: '',
    phone: '',
    age: '',
    gender: 'male' as 'male' | 'female',
    cityId: '',
    notes: '',
  });

  const loadPatients = async () => {
    // ClinicId filtering handled in service or ignored for local MVP
    // if (!clinicId) return; // Local SQLite usually single tenant or filtered internally

    setIsLoading(true);
    try {
      const data = await getPatients();
      // Transform service Patient to Page Patient interface if needed?
      // Service returns: id, name, phone, gender, age, cityId, notes...
      // Page expects: id, full_name, phone, age, gender, city_id...
      // Let's map it.
      const mapped: any[] = data.map(p => ({
        id: p.id,
        full_name: p.name,
        phone: p.phone,
        age: p.age,
        gender: p.gender,
        city_id: p.cityId,
        notes: p.notes,
        clinic_id: 'default'
      }));
      setPatients(mapped);
    } catch (error) {
      console.error('Error loading patients:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في تحميل المرضى' : 'Failed to load patients',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadPatients();
  }, [clinicId]);

  // Helper to get patient name
  const getPatientName = (patient: Patient) => {
    return patient.full_name || 'Unknown';
  };

  const filteredPatients = patients.filter(patient => {
    const query = searchQuery.toLowerCase();
    const name = getPatientName(patient);
    return name.toLowerCase().includes(query) || patient.phone.includes(query);
  });

  const exportToVCF = () => {
    const vcfContent = filteredPatients.map(p =>
      `BEGIN:VCARD\nVERSION:3.0\nFN:${getPatientName(p)}\nTEL:${p.phone}\nEND:VCARD`
    ).join('\n');

    const blob = new Blob([vcfContent], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patients.vcf';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setNewPatient({
      name: '',
      phone: '',
      age: '',
      gender: 'male',
      cityId: '',
      notes: '',
    });
  };

  const handleCreatePatient = async () => {
    // Validation
    if (!newPatient.name.trim() || !newPatient.phone.trim()) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'اسم المريض ورقم الهاتف مطلوبين' : 'Patient name and phone are required',
        variant: 'destructive',
      });
      return;
    }

    // if (!clinicId) ... // Local ignore

    setIsSubmitting(true);

    try {
      const result = await createPatientService({
        name: newPatient.name.trim(),
        phone: newPatient.phone.replace(/[\s\-]/g, ''),
        age: newPatient.age ? parseInt(newPatient.age) : undefined,
        gender: newPatient.gender as any,
        cityId: newPatient.cityId || undefined,
        notes: newPatient.notes,
        clinicId: clinicId || undefined
      });

      setIsSubmitting(false);

      if (!result.success) {
        if (result.code === 'DUPLICATE_PHONE') {
          toast({
            title: language === 'ar' ? 'خطأ' : 'Error',
            description: language === 'ar' ? 'يوجد مريض مسجل بهذا الرقم بالفعل' : 'Patient with this phone number already exists',
            variant: 'destructive',
          });
          return;
        }
        throw new Error(result.error || 'Creation failed');
      }

      toast({
        title: language === 'ar' ? 'تم الحفظ' : 'Saved',
        description: language === 'ar' ? 'تم إضافة المريض بنجاح' : 'Patient added successfully',
      });
      setCreateDialogOpen(false);
      resetForm();
      loadPatients();

    } catch (error) {
      console.error('Error creating patient:', error);
      setIsSubmitting(false);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في إضافة المريض' : 'Failed to add patient',
        variant: 'destructive',
      });
    }
  };

  const handlePatientClick = (patientId: string) => {
    navigate(`/patients/${patientId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="text-start">
          <h1 className="text-2xl font-bold text-foreground">{t('patients')}</h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? `${filteredPatients.length} مريض مسجل` : `${filteredPatients.length} registered patients`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={loadPatients} title={language === 'ar' ? 'تحديث' : 'Refresh'}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={exportToVCF}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'تصدير VCF' : 'Export VCF'}</span>
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'ar' ? 'استيراد من إكسيل' : 'Import from Excel'}</span>
          </Button>
          <Button variant="gradient" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            {t('newPatient')}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={language === 'ar' ? 'البحث بالاسم أو رقم الهاتف...' : 'Search by name or phone...'}
          className="bg-card ps-10"
        />
      </div>

      {/* Patients List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPatients.map((patient, index) => (
          <Card
            key={patient.id}
            variant="elevated"
            className={cn(
              "animate-fade-in opacity-0 cursor-pointer hover:shadow-lg transition-all hover:border-primary/50",
            )}
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => handlePatientClick(patient.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0 text-start">
                  <h3 className="font-semibold text-foreground truncate">
                    {getPatientName(patient)}
                  </h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Phone className="w-3 h-3" />
                    <span dir="ltr">{patient.phone}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    {patient.age && <span>{patient.age} {language === 'ar' ? 'سنة' : 'years'}</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPatients.length === 0 && (
        <Card variant="ghost" className="py-12">
          <CardContent className="text-center">
            <User className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">{t('noResults')}</p>
          </CardContent>
        </Card>
      )}

      {/* Create Patient Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">إضافة مريض جديد</DialogTitle>
            <DialogDescription className="text-right">
              أدخل بيانات المريض الجديد
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Patient Name */}
            <div className="space-y-2">
              <Label className="text-right block">اسم المريض *</Label>
              <Input
                value={newPatient.name}
                onChange={(e) => setNewPatient(prev => ({ ...prev, name: e.target.value }))}
                placeholder="أدخل اسم المريض"
                className="text-right"
                dir="rtl"
              />
            </div>

            {/* Phone (Required) */}
            <div className="space-y-2">
              <Label className="text-right block">رقم الهاتف *</Label>
              <Input
                value={newPatient.phone}
                onChange={(e) => setNewPatient(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="أدخل رقم الهاتف"
                className="text-right"
                dir="rtl"
              />
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label className="text-right block">الجنس</Label>
              <Select
                value={newPatient.gender}
                onValueChange={(value) => setNewPatient(prev => ({ ...prev, gender: value as 'male' | 'female' }))}
              >
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="male">ذكر</SelectItem>
                  <SelectItem value="female">أنثى</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Age */}
            <div className="space-y-2">
              <Label className="text-right block">العمر</Label>
              <Input
                type="number"
                value={newPatient.age}
                onChange={(e) => setNewPatient(prev => ({ ...prev, age: e.target.value }))}
                placeholder="أدخل العمر"
                className="text-right"
                dir="rtl"
              />
            </div>

            {/* City */}
            <div className="space-y-2">
              <Label className="text-right block">المدينة</Label>
              {cities.length === 0 ? (
                <p className="text-muted-foreground text-sm text-right">لا توجد مدن (اختياري)</p>
              ) : (
                <Select
                  value={newPatient.cityId}
                  onValueChange={(value) => setNewPatient(prev => ({ ...prev, cityId: value }))}
                >
                  <SelectTrigger className="text-right" dir="rtl">
                    <SelectValue placeholder="اختر المدينة (اختياري)" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {cities.map(city => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-right block">ملاحظات</Label>
              <Textarea
                value={newPatient.notes}
                onChange={(e) => setNewPatient(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="ملاحظات طبية أو عامة..."
                className="text-right"
                dir="rtl"
              />
            </div>
          </div>

          <DialogFooter className="flex-row-reverse justify-start gap-2">
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
              إلغاء
            </Button>
            <Button variant="gradient" onClick={handleCreatePatient} disabled={isSubmitting}>
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ المريض'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Patients Dialog */}
      <ImportPatientsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={loadPatients}
      />
    </div>
  );
};

export default PatientsPage;
