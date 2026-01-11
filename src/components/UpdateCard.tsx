import React, { useEffect, useState } from 'react';
import { RefreshCw, Download, Power, CheckCircle, AlertCircle, ArrowUpCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface UpdateCardProps {
    language: string;
}

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'latest' | 'error';

const UpdateCard: React.FC<UpdateCardProps> = ({ language }) => {
    const [status, setStatus] = useState<UpdateStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [version, setVersion] = useState<string>('');
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const api = (window as any).api;
        if (!api) return;

        // Listeners
        const removeStatusListener = api.onUpdateStatus((data: any) => {
            console.log('Update Status:', data);
            setStatus(data.status);
            if (data.version) setVersion(data.version);
            if (data.error) setError(data.error);

            // Toast notifications based on status
            if (data.status === 'latest') {
                toast.info(language === 'ar' ? 'أنت تستخدم أحدث نسخة' : 'You are using the latest version');
            } else if (data.status === 'error') {
                toast.error(language === 'ar' ? 'حدث خطأ في التحديث' : 'Update error');
            }
        });

        const removeProgressListener = api.onUpdateProgress((percent: number) => {
            setProgress(percent);
        });

        return () => {
            removeStatusListener();
            removeProgressListener();
        };
    }, [language]);

    const checkForUpdate = async () => {
        setStatus('checking');
        setError('');
        try {
            await (window as any).api.checkForUpdate();
        } catch (err: any) {
            setStatus('error');
            setError(err.message);
        }
    };

    const downloadUpdate = async () => {
        setStatus('downloading');
        try {
            await (window as any).api.downloadUpdate();
        } catch (err: any) {
            setStatus('error');
            setError(err.message);
        }
    };

    const quitAndInstall = async () => {
        try {
            await (window as any).api.quitAndInstall();
        } catch (err: any) {
            setStatus('error');
            setError(err.message);
        }
    };

    return (
        <Card variant="elevated" className="animate-fade-in" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl gradient-accent flex items-center justify-center">
                        <RefreshCw className={`w-6 h-6 text-accent-foreground ${status === 'checking' ? 'animate-spin' : ''}`} />
                    </div>
                    <div className="text-start">
                        <CardTitle>{language === 'ar' ? 'تحديث البرنامج' : 'Software Update'}</CardTitle>
                        <CardDescription>
                            {status === 'idle' && (language === 'ar' ? 'تحقق من وجود تحديثات جديدة' : 'Check for new updates')}
                            {status === 'checking' && (language === 'ar' ? 'جاري التحقق...' : 'Checking for updates...')}
                            {status === 'available' && (language === 'ar' ? `تحديث جديد متاح ${version}` : `New update available ${version}`)}
                            {status === 'latest' && (language === 'ar' ? 'البرنامج محدث' : 'Software is up to date')}
                            {status === 'downloading' && (language === 'ar' ? 'جاري التنزيل...' : 'Downloading...')}
                            {status === 'ready' && (language === 'ar' ? 'التحديث جاهز للتثبيت' : 'Update ready to install')}
                            {status === 'error' && (language === 'ar' ? 'فشل التحديث' : 'Update failed')}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Status Feedback */}
                    {status === 'error' && (
                        <div className="p-3 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            <span>{error || (language === 'ar' ? 'حدث خطأ غير معروف' : 'Unknown error')}</span>
                        </div>
                    )}

                    {status === 'latest' && (
                        <div className="p-3 bg-success/10 text-success rounded-lg flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            <span>{language === 'ar' ? 'أنت تستخدم آخر إصدار' : 'You have the latest version'}</span>
                        </div>
                    )}

                    {/* Progress Bar */}
                    {status === 'downloading' && (
                        <div className="space-y-2">
                            <Progress value={progress} className="h-2" />
                            <p className="text-xs text-muted-foreground text-center">{Math.round(progress)}%</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                        {(status === 'idle' || status === 'latest' || status === 'error') && (
                            <Button onClick={checkForUpdate} variant="outline" disabled={status === 'checking'}>
                                {status === 'checking' && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                {language === 'ar' ? 'تحقق الآن' : 'Check Now'}
                            </Button>
                        )}

                        {status === 'available' && (
                            <Button onClick={downloadUpdate} className="gap-2">
                                <Download className="w-4 h-4" />
                                {language === 'ar' ? 'تنزيل التحديث' : 'Download Update'}
                            </Button>
                        )}

                        {status === 'ready' && (
                            <Button onClick={quitAndInstall} className="gap-2" variant="default">
                                <ArrowUpCircle className="w-4 h-4" />
                                {language === 'ar' ? 'تثبيت وإعادة التشغيل' : 'Install & Restart'}
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default UpdateCard;
