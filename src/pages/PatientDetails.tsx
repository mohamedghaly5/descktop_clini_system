import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User, Phone, MapPin, Calendar, FileText,
  Edit, Trash2, ArrowLeft, Upload, Image, X,
  CheckCircle, Clock, DollarSign, Briefcase, MessageCircle, Plus
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';
import {
  Patient,
  PatientAttachment,
  getPatientById,
  updatePatient,
  softDeletePatient,
  getPatientStats,
  getAttachmentsByPatientId,
  createAttachment,
  deleteAttachment,
} from '@/services/patientService';
import { createTreatmentCase, deleteTreatmentCase } from '@/services/appointmentService';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/utils/format';

// Helper to get patient name
const getPatientName = (patient: Patient) => {
  return patient.name || 'Unknown';
};

const PatientDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language, isRTL, t } = useLanguage();
  const { cities } = useSettings();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getPatientStats>> | null>(null);
  const [attachments, setAttachments] = useState<PatientAttachment[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newPlanDialogOpen, setNewPlanDialogOpen] = useState(false);
  const [newPlanData, setNewPlanData] = useState({ name: '', cost: '' });
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Collapsible states
  const [appointmentsOpen, setAppointmentsOpen] = useState(true);
  const [invoicesOpen, setInvoicesOpen] = useState(true);
  const [casesOpen, setCasesOpen] = useState(true);
  const [attachmentsOpen, setAttachmentsOpen] = useState(true);

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<Patient>>({});

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    fileUrl: '',
    fileName: '',
    fileType: 'xray' as 'xray' | 'image' | 'document' | 'other',
    notes: '',
  });

  const loadData = async () => {
    if (!id) return;
    try {
      const patientData = await getPatientById(id);
      if (patientData && !patientData.deleted) {
        setPatient(patientData);
        setEditForm(patientData);

        // Load stats and attachments in parallel
        const [statsData, attachmentsData] = await Promise.all([
          getPatientStats(id),
          getAttachmentsByPatientId(id)
        ]);

        setStats(statsData);
        setAttachments(attachmentsData);
      } else {
        navigate('/patients');
      }
    } catch (error) {
      console.error("Failed to load patient data", error);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleEdit = async () => {
    if (!patient || !id) return;

    const result = await updatePatient(id, editForm);
    if (result) {
      setPatient(result);
      setEditDialogOpen(false);
      toast({
        title: language === 'ar' ? 'تم التحديث' : 'Updated',
        description: language === 'ar' ? 'تم تحديث بيانات المريض بنجاح' : 'Patient data updated successfully',
      });
    } else {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'رقم الهاتف مستخدم بالفعل' : 'Phone number already exists',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    if (await softDeletePatient(id)) {
      toast({
        title: language === 'ar' ? 'تم الحذف' : 'Deleted',
        description: language === 'ar' ? 'تم حذف المريض بنجاح' : 'Patient deleted successfully',
      });
      navigate('/patients');
    }
  };

  const handleCreatePlan = async () => {
    if (!newPlanData.name || !newPlanData.cost) {
      toast({
        title: language === 'ar' ? 'بيانات ناقصة' : 'Missing Data',
        description: language === 'ar' ? 'يرجى إدخال اسم الخطة والتكلفة' : 'Please enter plan name and cost',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmittingPlan(true);
    try {
      await createTreatmentCase({
        patientId: id!,
        patientName: patient?.name || '',
        patientNameAr: patient?.name || '',
        name: newPlanData.name,
        nameAr: newPlanData.name,
        totalCost: parseFloat(newPlanData.cost),
        totalPaid: 0,
        balance: parseFloat(newPlanData.cost),
        status: 'active'
      });

      toast({
        title: language === 'ar' ? 'تم إنشاء الخطة' : 'Plan Created',
        description: language === 'ar' ? 'تم إضافة خطة العلاج بنجاح' : 'Treatment plan added successfully',
      });
      setNewPlanDialogOpen(false);
      setNewPlanData({ name: '', cost: '' });
      loadData();
    } catch (error) {
      console.error(error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل إنشاء الخطة' : 'Failed to create plan',
        variant: 'destructive'
      });
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذه الخطة؟' : 'Are you sure you want to delete this plan?')) return;

    try {
      await deleteTreatmentCase(planId);
      toast({
        title: language === 'ar' ? 'تم الحذف' : 'Deleted',
        description: language === 'ar' ? 'تم حذف خطة العلاج' : 'Treatment plan deleted',
      });
      loadData();
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل حذف الخطة' : 'Failed to delete plan',
        variant: 'destructive'
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64 for localStorage storage
    const reader = new FileReader();
    reader.onload = () => {
      setUploadForm(prev => ({
        ...prev,
        fileUrl: reader.result as string,
        fileName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async () => {
    if (!id || !uploadForm.fileUrl) return;

    await createAttachment({
      patientId: id,
      fileName: uploadForm.fileName,
      fileUrl: uploadForm.fileUrl,
      fileType: uploadForm.fileType,
      notes: uploadForm.notes,
      uploadDate: new Date().toISOString(),
    });

    setAttachments(await getAttachmentsByPatientId(id));
    setUploadDialogOpen(false);
    setUploadForm({ fileUrl: '', fileName: '', fileType: 'xray', notes: '' });

    toast({
      title: language === 'ar' ? 'تم الرفع' : 'Uploaded',
      description: language === 'ar' ? 'تم رفع المرفق بنجاح' : 'Attachment uploaded successfully',
    });
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    await deleteAttachment(attachmentId);
    setAttachments(await getAttachmentsByPatientId(id!));
    toast({
      title: language === 'ar' ? 'تم الحذف' : 'Deleted',
      description: language === 'ar' ? 'تم حذف المرفق' : 'Attachment deleted',
    });
  };

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

  // Handle WhatsApp chat
  const handleWhatsAppChat = () => {
    if (!patient?.phone) return;

    const phone = formatPhoneForWhatsApp(patient.phone);
    const patientName = getPatientName(patient);

    // Pre-filled message
    const message = language === 'ar'
      ? `مرحباً ${patientName}، نتواصل معك من العيادة...`
      : `Hello ${patientName}, we are contacting you from the clinic...`;

    // Encode and open WhatsApp
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phone.replace('+', '')}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
  };

  if (!patient || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
      </div>
    );
  }

  // Get city name from cityId
  const getCityName = (cityId: string) => {
    const city = cities.find(c => c.id === cityId);
    return city?.name || cityId;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={cn("flex flex-col sm:flex-row justify-between gap-4", isRTL && "sm:flex-row-reverse")}>
        <div className={cn("flex items-center gap-4", isRTL && "flex-row-reverse")}>
          <Button variant="ghost" size="icon" onClick={() => navigate('/patients')}>
            <ArrowLeft className={cn("w-5 h-5", isRTL && "rotate-180")} />
          </Button>
          <div className={cn(isRTL && "text-right")}>
            <h1 className="text-2xl font-bold text-foreground">
              {getPatientName(patient)}
            </h1>
            <p className="text-muted-foreground">{patient.phone}</p>
          </div>
        </div>
        <div className={cn("flex gap-2 flex-wrap", isRTL && "flex-row-reverse")}>
          {/* WhatsApp Button - only show if patient has phone */}
          {patient.phone && (
            <Button
              onClick={handleWhatsAppChat}
              className="bg-[#25D366] hover:bg-[#20BD5A] text-white"
            >
              <MessageCircle className="w-4 h-4" />
              {language === 'ar' ? 'مراسلة واتساب' : 'WhatsApp Chat'}
            </Button>
          )}
          <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
            <Edit className="w-4 h-4" />
            {language === 'ar' ? 'تعديل' : 'Edit'}
          </Button>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="w-4 h-4" />
            {language === 'ar' ? 'حذف' : 'Delete'}
          </Button>
        </div>
      </div>

      {/* Patient Info Card */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <User className="w-5 h-5 text-primary" />
            {language === 'ar' ? 'معلومات المريض' : 'Patient Information'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={cn("space-y-1", isRTL && "text-right")}>
              <p className="text-sm text-muted-foreground">{language === 'ar' ? 'الهاتف' : 'Phone'}</p>
              <p className="font-medium flex items-center gap-2" dir="ltr">
                <Phone className="w-4 h-4 text-muted-foreground" />
                {patient.phone}
              </p>
            </div>
            <div className={cn("space-y-1", isRTL && "text-right")}>
              <p className="text-sm text-muted-foreground">{language === 'ar' ? 'الجنس' : 'Gender'}</p>
              <p className="font-medium">
                {patient.gender === 'male'
                  ? (language === 'ar' ? 'ذكر' : 'Male')
                  : (language === 'ar' ? 'أنثى' : 'Female')}
              </p>
            </div>
            {patient.age && (
              <div className={cn("space-y-1", isRTL && "text-right")}>
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'العمر' : 'Age'}</p>
                <p className="font-medium">{patient.age}</p>
              </div>
            )}
            {patient.cityId && (
              <div className={cn("space-y-1", isRTL && "text-right")}>
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'المدينة' : 'City'}</p>
                <p className="font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {getCityName(patient.cityId)}
                </p>
              </div>
            )}
            {patient.notes && (
              <div className={cn("space-y-1 col-span-2", isRTL && "text-right")}>
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'ملاحظات' : 'Notes'}</p>
                <p className="font-medium">{patient.notes}</p>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div className="text-center p-3 rounded-lg bg-primary/10">
              <p className="text-2xl font-bold text-primary">{stats.totalAppointments}</p>
              <p className="text-sm text-muted-foreground">{language === 'ar' ? 'المواعيد' : 'Appointments'}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-success/10">
              <p className="text-2xl font-bold text-success">{stats.attendedAppointments}</p>
              <p className="text-sm text-muted-foreground">{language === 'ar' ? 'الحضور' : 'Attended'}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-accent/10">
              <p className="text-2xl font-bold text-accent">{stats.totalPaid} {language === 'ar' ? 'ر.س' : 'SAR'}</p>
              <p className="text-sm text-muted-foreground">{language === 'ar' ? 'المدفوع' : 'Paid'}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-warning/10">
              <p className="text-2xl font-bold text-warning">{stats.totalBalance} {language === 'ar' ? 'ر.س' : 'SAR'}</p>
              <p className="text-sm text-muted-foreground">{language === 'ar' ? 'المتبقي' : 'Balance'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appointments Section */}
      <Collapsible open={appointmentsOpen} onOpenChange={setAppointmentsOpen}>
        <Card variant="elevated">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-secondary/50 transition-colors">
              <CardTitle className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
                <span className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                  <Calendar className="w-5 h-5 text-primary" />
                  {language === 'ar' ? 'المواعيد' : 'Appointments'} ({stats.appointments.length})
                </span>
                <span className="text-muted-foreground">{appointmentsOpen ? '−' : '+'}</span>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {stats.appointments.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {language === 'ar' ? 'لا توجد مواعيد' : 'No appointments'}
                </p>
              ) : (
                <div className="space-y-2">
                  {stats.appointments.map((apt: any) => (
                    <div
                      key={apt.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        isRTL && "flex-row-reverse"
                      )}
                    >
                      <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                        <Badge variant={
                          apt.status === 'attended' ? 'default' :
                            apt.status === 'confirmed' ? 'secondary' : 'outline'
                        }>
                          {apt.status === 'attended' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {apt.status === 'booked' && <Clock className="w-3 h-3 mr-1" />}
                          {language === 'ar'
                            ? (apt.status === 'attended' ? 'حضر' : apt.status === 'confirmed' ? 'مؤكد' : 'محجوز')
                            : apt.status}
                        </Badge>
                        <span className="font-medium">{language === 'ar' ? apt.serviceAr : apt.service}</span>
                      </div>
                      <div className={cn("text-sm text-muted-foreground", isRTL && "text-right")}>
                        {apt.date} - {apt.time}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Invoices Section */}
      <Collapsible open={invoicesOpen} onOpenChange={setInvoicesOpen}>
        <Card variant="elevated">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-secondary/50 transition-colors">
              <CardTitle className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
                <span className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                  <DollarSign className="w-5 h-5 text-accent" />
                  {language === 'ar' ? 'الفواتير' : 'Invoices'} ({stats.invoices.length})
                </span>
                <span className="text-muted-foreground">{invoicesOpen ? '−' : '+'}</span>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {stats.invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {language === 'ar' ? 'لا توجد فواتير' : 'No invoices'}
                </p>
              ) : (
                <div className="space-y-2">
                  {stats.invoices.map((inv: any) => (
                    <div
                      key={inv.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        isRTL && "flex-row-reverse"
                      )}
                    >
                      <div className={cn(isRTL && "text-right")}>
                        <p className="font-medium">{language === 'ar' ? inv.serviceNameAr : inv.serviceName}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(inv.date, language)}
                        </p>
                      </div>
                      <div className={cn("text-right", isRTL && "text-left")}>
                        <p className="font-medium text-success">
                          {inv.amountPaid} {language === 'ar' ? 'ر.س' : 'SAR'}
                        </p>
                        {inv.balance > 0 && (
                          <p className="text-sm text-warning">
                            {language === 'ar' ? 'متبقي:' : 'Balance:'} {inv.balance}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Treatment Cases Section */}
      <Collapsible open={casesOpen} onOpenChange={setCasesOpen}>
        <Card variant="elevated">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-secondary/50 transition-colors">
              <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
                <CollapsibleTrigger asChild>
                  <CardTitle className={cn("flex items-center gap-2 flex-1", isRTL && "flex-row-reverse")}>
                    <Briefcase className="w-5 h-5 text-primary" />
                    {language === 'ar' ? 'خطط العلاج' : 'Treatment Cases'} ({stats.treatmentCases.length})
                    <span className="text-muted-foreground mr-2 text-sm font-normal">{casesOpen ? '−' : '+'}</span>
                  </CardTitle>
                </CollapsibleTrigger>
                <div onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1"
                    onClick={() => setNewPlanDialogOpen(true)}
                  >
                    <Plus className="w-3 h-3" />
                    {language === 'ar' ? 'خطة جديدة' : 'New Plan'}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {stats.treatmentCases.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {language === 'ar' ? 'لا توجد خطط علاج' : 'No treatment cases'}
                </p>
              ) : (
                <div className="space-y-2">
                  {stats.treatmentCases.map((tc: any) => (
                    <div
                      key={tc.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        isRTL && "flex-row-reverse"
                      )}
                    >
                      <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                        <Badge variant={tc.status === 'active' ? 'default' : 'secondary'}>
                          {tc.status === 'active'
                            ? (language === 'ar' ? 'نشط' : 'Active')
                            : (language === 'ar' ? 'مغلق' : 'Closed')}
                        </Badge>
                        <span className="font-medium">{language === 'ar' ? tc.nameAr : tc.name}</span>
                      </div>
                      <div className={cn("text-right", isRTL && "text-left")}>
                        <p className="text-sm">
                          {language === 'ar' ? 'التكلفة:' : 'Cost:'} {tc.totalCost} {language === 'ar' ? 'ر.س' : 'SAR'}
                        </p>
                        <p className="text-sm text-success">
                          {language === 'ar' ? 'مدفوع:' : 'Paid:'} {tc.totalPaid}
                        </p>
                        {tc.balance > 0 && (
                          <p className="text-sm text-warning">
                            {language === 'ar' ? 'متبقي:' : 'Balance:'} {tc.balance}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeletePlan(tc.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Attachments Section */}
      <Collapsible open={attachmentsOpen} onOpenChange={setAttachmentsOpen}>
        <Card variant="elevated">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-secondary/50 transition-colors">
              <CardTitle className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
                <span className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                  <Image className="w-5 h-5 text-accent" />
                  {language === 'ar' ? 'المرفقات والأشعة' : 'Attachments & X-rays'} ({attachments.length})
                </span>
                <span className="text-muted-foreground">{attachmentsOpen ? '−' : '+'}</span>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => setUploadDialogOpen(true)}
                className="mb-4"
              >
                <Upload className="w-4 h-4" />
                {language === 'ar' ? 'رفع صورة / أشعة' : 'Upload Image / X-ray'}
              </Button>

              {attachments.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {language === 'ar' ? 'لا توجد مرفقات' : 'No attachments'}
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="relative group rounded-lg overflow-hidden border cursor-pointer"
                      onClick={() => {
                        setSelectedImage(attachment.fileUrl);
                        setImageViewerOpen(true);
                      }}
                    >
                      <img
                        src={attachment.fileUrl}
                        alt={attachment.fileName}
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAttachment(attachment.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="p-2 bg-background">
                        <p className="text-xs truncate">{attachment.fileName}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {attachment.fileType}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">تعديل بيانات المريض</DialogTitle>
            <DialogDescription className="text-right">
              قم بتحديث بيانات المريض
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-right block">اسم المريض</Label>
              <Input
                value={editForm.name || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                className="text-right"
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-right block">رقم الهاتف</Label>
              <Input
                value={editForm.phone || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                className="text-right"
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-right block">الجنس</Label>
              <Select
                value={editForm.gender}
                onValueChange={(value) => setEditForm(prev => ({ ...prev, gender: value as 'male' | 'female' }))}
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
            <div className="space-y-2">
              <Label className="text-right block">العمر</Label>
              <Input
                type="number"
                value={editForm.age || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, age: parseInt(e.target.value) || undefined }))}
                className="text-right"
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-right block">المدينة</Label>
              <Select
                value={editForm.cityId}
                onValueChange={(value) => setEditForm(prev => ({ ...prev, cityId: value }))}
              >
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue placeholder="اختر المدينة" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {cities.map(city => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-right block">ملاحظات</Label>
              <Textarea
                value={editForm.notes || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                className="text-right"
                dir="rtl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="gradient" onClick={handleEdit}>
              {language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === 'ar' ? 'حذف المريض' : 'Delete Patient'}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar'
                ? 'هل أنت متأكد من حذف هذا المريض؟ سيتم إخفاؤه من القائمة ولكن ستظل سجلاته محفوظة.'
                : 'Are you sure you want to delete this patient? They will be hidden from the list but their records will be preserved.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {language === 'ar' ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'رفع مرفق' : 'Upload Attachment'}</DialogTitle>
            <DialogDescription>
              {language === 'ar' ? 'قم برفع صورة أو أشعة للمريض' : 'Upload an image or X-ray for this patient'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'اختر ملف' : 'Select File'}</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
              />
            </div>
            {uploadForm.fileUrl && (
              <div className="rounded-lg overflow-hidden border">
                <img src={uploadForm.fileUrl} alt="Preview" className="w-full h-32 object-cover" />
              </div>
            )}
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'نوع المرفق' : 'Attachment Type'}</Label>
              <Select
                value={uploadForm.fileType}
                onValueChange={(value) => setUploadForm(prev => ({ ...prev, fileType: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xray">{language === 'ar' ? 'أشعة' : 'X-ray'}</SelectItem>
                  <SelectItem value="image">{language === 'ar' ? 'صورة' : 'Image'}</SelectItem>
                  <SelectItem value="document">{language === 'ar' ? 'مستند' : 'Document'}</SelectItem>
                  <SelectItem value="other">{language === 'ar' ? 'أخرى' : 'Other'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'ملاحظات' : 'Notes'}</Label>
              <Textarea
                value={uploadForm.notes}
                onChange={(e) => setUploadForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={language === 'ar' ? 'ملاحظات اختيارية...' : 'Optional notes...'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="gradient" onClick={handleUploadSubmit} disabled={!uploadForm.fileUrl}>
              {language === 'ar' ? 'رفع' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog open={imageViewerOpen} onOpenChange={setImageViewerOpen}>
        <DialogContent className="sm:max-w-[90vw] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'عرض الصورة' : 'View Image'}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="flex items-center justify-center">
              <img src={selectedImage} alt="Full size" className="max-w-full max-h-[70vh] object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={newPlanDialogOpen} onOpenChange={setNewPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-start">
              {language === 'ar' ? 'خطة علاج جديدة' : 'New Treatment Plan'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-start block">{language === 'ar' ? 'اسم الخطة' : 'Plan Name'}</Label>
              <Input
                value={newPlanData.name}
                onChange={(e) => setNewPlanData({ ...newPlanData, name: e.target.value })}
                placeholder={language === 'ar' ? 'مثال: تقويم أسنان شامل' : 'e.g. Full Orthodontics'}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-start block">{language === 'ar' ? 'التكلفة الإجمالية' : 'Total Cost'}</Label>
              <Input
                type="number"
                value={newPlanData.cost}
                onChange={(e) => setNewPlanData({ ...newPlanData, cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPlanDialogOpen(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleCreatePlan} disabled={isSubmittingPlan}>
              {isSubmittingPlan
                ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...')
                : (language === 'ar' ? 'إنشاء الخطة' : 'Create Plan')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default PatientDetailsPage;
