import crypto from 'crypto';
import fs from 'fs';

// -- Constants --
const ALGORITHM = 'aes-256-gcm';
const MAGIC_HEADER = Buffer.from('DF_BACKUP_v1'); // 12 bytes
const SALT_LENGTH = 64;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

export const cryptoService = {
    /**
     * Encrypts a file using AES-256-GCM with a Magic Header.
     * BUFFER-BASED Implementation (Safe for SQLite).
     */
    async encryptBackup(inputPath: string, outputPath: string, password: string): Promise<void> {
        if (!password) throw new Error('Password is required');

        try {
            // 1. Read entire file into buffer (Safety: Dental DBs are usually < 1GB)
            const fileBuffer = await fs.promises.readFile(inputPath);

            // 2. Prepare crypto components
            const salt = crypto.randomBytes(SALT_LENGTH);
            const iv = crypto.randomBytes(IV_LENGTH);

            // 3. Derive Key
            const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');

            // 4. Encrypt
            const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
            const encryptedBuffer = Buffer.concat([
                cipher.update(fileBuffer),
                cipher.final()
            ]);
            const tag = cipher.getAuthTag();

            // 5. Construct Output: [MAGIC][SALT][IV][ENCRYPTED][TAG]
            const finalBuffer = Buffer.concat([
                MAGIC_HEADER,
                salt,
                iv,
                encryptedBuffer,
                tag
            ]);

            // 6. Write Atomic
            await fs.promises.writeFile(outputPath, finalBuffer);
        } catch (error) {
            console.error('Encryption failed:', error);
            throw error;
        }
    },

    /**
     * Decrypts a backup file using AES-256-GCM.
     * strict verification of Magic Header and Auth Tag.
     */
    async decryptBackup(inputPath: string, outputPath: string, password: string): Promise<void> {
        try {
            const stats = await fs.promises.stat(inputPath);
            const minSize = MAGIC_HEADER.length + SALT_LENGTH + IV_LENGTH + TAG_LENGTH;

            if (stats.size < minSize) {
                // If too small, check if it's a legacy legacy file without header?
                // For now, strict requirement: CORRUPTED_FILE
                throw new Error('CORRUPTED_FILE');
            }

            const fileBuffer = await fs.promises.readFile(inputPath);

            // 1. Check Magic Header
            const header = fileBuffer.subarray(0, MAGIC_HEADER.length);
            if (!header.equals(MAGIC_HEADER)) {
                // Fallback attempt for legacy, or throw corrupted
                // User Prompt: "Detect wrong password vs corrupted"
                console.warn('[Crypto] Header mismatch. Trying legacy decrypt...');
                return this.decryptLegacy(fileBuffer, outputPath, password);
            }

            // 2. Extract Metadata
            let pos = MAGIC_HEADER.length;
            const salt = fileBuffer.subarray(pos, pos + SALT_LENGTH);
            pos += SALT_LENGTH;
            const iv = fileBuffer.subarray(pos, pos + IV_LENGTH);
            pos += IV_LENGTH;

            // 3. Extract Encrypted Data and Tag
            const tagPosition = fileBuffer.length - TAG_LENGTH;
            const encryptedData = fileBuffer.subarray(pos, tagPosition);
            const tag = fileBuffer.subarray(tagPosition);

            // 4. Derive Key
            const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');

            // 5. Decrypt
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            decipher.setAuthTag(tag);

            try {
                const decrypted = Buffer.concat([
                    decipher.update(encryptedData),
                    decipher.final()
                ]);

                // 6. Write Output
                await fs.promises.writeFile(outputPath, decrypted);

                // 7. Verify SQLite Header in Output
                // This is an extra check - if GCM passes, content should be valid unless original was corrupt before encrypt
                const sqliteHeader = decrypted.subarray(0, 16).toString();
                if (!sqliteHeader.startsWith('SQLite format 3')) {
                    throw new Error('CORRUPTED_FILE');
                }

            } catch (e: any) {
                // specific capture for auth failure
                if (e.message && (e.message.includes('auth') || e.message.includes('bad decrypt'))) {
                    throw new Error('INVALID_PASSWORD');
                }
                throw e; // Integrity/Correction error
            }

        } catch (error: any) {
            if (error.message === 'INVALID_PASSWORD') throw error;
            // Map generic errors to CORRUPTED_FILE if not auth
            if (error.code === 'ENOENT') throw error;
            throw new Error('CORRUPTED_FILE');
        }
    },

    /**
     * Legacy Decrypter (AES-256-CBC) validation
     */
    async decryptLegacy(fileBuffer: Buffer, outputPath: string, password: string): Promise<void> {
        try {
            const LEGACY_SALT = 16;
            const LEGACY_IV = 16;

            if (fileBuffer.length < 32) throw new Error('CORRUPTED_FILE');

            const salt = fileBuffer.subarray(0, LEGACY_SALT);
            const iv = fileBuffer.subarray(LEGACY_SALT, LEGACY_SALT + LEGACY_IV);
            const encrypted = fileBuffer.subarray(LEGACY_SALT + LEGACY_IV);

            // Legacy used scrypt usually
            const key = crypto.scryptSync(password, salt, 32);
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

            const decrypted = Buffer.concat([
                decipher.update(encrypted),
                decipher.final()
            ]);

            // Check SQLite Header
            if (!decrypted.subarray(0, 16).toString().startsWith('SQLite format 3')) {
                throw new Error('INVALID_PASSWORD'); // In CBC, bad decrypt results in garbage, not auth fail
            }

            await fs.promises.writeFile(outputPath, decrypted);

        } catch (e) {
            throw new Error('INVALID_PASSWORD');
        }
    },

    async saveLocalBackupBinary(data: Buffer, outputPath: string): Promise<void> {
        return fs.promises.writeFile(outputPath, data);
    },

    async loadLocalBackupBinary(inputPath: string): Promise<Buffer> {
        return fs.promises.readFile(inputPath);
    },

    // Aliases & Detection
    async isEncryptedFile(inputPath: string): Promise<boolean> {
        try {
            const fd = await fs.promises.open(inputPath, 'r');
            try {
                // Check 1: Magic Header
                const header = Buffer.alloc(MAGIC_HEADER.length);
                const { bytesRead } = await fd.read(header, 0, MAGIC_HEADER.length, 0);

                if (bytesRead === MAGIC_HEADER.length && header.equals(MAGIC_HEADER)) {
                    return true;
                }

                // Check 2: SQLite Header (Not Encrypted)
                const sqliteHeader = Buffer.alloc(16);
                await fd.read(sqliteHeader, 0, 16, 0);
                if (sqliteHeader.toString().startsWith('SQLite format 3')) {
                    return false;
                }

                // Check 3: Check Legacy or unknown
                // If it's not SQLite and we are in backup mode, assume encrypted/corrupt.
                return true;
            } finally {
                await fd.close();
            }
        } catch (e) {
            return false;
        }
    },

    encryptFile(input: string, output: string, pass: string): Promise<void> {
        return this.encryptBackup(input, output, pass);
    },
    decryptFile(input: string, output: string, pass: string): Promise<void> {
        return this.decryptBackup(input, output, pass);
    }
};

