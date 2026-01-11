import { google } from 'googleapis';
import { shell } from 'electron';
import fs from 'fs';
import path from 'path';
import Store from 'electron-store';
import http from 'http';
import url from 'url';
const store = new Store();
const TOKEN_PATH = 'token';
// If credentials.json is at root
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
// Scopes
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
export class GoogleDriveService {
    oAuth2Client;
    constructor() {
        this.loadCredentials();
    }
    loadCredentials() {
        if (fs.existsSync(CREDENTIALS_PATH)) {
            const content = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
            const keys = JSON.parse(content);
            const { client_secret, client_id, redirect_uris } = keys.installed || keys.web;
            this.oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000/oauth2callback');
        }
    }
    async authenticate() {
        if (!this.oAuth2Client) {
            throw new Error('credentials.json not found in root directory.');
        }
        const token = store.get(TOKEN_PATH);
        if (token) {
            this.oAuth2Client.setCredentials(token);
            return true; // Already authenticated
        }
        return false; // Need to start flow
    }
    async startAuthFlow() {
        if (!this.oAuth2Client)
            throw new Error('Client not initialized');
        // Create a temporary local server to handle the callback
        return new Promise((resolve, reject) => {
            const server = http.createServer(async (req, res) => {
                if (req.url && req.url.startsWith('/oauth2callback')) {
                    const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
                    const code = qs.get('code');
                    res.end('Authentication successful! You can close this window.');
                    server.close();
                    if (code) {
                        try {
                            const { tokens } = await this.oAuth2Client.getToken(code);
                            this.oAuth2Client.setCredentials(tokens);
                            store.set(TOKEN_PATH, tokens);
                            resolve('Authenticated');
                        }
                        catch (err) {
                            reject(err);
                        }
                    }
                }
            });
            server.listen(3000, () => {
                const authUrl = this.oAuth2Client.generateAuthUrl({
                    access_type: 'offline',
                    scope: SCOPES,
                });
                shell.openExternal(authUrl);
            });
        });
    }
    async isAuthenticated() {
        if (!this.oAuth2Client)
            return false;
        const token = store.get(TOKEN_PATH);
        return !!token;
    }
    async getUserInfo() {
        await this.authenticate();
        const drive = google.drive({ version: 'v3', auth: this.oAuth2Client });
        const res = await drive.about.get({ fields: 'user' });
        return res.data.user;
    }
    async ensureBackupFolder(drive) {
        // Search for folder
        const res = await drive.files.list({
            q: "name = 'Dental Flow Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
            fields: 'files(id, name)',
        });
        if (res.data.files && res.data.files.length > 0) {
            return res.data.files[0].id;
        }
        // Create if not exists
        const folderMetadata = {
            name: 'Dental Flow Backups',
            mimeType: 'application/vnd.google-apps.folder',
        };
        const folder = await drive.files.create({
            requestBody: folderMetadata,
            fields: 'id',
        });
        return folder.data.id;
    }
    async getFileMetadata(fileId) {
        await this.authenticate();
        const drive = google.drive({ version: 'v3', auth: this.oAuth2Client });
        const res = await drive.files.get({
            fileId,
            fields: 'id, name, description, createdTime'
        });
        return res.data;
    }
    async uploadFile(filePath, fileName, mimeType, description) {
        await this.authenticate();
        const drive = google.drive({ version: 'v3', auth: this.oAuth2Client });
        const folderId = await this.ensureBackupFolder(drive);
        // 1. Check if file exists in folder
        const existing = await this.findFile(fileName, folderId);
        const media = {
            mimeType,
            body: fs.createReadStream(filePath),
        };
        const requestBody = {
            name: fileName,
            parents: [folderId],
        };
        if (description !== undefined)
            requestBody.description = description;
        if (existing && existing.id) {
            // Update - separate metadata and media update calls are safer but update handles both if provided
            const res = await drive.files.update({
                fileId: existing.id,
                requestBody: { description }, // Update description
                media,
            });
            return res.data;
        }
        else {
            // Create
            const res = await drive.files.create({
                requestBody,
                media,
                fields: 'id',
            });
            return res.data;
        }
    }
    async findFile(name, folderId) {
        await this.authenticate();
        const drive = google.drive({ version: 'v3', auth: this.oAuth2Client });
        // If searching for default backup file without explicit folder, auto-scope to backup folder
        if ((name === 'dental_clinic_backup.zip' || name === 'dental_clinic_backup.db') && !folderId) {
            folderId = await this.ensureBackupFolder(drive);
        }
        let query = `name = '${name}' and trashed = false`;
        if (folderId) {
            query += ` and '${folderId}' in parents`;
        }
        const res = await drive.files.list({
            q: query,
            fields: 'files(id, name, createdTime, description)',
            orderBy: 'createdTime desc'
        });
        if (res.data.files && res.data.files.length > 0) {
            return res.data.files[0];
        }
        return null;
    }
    async downloadFile(fileId, destPath) {
        await this.authenticate();
        const drive = google.drive({ version: 'v3', auth: this.oAuth2Client });
        const dest = fs.createWriteStream(destPath);
        const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
        return new Promise((resolve, reject) => {
            res.data
                .on('end', () => {
                console.log('Download Done');
                resolve(true);
            })
                .on('error', (err) => {
                console.error('Error downloading file', err);
                reject(err);
            })
                .pipe(dest);
        });
    }
    async listFiles(limit = 20) {
        try {
            await this.authenticate();
            const drive = google.drive({ version: 'v3', auth: this.oAuth2Client });
            const folderId = await this.ensureBackupFolder(drive);
            const res = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'files(id, name, createdTime, size, description)',
                orderBy: 'createdTime desc',
                pageSize: limit
            });
            return res.data.files || [];
        }
        catch (error) {
            console.error('Google Drive List Error:', error);
            // Return empty array to prevent app crash
            return [];
        }
    }
    async deleteFile(fileId) {
        await this.authenticate();
        const drive = google.drive({ version: 'v3', auth: this.oAuth2Client });
        await drive.files.delete({ fileId });
    }
}
export const googleDriveService = new GoogleDriveService();
