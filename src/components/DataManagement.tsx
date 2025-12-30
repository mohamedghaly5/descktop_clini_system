import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { Database, Upload, Download, AlertTriangle } from 'lucide-react';

const DataManagement: React.FC = () => {
    const { t, language } = useLanguage();

    // Handlers
    const handleBackup = async () => {
        try {
            const result = await (window as any).api.backupDatabase();
            if (result.success) {
                toast.success(language === 'ar' ? 'تم إنشاء النسخة الاحتياطية بنجاح' : 'Backup created successfully');
            } else if (result.reason !== 'canceled') {
                toast.error(language === 'ar' ? 'فشل النسخ الاحتياطي: ' + result.error : 'Backup failed: ' + result.error);
            }
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleRestore = async () => {
        const confirmMsg = language === 'ar'
            ? 'تحذير: سيتم استبدال قاعدة البيانات الحالية بالنسخة المختارة. هل أنت متأكد؟'
            : 'Warning: Current database will be replaced. Are you sure?';

        if (!window.confirm(confirmMsg)) return;

        try {
            const result = await (window as any).api.restoreDatabase();
            if (result.success) {
                toast.success(language === 'ar' ? 'تمت الاستعادة. سيتم إعادة تشغيل التطبيق...' : 'Restored. App restarting...');
            } else if (result.reason !== 'canceled') {
                toast.error(language === 'ar' ? 'فشل الاستعادة: ' + result.error : 'Restore failed: ' + result.error);
            }
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">

            {/* Section A: Backup & Restore */}
            <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Database className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle>{language === 'ar' ? 'النسخ الاحتياطي والاستعادة' : 'Backup & Restore'}</CardTitle>
                            <CardDescription>{language === 'ar' ? 'حماية البيانات واستعادتها عند الحاجة' : 'Protect your data and restore it when needed'}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert variant="default" className="bg-warning/10 border-warning/20">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <AlertTitle>{language === 'ar' ? 'تنبيه' : 'Warning'}</AlertTitle>
                        <AlertDescription>
                            {language === 'ar'
                                ? 'عند استعادة نسخة احتياطية، سيتم استبدال البيانات الحالية بالكامل. يفضل دائمًا أخذ نسخة احتياطية قبل الاستعادة.'
                                : 'Restoring a backup will replace all current data. It is recommended to create a backup before restoring.'
                            }
                        </AlertDescription>
                    </Alert>

                    <div className="flex gap-4">
                        <Button onClick={handleBackup} className="flex-1 gap-2">
                            <Download className="w-4 h-4" />
                            {language === 'ar' ? 'إنشاء نسخة احتياطية' : 'Create Backup'}
                        </Button>
                        <Button onClick={handleRestore} variant="outline" className="flex-1 gap-2 border-destructive hover:bg-destructive/10 text-destructive">
                            <Upload className="w-4 h-4" />
                            {language === 'ar' ? 'استعادة نسخة سابقة' : 'Restore Backup'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default DataManagement;
