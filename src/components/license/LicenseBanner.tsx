import React from 'react';
import { useLicenseStatus } from '@/hooks/useLicenseStatus';
import { AlertTriangle, Lock, ShieldCheck, Clock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const LicenseBanner = () => {
    const { status, isLoading } = useLicenseStatus();
    const navigate = useNavigate();

    if (isLoading || !status) return null;

    // 1. Support Unlock Banner (Blue) - Shows regardless of other warnings if active
    if (status.status === 'support_unlock') {
        return (
            <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between shadow-md z-[70] relative">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5" />
                    <span className="font-bold text-sm">
                        تم تفعيل وضع الدعم الفني. النظام مفتوح مؤقتاً لمدة {status.daysRemaining} يوم.
                    </span>
                </div>
            </div>
        );
    }

    // 2. Critical/Invalid (Red)
    if (status.status === 'expired' || status.status === 'invalid' || status.clinicMismatch) {
        return (
            <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between shadow-md z-[70] relative" dir="rtl">
                <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 animate-pulse" />
                    <span className="font-bold text-sm">
                        {status.clinicMismatch
                            ? "رخصة غير مطابقة: هذه النسخة مسجلة باسم عيادة أخرى. وضع القراءة فقط."
                            : "انتهى الاشتراك. وضع القراءة فقط. يرجى التجديد للاستمرار."}
                    </span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => navigate('/license')}>
                    تفعيل الرخصة
                </Button>
            </div>
        );
    }

    // 3. Grace Period (Yellow)
    if (status.status === 'grace') {
        return (
            <div className="bg-amber-500 text-black px-4 py-2 flex items-center justify-between shadow-md z-[70] relative" dir="rtl">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-bold text-sm">
                        الاشتراك منتهي. فترة سماح: {status.graceDaysRemaining} يوم متبقي.
                    </span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => navigate('/license')}>
                    تجديد الآن
                </Button>
            </div>
        );
    }

    // 4. Warning Levels for Active/Grace (Schedule)
    if (status.warningLevel !== 'none') {
        let bgClass = 'bg-blue-500';
        let icon = <Clock className="h-5 w-5" />;

        if (status.warningLevel === 'info') bgClass = 'bg-blue-600'; // 14 days
        if (status.warningLevel === 'warning') bgClass = 'bg-yellow-500 text-black'; // 7 days
        if (status.warningLevel === 'critical') {
            bgClass = 'bg-red-500'; // 1 day
            icon = <ShieldAlert className="h-5 w-5 animate-pulse" />;
        }

        return (
            <div className={`${bgClass} text-white px-4 py-2 flex items-center justify-between shadow-md z-[70] relative`} dir="rtl">
                <div className="flex items-center gap-3">
                    {icon}
                    <span className="font-bold text-sm">
                        ينتهي الاشتراك خلال {status.daysRemaining} يوم. يرجى التجديد لتجنب توقف الخدمة.
                    </span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => navigate('/license')}>
                    تجديد الآن
                </Button>
            </div>
        );
    }

    return null;
};

export default LicenseBanner;
