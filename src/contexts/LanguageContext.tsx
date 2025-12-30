import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'ar';
type Direction = 'ltr' | 'rtl';

interface Translations {
  [key: string]: {
    en: string;
    ar: string;
  };
}

const translations: Translations = {
  // App
  appName: { en: 'DentaCare', ar: 'دينتا كير' },
  dashboard: { en: 'Dashboard', ar: 'لوحة التحكم' },
  patients: { en: 'Patients', ar: 'المرضى' },
  appointments: { en: 'Appointments', ar: 'المواعيد' },
  accounts: { en: 'Accounts', ar: 'الحسابات' },
  reports: { en: 'Reports', ar: 'التقارير' },
  settings: { en: 'Settings', ar: 'الإعدادات' },
  pricing: { en: 'Pricing', ar: 'التسعير' },
  
  // Dashboard
  welcomeBack: { en: 'Welcome Back', ar: 'مرحباً بعودتك' },
  clinicOverview: { en: 'Clinic Overview', ar: 'نظرة عامة على العيادة' },
  totalIncome: { en: 'Total Income', ar: 'إجمالي الدخل' },
  totalPatients: { en: 'Total Patients', ar: 'إجمالي المرضى' },
  totalVisits: { en: 'Total Visits', ar: 'إجمالي الزيارات' },
  todayAppointments: { en: "Today's Appointments", ar: 'مواعيد اليوم' },
  thisMonth: { en: 'This Month', ar: 'هذا الشهر' },
  lastMonth: { en: 'Last Month', ar: 'الشهر الماضي' },
  allTime: { en: 'All Time', ar: 'كل الوقت' },
  recentActivity: { en: 'Recent Activity', ar: 'النشاط الأخير' },
  topServices: { en: 'Top Services', ar: 'أفضل الخدمات' },
  patientsByCity: { en: 'Patients by City', ar: 'المرضى حسب المدينة' },
  dailyIncome: { en: 'Daily Income', ar: 'الدخل اليومي' },
  monthlyTrend: { en: 'Monthly Trend', ar: 'الاتجاه الشهري' },
  quickActions: { en: 'Quick Actions', ar: 'إجراءات سريعة' },
  newPatient: { en: 'New Patient', ar: 'مريض جديد' },
  newAppointment: { en: 'New Appointment', ar: 'موعد جديد' },
  viewReports: { en: 'View Reports', ar: 'عرض التقارير' },
  
  // Patient Form
  patientRegistration: { en: 'Patient Registration', ar: 'تسجيل مريض' },
  firstName: { en: 'First Name', ar: 'الاسم الأول' },
  lastName: { en: 'Last Name', ar: 'اسم العائلة' },
  fullName: { en: 'Full Name', ar: 'الاسم الكامل' },
  phoneNumber: { en: 'Phone Number', ar: 'رقم الهاتف' },
  email: { en: 'Email', ar: 'البريد الإلكتروني' },
  dateOfBirth: { en: 'Date of Birth', ar: 'تاريخ الميلاد' },
  gender: { en: 'Gender', ar: 'الجنس' },
  male: { en: 'Male', ar: 'ذكر' },
  female: { en: 'Female', ar: 'أنثى' },
  city: { en: 'City', ar: 'المدينة' },
  address: { en: 'Address', ar: 'العنوان' },
  notes: { en: 'Notes', ar: 'ملاحظات' },
  medicalHistory: { en: 'Medical History', ar: 'التاريخ الطبي' },
  allergies: { en: 'Allergies', ar: 'الحساسية' },
  
  // Visit/Payment
  visitDetails: { en: 'Visit Details', ar: 'تفاصيل الزيارة' },
  service: { en: 'Service', ar: 'الخدمة' },
  serviceType: { en: 'Service Type', ar: 'نوع الخدمة' },
  amountPaid: { en: 'Amount Paid', ar: 'المبلغ المدفوع' },
  paymentMethod: { en: 'Payment Method', ar: 'طريقة الدفع' },
  cash: { en: 'Cash', ar: 'نقداً' },
  card: { en: 'Card', ar: 'بطاقة' },
  insurance: { en: 'Insurance', ar: 'تأمين' },
  visitDate: { en: 'Visit Date', ar: 'تاريخ الزيارة' },
  visitNotes: { en: 'Visit Notes', ar: 'ملاحظات الزيارة' },
  
  // Actions
  save: { en: 'Save', ar: 'حفظ' },
  cancel: { en: 'Cancel', ar: 'إلغاء' },
  edit: { en: 'Edit', ar: 'تعديل' },
  delete: { en: 'Delete', ar: 'حذف' },
  search: { en: 'Search', ar: 'بحث' },
  filter: { en: 'Filter', ar: 'تصفية' },
  export: { en: 'Export', ar: 'تصدير' },
  submit: { en: 'Submit', ar: 'إرسال' },
  clear: { en: 'Clear', ar: 'مسح' },
  add: { en: 'Add', ar: 'إضافة' },
  close: { en: 'Close', ar: 'إغلاق' },
  
  // Messages
  success: { en: 'Success', ar: 'نجاح' },
  error: { en: 'Error', ar: 'خطأ' },
  patientSaved: { en: 'Patient saved successfully', ar: 'تم حفظ المريض بنجاح' },
  requiredField: { en: 'This field is required', ar: 'هذا الحقل مطلوب' },
  invalidPhone: { en: 'Invalid phone number', ar: 'رقم هاتف غير صالح' },
  noResults: { en: 'No results found', ar: 'لم يتم العثور على نتائج' },
  
  // Services
  cleaning: { en: 'Cleaning', ar: 'تنظيف' },
  filling: { en: 'Filling', ar: 'حشو' },
  extraction: { en: 'Extraction', ar: 'خلع' },
  rootCanal: { en: 'Root Canal', ar: 'علاج جذور' },
  crown: { en: 'Crown', ar: 'تاج' },
  whitening: { en: 'Whitening', ar: 'تبييض' },
  checkup: { en: 'Checkup', ar: 'فحص' },
  xray: { en: 'X-Ray', ar: 'أشعة' },
  implant: { en: 'Implant', ar: 'زراعة' },
  braces: { en: 'Braces', ar: 'تقويم' },
  
  // Time
  today: { en: 'Today', ar: 'اليوم' },
  yesterday: { en: 'Yesterday', ar: 'أمس' },
  thisWeek: { en: 'This Week', ar: 'هذا الأسبوع' },
  currency: { en: 'SAR', ar: 'ر.س' },
  
  // Stats
  vsLastMonth: { en: 'vs last month', ar: 'مقارنة بالشهر الماضي' },
  increase: { en: 'increase', ar: 'زيادة' },
  decrease: { en: 'decrease', ar: 'نقصان' },
  
  // Navigation
  home: { en: 'Home', ar: 'الرئيسية' },
  language: { en: 'Language', ar: 'اللغة' },
  english: { en: 'English', ar: 'الإنجليزية' },
  arabic: { en: 'Arabic', ar: 'العربية' },
  logout: { en: 'Logout', ar: 'تسجيل الخروج' },
  collapse: { en: 'Collapse', ar: 'طي' },
  profile: { en: 'Profile', ar: 'الملف الشخصي' },
  
  // Appointment Status
  booked: { en: 'Booked', ar: 'محجوز' },
  confirmed: { en: 'Confirmed', ar: 'مؤكد' },
  attended: { en: 'Attended', ar: 'حضر' },
  cancelled: { en: 'Cancelled', ar: 'ملغي' },
  
  // Treatment & Invoice
  treatmentCase: { en: 'Treatment Case', ar: 'خطة العلاج' },
  invoice: { en: 'Invoice', ar: 'فاتورة' },
  cost: { en: 'Cost', ar: 'التكلفة' },
  balance: { en: 'Balance', ar: 'الرصيد' },
  createNew: { en: 'Create New', ar: 'إنشاء جديد' },

  // Settings
  general: { en: 'General', ar: 'عام' },
  clinic: { en: 'Clinic', ar: 'العيادة' },
  doctors: { en: 'Doctors', ar: 'الأطباء' },
  services: { en: 'Services', ar: 'الخدمات' },
  lists: { en: 'Lists', ar: 'القوائم' },
  manageSettings: { en: 'Manage application settings', ar: 'إدارة إعدادات التطبيق' },
  chooseLanguage: { en: 'Choose your preferred display language', ar: 'اختر لغة العرض المفضلة' },
  currencyLabel: { en: 'Currency', ar: 'العملة' },
  selectCurrency: { en: 'Select the currency used in the clinic', ar: 'اختر العملة المستخدمة في العيادة' },
  clinicInfo: { en: 'Clinic Information', ar: 'معلومات العيادة' },
  clinicInfoDesc: { en: 'This information appears on invoices and reports', ar: 'تظهر هذه المعلومات في الفواتير والتقارير' },
  clinicName: { en: 'Clinic Name', ar: 'اسم العيادة' },
  ownerName: { en: 'Owner / Doctor Name', ar: 'اسم صاحب العيادة / الطبيب' },
  phone: { en: 'Phone Number', ar: 'رقم الهاتف' },
  whatsapp: { en: 'WhatsApp Number', ar: 'رقم الواتساب' },
  whatsappDesc: { en: 'Used for sending reports via WhatsApp', ar: 'يستخدم لإرسال التقارير عبر واتساب' },
  clinicLogo: { en: 'Clinic Logo (Image URL)', ar: 'شعار العيادة (رابط الصورة)' },
  doctorsStaff: { en: 'Doctors & Staff', ar: 'الأطباء والطاقم الطبي' },
  doctorsStaffDesc: { en: 'Manage clinic doctors and medical staff', ar: 'إدارة أطباء العيادة والطاقم الطبي' },
  doctor: { en: 'Doctor', ar: 'طبيب' },
  assistant: { en: 'Assistant', ar: 'مساعد' },
  hygienist: { en: 'Hygienist', ar: 'أخصائي تنظيف' },
  commission: { en: 'Commission', ar: 'العمولة' },
  percentage: { en: 'Percentage', ar: 'نسبة مئوية' },
  fixed: { en: 'Fixed Amount', ar: 'مبلغ ثابت' },
  active: { en: 'Active', ar: 'نشط' },
  inactive: { en: 'Inactive', ar: 'غير نشط' },
  cities: { en: 'Cities', ar: 'المدن' },
  citiesDesc: { en: 'Manage the cities for patient addresses', ar: 'إدارة المدن لعناوين المرضى' },
  servicesManage: { en: 'Manage Services', ar: 'إدارة الخدمات' },
  servicesManageDesc: { en: 'Add and manage clinic services', ar: 'إضافة وإدارة خدمات العيادة' },
  defaultPrice: { en: 'Default Price', ar: 'السعر الافتراضي' },
  name: { en: 'Name', ar: 'الاسم' },
  role: { en: 'Role', ar: 'الدور' },
};

interface LanguageContextType {
  language: Language;
  direction: Direction;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'ar'; // Default to Arabic
  });

  const direction: Direction = language === 'ar' ? 'rtl' : 'ltr';
  const isRTL = language === 'ar';

  useEffect(() => {
    localStorage.setItem('language', language);
    // Update document direction and language dynamically
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
  }, [language, direction]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    const translation = translations[key];
    if (!translation) {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }
    return translation[language];
  };

  return (
    <LanguageContext.Provider value={{ language, direction, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
