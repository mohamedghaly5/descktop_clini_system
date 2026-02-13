import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Cloud, HardDrive, RefreshCw, Shield, Download, Upload, FolderOpen, History, Trash2, Loader2, CheckCircle2, AlertTriangle, Database } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { db } from '@/services/db';

const BackupSettings: React.FC = () => {
    const { language } = useLanguage();
    const isRtl = language === 'ar';

    const [loading, setLoading] = useState(false);
    const [cloudUser, setCloudUser] = useState<any>(null);
    const [cloudFiles, setCloudFiles] = useState<any[]>([]);
    const [backupSchedule, setBackupSchedule] = useState('manual');
    const [localPath, setLocalPath] = useState('');
    const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);

    // Dialogs
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [passwordAction, setPasswordAction] = useState<'backup' | 'restore-local' | 'restore-cloud' | null>(null);
    const [password, setPassword] = useState('');
    const [selectedCloudFileId, setSelectedCloudFileId] = useState<string | null>(null);

    const [isClientMode, setIsClientMode] = useState(false);

    useEffect(() => {
        checkMode();
        fetchSettings();
        fetchCloudStatus();
    }, []);

    const checkMode = async () => {
        // @ts-ignore
        if (!window.electron) {
            setIsClientMode(true);
            return;
        }
        try {
            // @ts-ignore
            const status = await window.electron.ipcRenderer.invoke('system:get-status');
            if (status && status.mode === 'client') setIsClientMode(true);
        } catch (e) { }
    };

    const fetchSettings = async () => {
        try {
            const config = await db.backup.getConfig();
            setBackupSchedule(config.schedule || 'manual');
            setLocalPath(config.localPath || '');
            setLastBackupDate(config.lastBackupDate);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchCloudStatus = async () => {
        try {
            const user = await db.backup.getCloudUser();
            setCloudUser(user);
            if (user) {
                const files = await db.backup.listCloudFiles();
                setCloudFiles(files);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleCloudAuth = async () => {
        if (isClientMode) {
            toast.error(isRtl ? 'يرجى تسجيل الدخول من جهاز السيرفر' : 'Please sign in from the server device');
            return;
        }
        setLoading(true);
        try {
            const success = await db.backup.startAuth();
            if (success) {
                await fetchCloudStatus();
                toast.success(isRtl ? 'تم تسجيل الدخول بنجاح' : 'Authenticated successfully');
            } else {
                toast.error(isRtl ? 'فشل تسجيل الدخول' : 'Authentication failed');
            }
        } catch (e) {
            toast.error(isRtl ? 'حدث خطأ' : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectLocalPath = async () => {
        if (isClientMode) return;
        try {
            const path = await db.backup.setLocalPath();
            if (path) setLocalPath(path);
        } catch (e) {
            console.error(e);
        }
    };

    const handleScheduleChange = async (val: string) => {
        if (isClientMode) return;
        setBackupSchedule(val);
        // @ts-ignore
        await db.backup.setSchedule(val);
        toast.success(isRtl ? 'تم تحديث الجدول' : 'Schedule updated');
    };

    const initiateAction = (action: 'backup' | 'restore-local' | 'restore-cloud', cloudFileId?: string) => {
        setPasswordAction(action);
        if (cloudFileId) setSelectedCloudFileId(cloudFileId);
        setPassword('');
        setPasswordDialogOpen(true);
    };

    const handlePasswordSubmit = async () => {
        setPasswordDialogOpen(false);
        setLoading(true);

        const toastId = toast.loading(isRtl ? 'جاري المعالجة...' : 'Processing...');

        try {
            let result;
            if (passwordAction === 'backup') {
                result = await db.backup.create(password || undefined);
                if (result.success) {
                    toast.success(isRtl ? 'تم إنشاء النسخة الاحتياطية' : 'Backup created successfully', { id: toastId });
                    fetchSettings();
                    // Also backup to cloud if authenticated
                    if (cloudUser && !isClientMode) {
                        // In client mode, we might want to trigger cloud backup too? 
                        // The user said "He can only make a backup command... he cannot restore".
                        // Let's allow cloud trigger if connected.
                        await db.backup.createCloud(password || undefined);
                        fetchCloudStatus();
                        toast.success(isRtl ? 'تم الرفع للسحابة' : 'Uploaded to Cloud successfully');
                    } else if (cloudUser && isClientMode) {
                        // Try remote cloud trigger
                        await db.backup.createCloud(password || undefined);
                        fetchCloudStatus();
                        toast.success(isRtl ? 'تم الرفع للسحابة' : 'Uploaded to Cloud successfully');
                    }
                } else {
                    toast.error(result.error || (isRtl ? 'فشل الإنشاء' : 'Creation failed'), { id: toastId });
                }
            } else if (passwordAction === 'restore-local') {
                if (isClientMode) throw new Error("Client restore disabled");
                result = await db.backup.restoreLocal(password || undefined);
                if (result.success) {
                    toast.success(isRtl ? 'تم الاستعادة. سيتم إعادة التشغيل...' : 'Restored. Restarting...', { id: toastId });
                } else if (result.reason === 'canceled') {
                    toast.dismiss(toastId);
                } else {
                    toast.error(result.error || (isRtl ? 'كلمة المرور غير صحيحة أو ملف تالف' : 'Invalid password or corrupt file'), { id: toastId });
                }
            } else if (passwordAction === 'restore-cloud') {
                if (isClientMode) throw new Error("Client restore disabled");
                result = await db.backup.restoreCloud(selectedCloudFileId!, password || undefined);
                if (result.success) {
                    toast.success(isRtl ? 'تم الاستعادة. سيتم إعادة التشغيل...' : 'Restored. Restarting...', { id: toastId });
                } else {
                    toast.error(result.error || (isRtl ? 'فشل الاستعادة' : 'Restore failed'), { id: toastId });
                }
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || 'Error', { id: toastId });
        } finally {
            setLoading(false);
            setPasswordAction(null);
            setSelectedCloudFileId(null);
        }
    };

    const handleDeleteCloud = async (fileId: string) => {
        if (!confirm(isRtl ? 'هل أنت متأكد؟' : 'Are you sure?')) return;
        setLoading(true);
        try {
            if (isClientMode) throw new Error(isRtl ? 'غير متاح في وضع العميل' : 'Not available in client mode');
            await db.backup.deleteCloud(fileId);
            fetchCloudStatus();
            toast.success(isRtl ? 'تم الحذف' : 'Deleted');
        } catch (e: any) {
            toast.error(e.message || 'Error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Local Backup */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <HardDrive className="w-5 h-5 text-primary" />
                            {isRtl ? 'النسخ الاحتياطي المحلي' : 'Local Backup'}
                        </CardTitle>
                        <CardDescription>
                            {isRtl ? 'إعدادات النسخ الاحتياطي على هذا الجهاز' : 'Manage backups on this device'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 w-full space-y-2">
                                <Label>{isRtl ? 'مسار مجلد النسخ الاحتياطي' : 'Backup Folder Path'}</Label>
                                <div className="flex gap-2">
                                    <Input value={localPath || (isRtl ? 'المجلد الافتراضي' : 'Default Folder')} readOnly className="bg-muted" />
                                    <Button variant="outline" onClick={handleSelectLocalPath} disabled={isClientMode} title={isClientMode ? (isRtl ? 'غير متاح في وضع العميل' : 'Not available in client mode') : ''}>
                                        <FolderOpen className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-1 w-full space-y-2">
                                <Label>{isRtl ? 'جدولة النسخ التلقائي' : 'Automatic Backup Schedule'}</Label>
                                <Select value={backupSchedule} onValueChange={handleScheduleChange} disabled={isClientMode}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="manual">{isRtl ? 'يدوي فقط' : 'Manual Only'}</SelectItem>
                                        <SelectItem value="daily">{isRtl ? 'يومي (عند الإغلاق)' : 'Daily (on exit)'}</SelectItem>
                                        <SelectItem value="weekly">{isRtl ? 'أسبوعي' : 'Weekly'}</SelectItem>
                                        <SelectItem value="monthly">{isRtl ? 'شهري' : 'Monthly'}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4 pt-4 border-t">
                            <Button onClick={() => initiateAction('backup')} disabled={loading} className="flex-1">
                                <Upload className="w-4 h-4 me-2" />
                                {isRtl ? 'إنشاء نسخة احتياطية الآن' : 'Create Backup Now'}
                            </Button>
                            {!isClientMode && (
                                <Button onClick={() => initiateAction('restore-local')} disabled={loading} variant="outline" className="flex-1">
                                    <History className="w-4 h-4 me-2" />
                                    {isRtl ? 'استعادة من ملف محلي' : 'Restore from Local File'}
                                </Button>
                            )}
                        </div>

                        {lastBackupDate && (
                            <p className="text-sm text-muted-foreground text-center">
                                {isRtl ? 'آخر نسخ احتياطي ناجح:' : 'Last successful backup:'} {new Date(lastBackupDate).toLocaleString()}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Cloud Backup */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Cloud className="w-5 h-5 text-blue-500" />
                            {isRtl ? 'النسخ السحابي (Google Drive)' : 'Cloud Backup (Google Drive)'}
                        </CardTitle>
                        <CardDescription>
                            {isRtl ? 'حفظ نسخة آمنة على جوجل درايف' : 'Securely save backups to Google Drive'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {!cloudUser ? (
                            <div className="text-center py-8 space-y-4">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                                    <Cloud className="w-8 h-8 text-blue-500" />
                                </div>
                                <p className="text-muted-foreground">
                                    {isRtl ? 'قم بربط حسابك لحفظ البيانات سحابياً' : 'Connect your account to save data to the cloud'}
                                </p>

                                {isClientMode ? (
                                    <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200 text-sm">
                                        <AlertTriangle className="w-4 h-4 inline-block me-2" />
                                        {isRtl
                                            ? 'يرجي ربط حساب Google Drive من جهاز السيرفر الرئيسي أولاً.'
                                            : 'Please link Google Drive from the main Server application.'}
                                    </div>
                                ) : (
                                    <Button onClick={handleCloudAuth} disabled={loading}>
                                        {isRtl ? 'تسجيل الدخول باستخدام Google' : 'Sign in with Google'}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl font-bold border border-green-200">
                                            {cloudUser.name?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                            <p className="font-semibold">{cloudUser.name}</p>
                                            <p className="text-xs opacity-80">{cloudUser.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded-full border border-green-200">
                                            <CheckCircle2 className="w-3 h-3" />
                                            {isRtl ? 'متصل' : 'Connected'}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium text-sm">{isRtl ? 'النسخ السحابية المتوفرة' : 'Available Cloud Backups'}</h4>
                                        <Button variant="ghost" size="sm" onClick={fetchCloudStatus} disabled={loading}>
                                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                        </Button>
                                    </div>

                                    <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                                        {cloudFiles.length === 0 ? (
                                            <div className="p-8 text-center text-muted-foreground">
                                                {isRtl ? 'لا توجد نسخ احتياطية' : 'No backups found'}
                                            </div>
                                        ) : (
                                            cloudFiles.map((file) => (
                                                <div key={file.id} className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-50 text-blue-600 rounded">
                                                            <Database className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-sm">{file.name}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {new Date(file.createdTime).toLocaleString()} • {(parseInt(file.size) / 1024 / 1024).toFixed(2)} MB
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {!isClientMode && (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => initiateAction('restore-cloud', file.id)}
                                                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                                >
                                                                    {isRtl ? 'استعادة' : 'Restore'}
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleDeleteCloud(file.id)}
                                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {passwordAction === 'backup'
                                ? (isRtl ? 'تشفير النسخة الاحتياطية' : 'Encrypt Backup')
                                : (isRtl ? 'فك التشفير' : 'Decrypt Backup')
                            }
                        </DialogTitle>
                        <DialogDescription>
                            {passwordAction === 'backup'
                                ? (isRtl ? 'أدخل كلمة مرور لحماية ملف النسخة الاحتياطية (اختياري)' : 'Enter a password to protect the backup file (Optional)')
                                : (isRtl ? 'إذا كان الملف مشفراً، يرجى إدخال كلمة المرور' : 'If the file is encrypted, please enter the password')
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>{isRtl ? 'كلمة المرور' : 'Password'}</Label>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="******"
                        />
                        {passwordAction === 'backup' && (
                            <p className="text-xs text-muted-foreground mt-2 text-yellow-600 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {isRtl ? 'تنبيه: إذا نسيت كلمة المرور، لا يمكنك استعادة البيانات.' : 'Warning: If you forget the password, you cannot restore the data.'}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                            {isRtl ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button onClick={handlePasswordSubmit}>
                            {passwordAction === 'backup'
                                ? (isRtl ? 'بدء النسخ' : 'Start Backup')
                                : (isRtl ? 'بدء الاستعادة' : 'Start Restore')
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default BackupSettings;
