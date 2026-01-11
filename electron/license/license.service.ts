import { appMetaService } from '../services/appMetaService.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { machineIdSync } = require('node-machine-id');
import crypto from 'crypto';
import { getDb } from '../db/init.js';
import { supabase as supabaseAdmin } from '../services/supabaseClient.js';

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
    licenseType?: 'Trial' | 'Pro' | 'Enterprise' | 'Support';
}

const CACHE_ENCRYPTION_KEY = 'dental-flow-local-secret-key-salt'; // In prod, rely on safe storage or obscure this
const GRACE_PERIOD_DAYS_DEFAULT = 7;

// --- Helper: Crypto for Local Cache ---
function encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(CACHE_ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string | null {
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift() as string, 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const key = crypto.scryptSync(CACHE_ENCRYPTION_KEY, 'salt', 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        return null; // Tampered or invalid
    }
}

export const licenseService = {

    getFingerprint(): string {
        try {
            return machineIdSync();
        } catch (e) {
            // Fallback if machine-id fails (e.g. permission issues), though unlikely on standard Windows
            return crypto.createHash('sha256').update('fallback-fingerprint').digest('hex');
        }
    },

    initialize() {
        // 1. Ensure fingerprint is stored
        const storedFp = appMetaService.get('device_fingerprint');
        const currentFp = this.getFingerprint();

        if (!storedFp) {
            appMetaService.set('device_fingerprint', currentFp);
        } else if (storedFp !== currentFp) {
            console.warn('License Fingerprint Mismatch! App moved to new device?', { stored: storedFp, current: currentFp });
        }
    },

    getInternalState(): LicenseState {
        // --- 1. Basic Data Fetch ---
        const encData = appMetaService.get('license_cache_encrypted');
        let licenseData: any = {};

        if (encData) {
            const temp = decrypt(encData);
            if (temp) {
                try { licenseData = JSON.parse(temp); } catch (e) { }
            }
        }

        const expiresAtIso = licenseData.expiry_date || appMetaService.get('license_expires_at'); // Fallback to legacy key if cache missing
        const supportUnlockUntilIso = appMetaService.get('support_unlock_until');
        const licenseKeyMasked = appMetaService.get('license_key_masked') || undefined;
        let licenseType = (appMetaService.get('license_type') as any) || 'Trial';

        const currentFp = this.getFingerprint();
        const registeredFp = licenseData.fingerprint || appMetaService.get('device_fingerprint');

        const now = new Date();
        const nowIso = now.toISOString();

        // Use configured grace period from license or default
        const maxGraceDays = licenseData.grace_days || GRACE_PERIOD_DAYS_DEFAULT;

        // --- 2. Check Support Override (High Priority) ---
        if (supportUnlockUntilIso) {
            const unlockDate = new Date(supportUnlockUntilIso);
            if (unlockDate > now) {
                const ms = unlockDate.getTime() - now.getTime();
                const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
                return {
                    status: 'support_unlock',
                    expiresAt: expiresAtIso,
                    daysRemaining: days,
                    graceDaysRemaining: 0,
                    fingerprintMismatch: false,
                    clinicMismatch: false,
                    warningLevel: 'none',
                    supportUnlockUntil: supportUnlockUntilIso,
                    licenseKeyMasked,
                    licenseType: 'Support'
                };
            }
        }

        // --- 3. Validation Checks ---
        // A. Fingerprint
        const fingerprintMismatch = registeredFp && (registeredFp !== currentFp);

        // B. Clock Tampering
        const lastCheckIso = appMetaService.get('last_license_check_at');
        let clockTampered = false;
        if (lastCheckIso && new Date(lastCheckIso) > now) {
            // Allow small drift (e.g. 10 mins)
            if (new Date(lastCheckIso).getTime() - now.getTime() > 10 * 60 * 1000) {
                console.warn('Clock manipulation detected.');
                clockTampered = true;
            }
        }

        if (!process.env.DEV) { // Update check time only in prod to avoid dev noise or consistently
            if (!lastCheckIso || new Date(lastCheckIso) < now) {
                appMetaService.set('last_license_check_at', nowIso);
            }
        }

        // --- 4. Return Invalid States ---
        if (fingerprintMismatch || clockTampered) {
            return {
                status: 'invalid', // Treated as Read-Only
                expiresAt: expiresAtIso,
                daysRemaining: 0,
                graceDaysRemaining: 0,
                fingerprintMismatch: !!fingerprintMismatch,
                clinicMismatch: false,
                warningLevel: 'critical',
                supportUnlockUntil: null,
                licenseKeyMasked,
                licenseType
            };
        }

        if (!expiresAtIso) {
            return {
                status: 'expired',
                expiresAt: null,
                daysRemaining: 0,
                graceDaysRemaining: 0,
                fingerprintMismatch: false,
                clinicMismatch: false,
                warningLevel: 'critical',
                supportUnlockUntil: null,
                licenseKeyMasked: undefined,
                licenseType: 'Trial'
            };
        }

        // --- 5. Valid Expiry Calculation ---
        const expiresAt = new Date(expiresAtIso);
        const msDiff = expiresAt.getTime() - now.getTime();
        const daysRemaining = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

        let warningLevel: LicenseState['warningLevel'] = 'none';

        if (daysRemaining >= 0) {
            if (daysRemaining <= 7) warningLevel = 'warning';
            if (daysRemaining <= 3) warningLevel = 'critical';

            return {
                status: 'active',
                expiresAt: expiresAtIso,
                daysRemaining,
                graceDaysRemaining: 0, // No conceptual grace period, strictly expiry based
                fingerprintMismatch: false,
                clinicMismatch: false,
                warningLevel,
                supportUnlockUntil: null,
                licenseKeyMasked,
                licenseType
            };
        } else {
            // License Expired - Strict Enforcement
            // No post-expiry grace period allowed.
            // Offline usage is strictly limited to the license valid duration.
            return {
                status: 'expired',
                expiresAt: expiresAtIso,
                daysRemaining: 0,
                graceDaysRemaining: 0,
                fingerprintMismatch: false,
                clinicMismatch: false,
                warningLevel: 'critical',
                supportUnlockUntil: null,
                licenseKeyMasked,
                licenseType
            };
        }
    },

    /**
     * ONLINE ACTIVATION / VALIDATION
     */
    async activateLicense(keyInput: string): Promise<{ success: boolean; message?: string }> {
        try {
            // 1. Input Normalization
            if (!keyInput || keyInput.trim().length === 0) {
                return { success: false, message: 'يرجى إدخال رقم الترخيص' };
            }

            const cleanKey = keyInput.trim();
            console.log('[License] Attempting Activation for:', cleanKey);

            // 2. Fetch License (Robust Method)
            // Using ilike for case-insensitivity, and maybeSingle to avoid 406 errors
            const { data: license, error } = await supabaseAdmin
                .from('licenses')
                .select('*')
                .ilike('license_key', cleanKey)
                .maybeSingle();

            if (error) {
                console.error('[License] Database Error:', error);
                return { success: false, message: 'حدث خطأ في الاتصال بقاعدة البيانات. تأكد من الإنترنت.' };
            }

            if (!license) {
                console.warn('[License] Key not found:', cleanKey);
                return { success: false, message: 'رقم الترخيص غير موجود أو غير صحيح' };
            }

            // 3. Check Status
            // Normalize status check
            const status = (license.status || '').toLowerCase();
            if (status !== 'active') {
                return { success: false, message: 'هذا الترخيص موقوف حالياً' };
            }

            // 4. Check Expiry
            const now = new Date();
            const expiresAt = new Date(license.expiry_date);
            // Reset times to compare dates only? Or keep exact time. Be strict for security.
            if (expiresAt < now) {
                return { success: false, message: 'عفواً، هذا الترخيص منتهي الصلاحية' };
            }

            // 5. Device Registration Logic
            const currentFp = this.getFingerprint();
            console.log('[License] Device Fingerprint:', currentFp);

            // Fetch devices for this license
            const { data: devices, error: devError } = await supabaseAdmin
                .from('license_devices')
                .select('*')
                .eq('license_id', license.id);

            if (devError) {
                console.error('[License] Device Fetch Error:', devError);
                return { success: false, message: 'فشل التحقق من الأجهزة المسجلة' };
            }

            const registeredDevices = devices || [];
            const myDevice = registeredDevices.find((d: any) => d.device_fingerprint === currentFp);

            if (myDevice) {
                // Device already registered: Update 'last_seen'
                console.log('[License] Device already registered. Updating last_seen...');
                const { error: updateErr } = await supabaseAdmin
                    .from('license_devices')
                    .update({ last_seen: now.toISOString() })
                    .eq('id', myDevice.id);

                if (updateErr) {
                    console.error('[License] Update Last Seen Error:', updateErr);
                }
            } else {
                // New Device: Check limits
                const maxDevices = license.max_devices || 1;
                if (registeredDevices.length >= maxDevices) {
                    console.warn(`[License] Max devices reached (${registeredDevices.length}/${maxDevices})`);
                    return { success: false, message: `تجاوزت الحد الأقصى للأجهزة المسموحة (${maxDevices}).` };
                }

                // Register
                console.log('[License] Registering new device...');
                const { error: regErr } = await supabaseAdmin
                    .from('license_devices')
                    .insert({
                        license_id: license.id,
                        device_fingerprint: currentFp,
                        first_seen: now.toISOString(),
                        last_seen: now.toISOString()
                    });

                if (regErr) {
                    console.error('Registration Error:', regErr);
                    return { success: false, message: `فشل تسجيل الجهاز: ${regErr.message}` };
                }
            }

            // 6. Cache & Success
            // Prepare Cache Data
            const cacheData = {
                key: license.license_key,
                expiry_date: license.expiry_date,
                status: license.status,
                grace_days: license.grace_days || 0,
                last_online_check: now.toISOString(),
                fingerprint: currentFp,
                clinic_name: license.clinic_name
            };

            const encryptedCache = encrypt(JSON.stringify(cacheData));
            appMetaService.set('license_cache_encrypted', encryptedCache);

            // Legacy helpers (optional but good for UI consistency)
            appMetaService.set('license_key_masked', '****' + cleanKey.slice(-4));
            appMetaService.set('license_expires_at', license.expiry_date);
            appMetaService.set('license_status', 'active');
            appMetaService.set('last_license_check_at', now.toISOString());

            console.log('[License] Activation Successful!');
            return { success: true, message: 'تم تفعيل الترخيص بنجاح!' };

        } catch (err: any) {
            console.error('[License] Activation Exception:', err);
            return { success: false, message: 'خطأ غير متوقع: ' + (err.message || 'Unknown') };
        }
    },

    // Support Unlock Command (Hidden/Manual)
    enableSupportAccess(durationHours: number = 24) {
        const now = new Date();
        const unlockUntil = new Date(now.getTime() + (durationHours * 60 * 60 * 1000));
        appMetaService.set('support_unlock_until', unlockUntil.toISOString());
        console.log(`Support access enabled until ${unlockUntil.toISOString()}`);
    },

    isWriteAllowed(): boolean {
        // Bypass for Initial Setup
        // CRITICAL: Only allow bypass if there is NO data (fresh install)
        try {
            const db = getDb();
            const settings = db.prepare('SELECT is_setup_completed FROM clinic_settings LIMIT 1').get() as any;

            if (!settings?.is_setup_completed) {
                // Double check if we really are in setup mode by checking data presence
                const patientCount = db.prepare('SELECT count(*) as count FROM patients').get() as { count: number };
                if (patientCount.count === 0) {
                    return true; // Allow write only if DB is empty (Setup Mode)
                }
            }
        } catch (e) { }

        const state = this.getInternalState();
        return state.status === 'active' || state.status === 'grace' || state.status === 'support_unlock';
    },

    deleteLicense() {
        console.log('[License] Deleting local license data...');
        appMetaService.delete('license_cache_encrypted');
        appMetaService.delete('license_key_masked');
        appMetaService.delete('license_expires_at');
        appMetaService.delete('license_status');
        appMetaService.delete('last_license_check_at');
        appMetaService.delete('license_type');
        appMetaService.delete('support_unlock_until');
        // Do NOT delete device_fingerprint to avoid "new device" detection abuse if they reactivate
        return { success: true };
    }
};
