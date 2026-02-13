import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLicenseStatus } from '@/hooks/useLicenseStatus';
import { Badge } from "@/components/ui/badge";
import { Loader2, Key, CheckCircle, XCircle, Shield, AlertTriangle, LogOut } from 'lucide-react';
import { cn } from "@/lib/utils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from 'react-router-dom';

const LicenseSettings = () => {
    const { status, isLoading, activate, refresh } = useLicenseStatus();
    const { hasPermission } = useAuth();
    const canManageLicense = hasPermission('MANAGE_LICENSE');
    const [key, setKey] = useState('');
    const [isActivating, setIsActivating] = useState(false);
    const [result, setResult] = useState<{ success: boolean, message?: string } | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isClientMode, setIsClientMode] = useState(false);
    const navigate = useNavigate();

    // Check system mode on mount
    React.useEffect(() => {
        const checkMode = async () => {
            try {
                // @ts-ignore
                if ((window as any).electron && (window as any).electron.ipcRenderer) {
                    // @ts-ignore
                    const status = await window.electron.ipcRenderer.invoke('system:get-status');
                    if (status && status.mode === 'client') {
                        setIsClientMode(true);
                    }
                } else {
                    // Browser mode is effectively client mode (no direct license management)
                    setIsClientMode(true);
                }
            } catch (e) { console.error('Failed to check system status:', e); }
        };
        checkMode();
    }, []);

    const handleActivate = async () => {
        if (!key.trim()) return;
        setIsActivating(true);
        setResult(null);

        const res = await activate(key.trim());
        setResult(res as any);
        setIsActivating(false);
        if (res.success) setKey('');
    };

    const handleDeleteLicense = async () => {
        try {
            await window.electron.ipcRenderer.invoke('license:delete');
            setDeleteDialogOpen(false);
            window.location.reload();
        } catch (error) {
            console.error('Failed to delete license:', error);
        }
    };

    if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    const getStatusLabel = (s: string | undefined) => {
        switch (s) {
            case 'active': return 'نشط';
            case 'grace': return 'فترة سماح';
            case 'expired': return 'منتهية';
            case 'invalid': return 'غير صالحة';
            case 'support_unlock': return 'وضع الدعم الفني';
            default: return 'غير معروف';
        }
    };

    const getVariant = (s: string | undefined) => {
        switch (s) {
            case 'active': return 'default'; // primary/green usually
            case 'grace': return 'secondary'; // yellow/orange
            default: return 'destructive'; // red
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto" dir="rtl">
            <div className="text-start">
                {/* Header if needed, but likely handled by Settings page */}
            </div>

            <Card className="animate-fade-in">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Shield className="h-6 w-6" />
                        </div>
                        <div className="text-start">
                            <CardTitle>حالة الترخيص</CardTitle>
                            <CardDescription>إدارة ترخيص البرنامج والاشتراكات</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Status Banner */}
                    <div className="flex justify-between items-center p-4 bg-muted/50 rounded-xl border">
                        <span className="font-semibold text-foreground">الحالة الحالية</span>
                        <Badge variant={getVariant(status?.status) as any} className="text-lg px-6 py-1.5">
                            {getStatusLabel(status?.status)}
                        </Badge>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2 text-start p-3 rounded-lg bg-background border">
                            <p className="text-sm text-muted-foreground">تاريخ الانتهاء</p>
                            <p className="font-bold text-lg dir-ltr text-right">
                                {status?.expiresAt ? new Date(status.expiresAt).toLocaleDateString('en-GB') : '-'}
                            </p>
                        </div>
                        <div className="space-y-2 text-start p-3 rounded-lg bg-background border">
                            <p className="text-sm text-muted-foreground">الأيام المتبقية</p>
                            <div className={cn(
                                "font-bold text-lg",
                                status?.daysRemaining! < 10 ? 'text-amber-500' : 'text-green-600'
                            )}>
                                {status?.daysRemaining} يوم
                            </div>
                        </div>
                    </div>

                    {/* Masked Key Display */}
                    <div className="space-y-2 text-start">
                        <p className="text-sm text-muted-foreground">مفتاح الترخيص الحالي</p>
                        <div className="p-3 bg-muted/30 border rounded-lg flex items-center gap-2 font-mono text-sm tracking-widest text-muted-foreground dir-ltr select-none">
                            <Key className="w-4 h-4 text-primary/50" />
                            {status?.licenseKeyMasked ? status.licenseKeyMasked : '****-****-XXXX'}
                        </div>
                    </div>

                    {/* Warnings */}
                    {status?.fingerprintMismatch && (
                        <div className="flex items-start gap-3 bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20 text-start">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">تنبيه أمني</p>
                                <p className="text-sm">يبدو أن البرنامج يعمل على جهاز مختلف عن الجهاز المسجل. يرجى التواصل مع الدعم الفني.</p>
                            </div>
                        </div>
                    )}

                    <div className="pt-2 flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={refresh}>
                            <Loader2 className={cn("w-4 h-4", isLoading && "animate-spin")} />
                            <span className="sr-only">تحديث</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => activate(status?.licenseKeyMasked || '')} disabled={!canManageLicense}>
                            تحقق من الحالة
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {canManageLicense && !isClientMode && (
                <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
                    <CardHeader>
                        <div className="text-start">
                            <CardTitle>تفعيل رخصة جديدة</CardTitle>
                            <CardDescription>أدخل مفتاح المنتج لتجديد الاشتراك</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <Key className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="XXXX-XXXX-XXXX-XXXX"
                                    value={key}
                                    onChange={(e) => setKey(e.target.value)}
                                    disabled={isActivating}
                                    className="pr-9 font-mono text-center uppercase tracking-widest"
                                    dir="ltr"
                                />
                            </div>
                            <Button
                                onClick={handleActivate}
                                disabled={isActivating || !key}
                                className="min-w-[120px]"
                            >
                                {isActivating ? <Loader2 className="animate-spin h-4 w-4" /> : 'تفعيل'}
                            </Button>
                        </div>

                        {result && (
                            <div className={cn(
                                "flex items-center gap-2 p-4 rounded-xl border animate-in slide-in-from-top-2",
                                result.success
                                    ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400"
                                    : "bg-destructive/10 border-destructive/20 text-destructive"
                            )}>
                                {result.success ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                                <span className="font-medium text-sm">
                                    {result.success ? 'تم تفعيل الرخصة بنجاح! شكراً لك.' : (result.message || 'حدث خطأ غير متوقع')}
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {canManageLicense && !isClientMode && (
                <div className="flex justify-end pt-4">
                    <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-2" onClick={() => setDeleteDialogOpen(true)}>
                        <LogOut className="w-4 h-4" />
                        حذف الترخيص من هذا الجهاز
                    </Button>
                </div>
            )}

            {/* Render logic with client mode check inside useEffect */}

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-right">حذف الترخيص</AlertDialogTitle>
                        <AlertDialogDescription className="text-right">
                            سيتم حذف بيانات الترخيص المخزنة على هذا الجهاز فقط. لن يتم إلغاء الترخيص من السيرفر، ولكن لن تتمكن من استخدام البرنامج على هذا الجهاز حتى تقوم بإعادة إدخال المفتاح.
                            <br /><br />
                            <b>ملاحظة:</b> لن يتم حذف أي بيانات طبية أو مالية.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:justify-start">
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteLicense} className="bg-destructive hover:bg-destructive/90">
                            نعم، احذف الترخيص
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default LicenseSettings;
