import React, { useState, useCallback } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ImportPatientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ParsedPatient {
  full_name: string;
  phone: string;
  age: number | null;
  gender: string | null;
  isValid: boolean;
  errors: string[];
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

const ImportPatientsDialog: React.FC<ImportPatientsDialogProps> = ({
  open,
  onOpenChange,
  onImportComplete,
}) => {
  const { language } = useLanguage();
  const { clinicId, user } = useAuth();
  const [step, setStep] = useState<ImportStep>('upload');
  const [parsedData, setParsedData] = useState<ParsedPatient[]>([]);
  const [importResult, setImportResult] = useState({ success: 0, failed: 0 });
  const [isImporting, setIsImporting] = useState(false);
  const [fileToImport, setFileToImport] = useState<File | null>(null);

  // Map Arabic headers to database columns
  const headerMapping: Record<string, string> = {
    'الاسم': 'full_name',
    'رقم الهاتف': 'phone',
    'السن': 'age',
    'النوع': 'gender',
    'name': 'full_name',
    'phone': 'phone',
    'age': 'age',
    'gender': 'gender',
  };

  // Map Arabic gender values
  const genderMapping: Record<string, string> = {
    'ذكر': 'male',
    'أنثى': 'female',
    'انثى': 'female',
    'male': 'male',
    'female': 'female',
  };

  // Sanitize phone number
  const sanitizePhone = (phone: string): string => {
    if (!phone) return '';
    return String(phone).replace(/[\s\-\(\)\.]/g, '').trim();
  };

  // Download template
  const downloadTemplate = () => {
    const templateData = [
      { 'الاسم': 'أحمد محمد', 'رقم الهاتف': '01012345678', 'السن': 30, 'النوع': 'ذكر' },
      { 'الاسم': 'سارة أحمد', 'رقم الهاتف': '01098765432', 'السن': 25, 'النوع': 'أنثى' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'المرضى');

    // Set RTL for the worksheet
    worksheet['!cols'] = [
      { wch: 25 }, // الاسم
      { wch: 15 }, // رقم الهاتف
      { wch: 10 }, // السن
      { wch: 10 }, // النوع
    ];

    XLSX.writeFile(workbook, 'patient_template.xlsx');
  };

  // Parse uploaded file
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileToImport(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

        if (jsonData.length === 0) {
          toast({
            title: language === 'ar' ? 'خطأ' : 'Error',
            description: language === 'ar' ? 'الملف فارغ' : 'File is empty',
            variant: 'destructive',
          });
          return;
        }

        // Parse and validate each row
        const parsed: ParsedPatient[] = jsonData.map((row, index) => {
          const errors: string[] = [];

          // Get values using header mapping
          let fullName = '';
          let phone = '';
          let age: number | null = null;
          let gender: string | null = null;

          Object.keys(row).forEach(key => {
            const normalizedKey = key.trim().toLowerCase();
            const mappedField = headerMapping[key] || headerMapping[normalizedKey];

            if (mappedField === 'full_name') {
              fullName = String(row[key] || '').trim();
            } else if (mappedField === 'phone') {
              phone = sanitizePhone(String(row[key] || ''));
            } else if (mappedField === 'age') {
              const ageVal = parseInt(String(row[key]));
              age = !isNaN(ageVal) && ageVal > 0 && ageVal < 150 ? ageVal : null;
            } else if (mappedField === 'gender') {
              const genderVal = String(row[key] || '').trim();
              gender = genderMapping[genderVal] || genderMapping[genderVal.toLowerCase()] || null;
            }
          });

          // Validation
          if (!fullName) {
            errors.push(language === 'ar' ? 'الاسم مطلوب' : 'Name is required');
          }
          if (!phone) {
            errors.push(language === 'ar' ? 'رقم الهاتف مطلوب' : 'Phone is required');
          }

          return {
            full_name: fullName,
            phone,
            age,
            gender,
            isValid: errors.length === 0,
            errors,
          };
        });

        setParsedData(parsed);
        setStep('preview');
      } catch (error) {
        console.error('Error parsing file:', error);
        toast({
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: language === 'ar' ? 'فشل في قراءة الملف' : 'Failed to read file',
          variant: 'destructive',
        });
      }
    };

    reader.readAsArrayBuffer(file);
    // Reset input
    event.target.value = '';
  }, [language]);

  // Import patients locally via IPC
  const handleImport = async () => {
    if (!fileToImport) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'لم يتم اختيار ملف' : 'No file selected',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    setStep('importing');

    try {
      // Read file as ArrayBuffer
      const buffer = await fileToImport.arrayBuffer();

      // Send to Main Process
      // @ts-ignore
      const result = await window.api.importPatients(buffer, user?.email);
      console.log('Import result:', result);

      if (result) {
        setImportResult({
          success: result.successCount || 0,
          failed: result.failedCount || 0
        });
      }

      setStep('complete');
    } catch (error) {
      console.error('Import process error:', error);
      toast({
        title: language === 'ar' ? 'فشل الاستيراد' : 'Import Failed',
        description: String(error),
        variant: 'destructive'
      });
      setStep('preview');
    } finally {
      setIsImporting(false);
    }
  };

  // Reset dialog
  const handleClose = () => {
    setStep('upload');
    setParsedData([]);
    setImportResult({ success: 0, failed: 0 });
    setFileToImport(null);
    onOpenChange(false);
    if (importResult.success > 0) {
      onImportComplete();
    }
  };

  const validCount = parsedData.filter(p => p.isValid).length;
  const invalidCount = parsedData.filter(p => !p.isValid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {language === 'ar' ? 'استيراد المرضى من ملف' : 'Import Patients from File'}
          </DialogTitle>
          <DialogDescription className="text-right">
            {step === 'upload' && (language === 'ar'
              ? 'قم بتحميل ملف Excel أو CSV يحتوي على بيانات المرضى'
              : 'Upload an Excel or CSV file containing patient data')}
            {step === 'preview' && (language === 'ar'
              ? 'راجع البيانات قبل الاستيراد'
              : 'Review the data before importing')}
            {step === 'importing' && (language === 'ar'
              ? 'جاري استيراد البيانات...'
              : 'Importing data...')}
            {step === 'complete' && (language === 'ar'
              ? 'تم الاستيراد'
              : 'Import complete')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Download Template */}
              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2 text-right">
                  {language === 'ar' ? 'الخطوة 1: تحميل القالب' : 'Step 1: Download Template'}
                </h4>
                <p className="text-sm text-muted-foreground mb-3 text-right">
                  {language === 'ar'
                    ? 'قم بتحميل قالب Excel واملأه ببيانات المرضى'
                    : 'Download the Excel template and fill it with patient data'}
                </p>
                <Button variant="outline" onClick={downloadTemplate} className="w-full">
                  <Download className="w-4 h-4" />
                  {language === 'ar' ? 'تحميل القالب' : 'Download Template'}
                </Button>
              </div>

              {/* Upload File */}
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2 text-right">
                  {language === 'ar' ? 'الخطوة 2: رفع الملف' : 'Step 2: Upload File'}
                </h4>
                <p className="text-sm text-muted-foreground mb-3 text-right">
                  {language === 'ar'
                    ? 'الأعمدة المطلوبة: الاسم، رقم الهاتف. الأعمدة الاختيارية: السن، النوع (ذكر/أنثى)'
                    : 'Required columns: Name, Phone. Optional: Age, Gender (male/female)'}
                </p>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'اضغط لرفع ملف Excel أو CSV' : 'Click to upload Excel or CSV file'}
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex gap-2 flex-wrap">
                <Badge variant="default" className="bg-primary">
                  {language === 'ar' ? `إجمالي: ${parsedData.length}` : `Total: ${parsedData.length}`}
                </Badge>
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="w-3 h-3 ml-1" />
                  {language === 'ar' ? `صالح: ${validCount}` : `Valid: ${validCount}`}
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive">
                    <AlertCircle className="w-3 h-3 ml-1" />
                    {language === 'ar' ? `غير صالح: ${invalidCount}` : `Invalid: ${invalidCount}`}
                  </Badge>
                )}
              </div>

              {/* Preview Table */}
              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">#</TableHead>
                      <TableHead className="text-right">{language === 'ar' ? 'الاسم' : 'Name'}</TableHead>
                      <TableHead className="text-right">{language === 'ar' ? 'الهاتف' : 'Phone'}</TableHead>
                      <TableHead className="text-right">{language === 'ar' ? 'السن' : 'Age'}</TableHead>
                      <TableHead className="text-right">{language === 'ar' ? 'النوع' : 'Gender'}</TableHead>
                      <TableHead className="text-right">{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((patient, index) => (
                      <TableRow key={index} className={!patient.isValid ? 'bg-destructive/10' : ''}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{patient.full_name || '-'}</TableCell>
                        <TableCell dir="ltr" className="text-right">{patient.phone || '-'}</TableCell>
                        <TableCell>{patient.age || '-'}</TableCell>
                        <TableCell>
                          {patient.gender === 'male' ? (language === 'ar' ? 'ذكر' : 'Male') :
                            patient.gender === 'female' ? (language === 'ar' ? 'أنثى' : 'Female') : '-'}
                        </TableCell>
                        <TableCell>
                          {patient.isValid ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : (
                            <div className="flex items-center gap-1">
                              <AlertCircle className="w-4 h-4 text-destructive" />
                              <span className="text-xs text-destructive">{patient.errors.join(', ')}</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {invalidCount > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>
                    {language === 'ar'
                      ? `سيتم تخطي ${invalidCount} صف غير صالح`
                      : `${invalidCount} invalid rows will be skipped`}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground">
                {language === 'ar' ? 'جاري استيراد البيانات...' : 'Importing data...'}
              </p>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 'complete' && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="w-16 h-16 text-green-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {language === 'ar' ? 'تم الاستيراد بنجاح!' : 'Import Complete!'}
              </h3>
              <div className="flex gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">{importResult.success}</p>
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'تم استيرادهم' : 'Imported'}
                  </p>
                </div>
                {importResult.failed > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-destructive">{importResult.failed}</p>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'فشل' : 'Failed'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row-reverse justify-start gap-2">
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                {language === 'ar' ? 'رجوع' : 'Back'}
              </Button>
              <Button
                variant="gradient"
                onClick={handleImport}
                disabled={validCount === 0}
              >
                <Upload className="w-4 h-4" />
                {language === 'ar' ? `استيراد ${validCount} مريض` : `Import ${validCount} patients`}
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button variant="gradient" onClick={handleClose}>
              {language === 'ar' ? 'تم' : 'Done'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportPatientsDialog;
