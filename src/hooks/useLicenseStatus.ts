import { useState, useEffect } from 'react';

export type LicenseStatus = 'active' | 'grace' | 'expired' | 'invalid' | 'support_unlock';

export interface LicenseState {
    status: LicenseStatus;
    expiresAt: string | null;
    daysRemaining: number;
    graceDaysRemaining: number;
    fingerprintMismatch: boolean;
    clinicMismatch: boolean;
    warningLevel: 'none' | 'info' | 'warning' | 'critical';
    supportUnlockUntil: string | null;
    licenseKeyMasked?: string;
    licenseType?: 'Trial' | 'Pro' | 'Enterprise';
}

export const useLicenseStatus = () => {
    const [status, setStatus] = useState<LicenseState | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkStatus = async () => {
        try {
            // @ts-ignore
            const state = await window.api.getLicenseStatus();
            setStatus(state);
        } catch (error) {
            console.error('Failed to get license status', error);
        } finally {
            setIsLoading(false);
        }
    };

    const activate = async (key: string) => {
        try {
            // @ts-ignore
            const result = await window.api.activateLicense(key);
            if (result.success) {
                await checkStatus(); // refresh
            }
            return result;
        } catch (error) {
            return { success: false, message: 'Activation failed' };
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 60000); // Poll every minute
        return () => clearInterval(interval);
    }, []);

    return { status, isLoading, activate, refresh: checkStatus };
};
