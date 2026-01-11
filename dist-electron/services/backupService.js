import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { googleDriveService } from './googleDriveService.js';
import { cryptoService } from './cryptoService.js';
import { appMetaService } from './appMetaService.js';
import { getDb } from '../db/init.js';
import Store from 'electron-store';
import Database from 'better-sqlite3';
const store = new Store();
const LOCAL_BACKUP_PATH_KEY = 'local_backup_path';
const BACKUP_FILENAME = 'dental_clinic_backup.zip';
const ENCRYPTED_FILENAME = 'dental_flow.db.enc';
// Removed hardcoded key, using password-based encryption now
const BACKUP_RETENTION_COUNT = 10;
export class BackupService {
    resolveDatabasePath() {
        // Check 1: Project Root (dental-flow.db)
        const rootPath = path.join(process.cwd(), 'dental-flow.db');
        if (fs.existsSync(rootPath))
            return rootPath;
        // Check 2: Project Root Alternative (dental.db)
        const rootAltPath = path.join(process.cwd(), 'dental.db');
        if (fs.existsSync(rootAltPath))
            return rootAltPath;
        // Check 3: UserData Folder
        const userDataPath = path.join(app.getPath('userData'), 'dental-flow.db');
        if (fs.existsSync(userDataPath))
            return userDataPath;
        throw new Error("Database file not found in any standard location.");
    }
    getDbPath() {
        // Reuse resolution logic for consistency
        return this.resolveDatabasePath();
    }
    getTempPath() {
        return app.getPath('temp');
    }
    async performBackup(options = {}) {
        try {
            console.log('Starting Safe Backup...');
            const mode = options.mode || 'both'; // Default to both for backward compatibility if argument missing
            const db = getDb();
            const tempPath = this.getTempPath();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            // Steps:
            // 1. Create a raw dump of SQLite (VACUUM into temp file)
            // 2. If password provided, encrypt it
            // 3. If Cloud -> Upload (overwrite single file), set Metadata
            // 4. If Local -> Copy (preserve timestamp name), keep history
            // 1. Safe SQLite Backup
            const baseName = `dental_backup_${timestamp}.db`;
            let processPath = path.join(tempPath, baseName);
            await db.backup(processPath);
            // 1.5 Sanitize (Strip License Data from Backup)
            // Critical: Ensure backup never contains machine-specific license data
            this.sanitizeDatabase(processPath);
            let finalFileName = baseName;
            // 2. Encryption (Optional)
            if (options.password) {
                // Validate Integrity BEFORE Encryption
                if (!this.verifyDatabaseIntegrity(processPath)) {
                    throw new Error('Database dump failed integrity check');
                }
                const encryptedName = `${baseName}.enc`;
                const encryptedPath = path.join(tempPath, encryptedName);
                await cryptoService.encryptBackup(processPath, encryptedPath, options.password);
                // Switch pointer to encrypted file
                fs.unlinkSync(processPath); // delete raw
                processPath = encryptedPath;
                finalFileName = encryptedName;
            }
            let cloudResult = null;
            let localResult = false;
            // 3. Cloud Upload
            if (mode === 'cloud' || mode === 'both') {
                const isAuth = await googleDriveService.isAuthenticated();
                if (isAuth) {
                    console.log('Uploading to cloud...');
                    // Requirement: Overwrite single fixed filename 'dental_clinic_backup.db'
                    // We use the content of 'processPath' (which might be .enc or .db)
                    // We set description to indicate encryption status
                    const meta = { encrypted: !!options.password };
                    const description = JSON.stringify(meta);
                    // Always upload as 'dental_clinic_backup.db' to maintain the "Single File" rule
                    // But if it is encrypted, the CONTENT is encrypted.
                    // The Frontend will need to read description to know.
                    // If we MUST use .db extension, ensure mime type fits.
                    cloudResult = await googleDriveService.uploadFile(processPath, 'dental_clinic_backup.db', 'application/octet-stream', // Binary stream is safe for both
                    description);
                }
            }
            // 4. Local Mirror
            if (mode === 'local' || mode === 'both') {
                const localPath = store.get(LOCAL_BACKUP_PATH_KEY);
                if (localPath && fs.existsSync(localPath)) {
                    // Local backups KEEP the timestamped name for history
                    const localFile = path.join(localPath, finalFileName);
                    fs.copyFileSync(processPath, localFile);
                    this.pruneLocalBackups(localPath);
                    localResult = true;
                }
            }
            // Cleanup temp
            if (fs.existsSync(processPath))
                fs.unlinkSync(processPath);
            const nowStr = new Date().toISOString();
            store.set('last_backup_timestamp', nowStr);
            return { success: true, cloud: !!cloudResult, local: localResult, timestamp: new Date() };
        }
        catch (error) {
            console.error('Backup failed:', error);
            return { success: false, error: error.message };
        }
    }
    getLastBackupDate() {
        return store.get('last_backup_timestamp');
    }
    verifyBackupOwnership(backupPath, emailToVerify, force = false) {
        let db;
        try {
            db = new Database(backupPath, { readonly: true, fileMustExist: true });
            const stmt = db.prepare("SELECT email FROM clinic_settings LIMIT 1");
            const result = stmt.get();
            // If the backup has no configured email, it's considered "open" or legacy
            if (!result || !result.email) {
                return true;
            }
            const backupEmail = result.email;
            // If we don't have an email to verify against, we must fail and ask for it
            if (!emailToVerify) {
                // If forced, we allow? No, if we don't know who is restoring, maybe we shouldn't unless explicitly forced?
                if (force)
                    return true;
                throw new Error(`SECURITY_REQUIRED:${backupEmail}`); // Special error to trigger UI prompt
            }
            if (backupEmail.trim().toLowerCase() !== emailToVerify.trim().toLowerCase()) {
                if (force) {
                    console.warn(`[Security] Force restoring backup owned by ${backupEmail} to user ${emailToVerify}`);
                    return true;
                }
                throw new Error(`SECURITY_MISMATCH:${backupEmail}`);
            }
            return true;
        }
        catch (error) {
            if (error.message.startsWith('SECURITY_REQUIRED'))
                throw error;
            if (error.message.startsWith('SECURITY_MISMATCH'))
                throw error;
            console.warn('Backup verification warning (might be old DB version):', error.message);
            // If table doesn't exist etc, we might assume it's valid or fail. 
            // Let's assume valid if table missing (very old backup)
            return true;
        }
        finally {
            if (db)
                db.close();
        }
    }
    verifyDatabaseIntegrity(dbPath) {
        let tempDb;
        try {
            // 1. Basic File Header Check
            const fd = fs.openSync(dbPath, 'r');
            const header = Buffer.alloc(16);
            fs.readSync(fd, header, 0, 16, 0);
            fs.closeSync(fd);
            if (!header.toString().startsWith('SQLite format 3')) {
                console.error('[Integrity] Invalid SQLite Header');
                return false;
            }
            // 2. PRAGMA integrity_check
            tempDb = new Database(dbPath, { readonly: true, fileMustExist: true });
            const rows = tempDb.pragma('integrity_check');
            if (Array.isArray(rows) && rows.length > 0 && rows[0].integrity_check === 'ok') {
                return true;
            }
            console.warn('[Integrity Check Failed]', rows);
            return false;
        }
        catch (e) {
            console.error('[Integrity Check Error]', e);
            return false;
        }
        finally {
            if (tempDb)
                tempDb.close();
        }
    }
    backupCurrentLicense() {
        try {
            console.log('[BackupService] Preserving current license info...');
            // Capture ALL license related keys
            const licenseData = {
                cache: appMetaService.get('license_cache_encrypted'),
                keyMasked: appMetaService.get('license_key_masked'),
                expiresAt: appMetaService.get('license_expires_at'),
                lastCheck: appMetaService.get('last_license_check_at'),
                fingerprint: appMetaService.get('device_fingerprint'),
                unlockUntil: appMetaService.get('support_unlock_until'),
                status: appMetaService.get('license_status'),
                type: appMetaService.get('license_type'),
                ownerEmail: appMetaService.get('owner_email') // Save owner email if localized
            };
            return licenseData;
        }
        catch (e) {
            console.warn('[BackupService] Failed to read current license:', e);
            // If we fail to read license, we should probably warn or return empty object
            // Just returning null might cause overwrite later if logic depends on it
            return null;
        }
    }
    restoreLicense(data) {
        if (!data)
            return;
        try {
            console.log('[BackupService] Re-injecting preserved license info...');
            // The DB connection should be open to the NEW database now
            // We blindly restore everything we saved
            if (data.cache)
                appMetaService.set('license_cache_encrypted', data.cache);
            if (data.keyMasked)
                appMetaService.set('license_key_masked', data.keyMasked);
            if (data.expiresAt)
                appMetaService.set('license_expires_at', data.expiresAt);
            if (data.lastCheck)
                appMetaService.set('last_license_check_at', data.lastCheck);
            if (data.fingerprint)
                appMetaService.set('device_fingerprint', data.fingerprint);
            if (data.unlockUntil)
                appMetaService.set('support_unlock_until', data.unlockUntil);
            if (data.status)
                appMetaService.set('license_status', data.status);
            if (data.type)
                appMetaService.set('license_type', data.type);
            if (data.ownerEmail)
                appMetaService.set('owner_email', data.ownerEmail);
        }
        catch (e) {
            console.error('[BackupService] Failed to write license info to new DB:', e);
            throw new Error('LICENSE_RESTORE_FAILED');
        }
    }
    /**
     * Removes all license-related data from a database file.
     * Used before encryption (backup) and after copy (restore).
     */
    sanitizeDatabase(targetDbPath) {
        let db;
        try {
            db = new Database(targetDbPath, { fileMustExist: true });
            // 1. Remove License Table if exists
            db.prepare("DROP TABLE IF EXISTS licenses").run();
            // 2. Remove License Keys from app_meta
            const deleteStmt = db.prepare(`
                DELETE FROM app_meta 
                WHERE key LIKE 'license_%' 
                OR key LIKE 'device_%' 
                OR key IN ('support_unlock_until', 'last_license_check_at', 'activation_token')
            `);
            const info = deleteStmt.run();
            console.log(`[BackupService] Sanitized database: removed ${info.changes} license meta-entries from ${path.basename(targetDbPath)}.`);
        }
        catch (e) {
            console.error('[BackupService] Sanitize failed:', e);
            throw new Error('FAILED_TO_SANITIZE_BACKUP');
        }
        finally {
            if (db)
                db.close();
        }
    }
    async rollbackDatabase(originalDbPath, recoveryPath) {
        console.warn('[BackupService] INITIATING ROLLBACK...');
        const { closeConnection } = await import('../db/init.js');
        closeConnection();
        try {
            await new Promise(r => setTimeout(r, 500));
            if (fs.existsSync(recoveryPath)) {
                fs.copyFileSync(recoveryPath, originalDbPath);
                console.log('تم فشل الاستعادة وتم استرجاع قواعد البيانات الأصلية بنجاح');
            }
            else {
                console.error('[BackupService] Rollback failed: Recovery file not found.');
            }
        }
        catch (e) {
            console.error('[BackupService] CRITICAL: Rollback failed:', e);
        }
    }
    async restoreFromCloud(fileId, password, explicitDbPath, verifyEmail, force = false) {
        let downloadPath = '';
        let decryptedPath = '';
        let recoveryPath = '';
        const dbPath = explicitDbPath ? explicitDbPath : this.getDbPath();
        const savedLicense = this.backupCurrentLicense();
        // 1. Authenticate
        try {
            const isAuth = await googleDriveService.isAuthenticated();
            if (!isAuth)
                throw new Error('Not authenticated with Google Drive');
            let targetFileId = fileId;
            let targetFileName = '';
            if (!targetFileId) {
                const file = await googleDriveService.findFile('dental_clinic_backup.db');
                if (!file || !file.id)
                    throw new Error('No backup file found on Drive');
                targetFileId = file.id;
                targetFileName = file.name || 'dental_clinic_backup.db';
            }
            // 2. Metadata Encryption Check (Fast Fail)
            let metadataEncrypted = targetFileName.endsWith('.enc');
            try {
                const meta = await googleDriveService.getFileMetadata(targetFileId);
                if (meta && meta.description) {
                    const desc = JSON.parse(meta.description);
                    if (desc.encrypted)
                        metadataEncrypted = true;
                }
            }
            catch (e) { /* ignore parse error */ }
            if (metadataEncrypted && !password)
                throw new Error('SECURITY_PASSWORD_REQUIRED');
            const tempPath = this.getTempPath();
            downloadPath = path.join(tempPath, `restore_temp_${Date.now()}.download`);
            console.log('Downloading backup ID:', targetFileId);
            await googleDriveService.downloadFile(targetFileId, downloadPath);
            // 3. Physical Encryption Check (Definitive)
            const isEncrypted = await cryptoService.isEncryptedFile(downloadPath);
            if (isEncrypted && !password) {
                // Clean up and request password
                if (fs.existsSync(downloadPath))
                    fs.unlinkSync(downloadPath);
                throw new Error('SECURITY_PASSWORD_REQUIRED');
            }
            let candidateDbPath = downloadPath;
            if (isEncrypted && password) {
                decryptedPath = path.join(tempPath, `restore_decrypted_${Date.now()}.db`);
                await cryptoService.decryptBackup(downloadPath, decryptedPath, password);
                candidateDbPath = decryptedPath;
            }
            // 4. Verification & Restore
            console.log('[Restore] Verifying integrity of downloaded database...');
            if (!this.verifyDatabaseIntegrity(candidateDbPath)) {
                // If we decrypted and it failed integrity, it MIGHT be wrong password (if auth tag passed but content garbage)
                // But typically GCM auth tag prevents this. 
                // However, let's stick to CORRUPT for actual sqlite corruption.
                throw new Error('CORRUPTED_FILE');
            }
            this.verifyBackupOwnership(candidateDbPath, verifyEmail || null, force);
            // AUTO-RECOVERY SNAPSHOT
            if (fs.existsSync(dbPath)) {
                try {
                    recoveryPath = path.join(path.dirname(dbPath), 'auto_recovery.db');
                    fs.copyFileSync(dbPath, recoveryPath);
                }
                catch (e) {
                    console.warn('[Restore] Failed to create auto-recovery backup', e);
                }
            }
            // OVERWRITE (CRITICAL SECTION)
            const { closeConnection } = await import('../db/init.js');
            closeConnection();
            try {
                await new Promise(r => setTimeout(r, 1000));
                fs.copyFileSync(candidateDbPath, dbPath);
                console.log('[Restore] Database file replaced.');
                // SANITIZE NEW DB (Ensure no foreign license data persists)
                this.sanitizeDatabase(dbPath);
                // RE-OPEN & RESTORE LICENSE
                const db = await import('../db/init.js');
                await db.openDatabase();
                if (savedLicense) {
                    this.restoreLicense(savedLicense);
                }
                else {
                    console.warn('[Restore] Warning: No previous license info was saved.');
                }
                console.log('[Restore] Restore sequence complete.');
            }
            catch (e) {
                console.error('[Restore] Error during overwrite/license-restore sequence:', e);
                throw e;
            }
            // Cleanup
            if (fs.existsSync(downloadPath))
                fs.unlinkSync(downloadPath);
            if (decryptedPath && fs.existsSync(decryptedPath))
                fs.unlinkSync(decryptedPath);
            return { success: true };
        }
        catch (error) {
            console.error('Restore failed:', error);
            if (recoveryPath && fs.existsSync(recoveryPath)) {
                await this.rollbackDatabase(dbPath, recoveryPath);
            }
            if (downloadPath && fs.existsSync(downloadPath))
                fs.unlinkSync(downloadPath);
            if (decryptedPath && fs.existsSync(decryptedPath))
                fs.unlinkSync(decryptedPath);
            return { success: false, error: error.message };
        }
    }
    async restoreFromLocalFile(filePath, password, explicitDbPath, verifyEmail) {
        let decryptedPath = '';
        let recoveryPath = '';
        const dbPath = explicitDbPath ? explicitDbPath : this.getDbPath();
        const savedLicense = this.backupCurrentLicense();
        try {
            if (!fs.existsSync(filePath))
                throw new Error('File not found');
            // 1. Detection
            const isEncrypted = await cryptoService.isEncryptedFile(filePath);
            // 2. Password Check
            if (isEncrypted && !password)
                throw new Error('SECURITY_PASSWORD_REQUIRED');
            let candidateDbPath = filePath;
            const tempPath = this.getTempPath();
            // 3. Decryption
            if (isEncrypted && password) {
                decryptedPath = path.join(tempPath, `restore_local_decrypted_${Date.now()}.db`);
                await cryptoService.decryptBackup(filePath, decryptedPath, password);
                candidateDbPath = decryptedPath;
            }
            // 4. Integrity Check
            console.log('[Restore] Verifying integrity of local database...');
            if (!this.verifyDatabaseIntegrity(candidateDbPath)) {
                throw new Error('CORRUPTED_FILE');
            }
            this.verifyBackupOwnership(candidateDbPath, verifyEmail || null);
            // 5. Auto Recovery
            if (fs.existsSync(dbPath)) {
                try {
                    recoveryPath = path.join(path.dirname(dbPath), 'auto_recovery.db');
                    fs.copyFileSync(dbPath, recoveryPath);
                }
                catch (e) {
                    console.warn('[Restore] Failed to create auto-recovery backup', e);
                }
            }
            // 6. Overwrite
            const { closeConnection, openDatabase } = await import('../db/init.js');
            closeConnection();
            try {
                await new Promise(r => setTimeout(r, 500));
                fs.copyFileSync(candidateDbPath, dbPath);
                console.log('[Restore] Local database replaced.');
                // SANITIZE NEW DB
                this.sanitizeDatabase(dbPath);
                await openDatabase(); // Re-open
                if (savedLicense) {
                    this.restoreLicense(savedLicense);
                }
            }
            catch (e) {
                console.error('[Restore] Error during local overwrite/license restore:', e);
                throw e;
            }
            if (password && fs.existsSync(decryptedPath))
                fs.unlinkSync(decryptedPath);
            return { success: true };
        }
        catch (error) {
            console.error('Local Restore failed:', error);
            if (recoveryPath && fs.existsSync(recoveryPath)) {
                await this.rollbackDatabase(dbPath, recoveryPath);
            }
            if (decryptedPath && fs.existsSync(decryptedPath))
                fs.unlinkSync(decryptedPath);
            return { success: false, error: error.message };
        }
    }
    /* Private methods for Encryption/Zip removed as requested */
    pruneLocalBackups(dir) {
        // Keep last 10 .db or .enc files
        const files = fs.readdirSync(dir)
            .filter(f => f.startsWith('dental_backup_') && (f.endsWith('.db') || f.endsWith('.enc')))
            .map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);
        if (files.length > BACKUP_RETENTION_COUNT) {
            const toDelete = files.slice(BACKUP_RETENTION_COUNT);
            toDelete.forEach(f => fs.unlinkSync(path.join(dir, f.name)));
        }
    }
    async pruneCloudBackups() {
        try {
            const files = await googleDriveService.listFiles(50); // Fetch more to check retention
            const backupFiles = files.filter((f) => f.name.startsWith('dental_backup_'));
            if (backupFiles.length > BACKUP_RETENTION_COUNT) {
                const toDelete = backupFiles.slice(BACKUP_RETENTION_COUNT);
                console.log(`Pruning ${toDelete.length} old cloud backups...`);
                for (const file of toDelete) {
                    if (file.id) {
                        await googleDriveService.deleteFile(file.id);
                    }
                }
            }
        }
        catch (e) {
            console.warn('Failed to prune cloud backups', e);
        }
    }
    getLocalPath() {
        return store.get(LOCAL_BACKUP_PATH_KEY);
    }
    setLocalPath(p) {
        store.set(LOCAL_BACKUP_PATH_KEY, p);
    }
    async checkAndRunScheduledBackup() {
        try {
            const frequency = store.get('backup_frequency', 'off');
            if (frequency === 'off')
                return;
            const lastBackupStr = store.get('last_backup_timestamp');
            const lastBackup = lastBackupStr ? new Date(lastBackupStr).getTime() : 0;
            const now = Date.now();
            let intervalMs = 0;
            if (frequency === 'daily')
                intervalMs = 24 * 60 * 60 * 1000;
            else if (frequency === 'weekly')
                intervalMs = 7 * 24 * 60 * 60 * 1000;
            else if (frequency === 'monthly')
                intervalMs = 30 * 24 * 60 * 60 * 1000;
            if (now - lastBackup >= intervalMs) {
                console.log(`Auto-Backup triggered (Frequency: ${frequency})`);
                await this.performBackup();
                // performBackup updates timestamp? No, it returns it. We should save it here or inside performBackup.
                // Actually performBackup runs logic, returns result. We can update store here safely.
                store.set('last_backup_timestamp', new Date().toISOString());
            }
        }
        catch (error) {
            console.error('Scheduled backup check failed:', error);
        }
    }
    getSchedule() {
        return store.get('backup_frequency', 'off');
    }
    setSchedule(frequency) {
        store.set('backup_frequency', frequency);
    }
}
export const backupService = new BackupService();
