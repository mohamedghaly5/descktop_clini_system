import { app } from 'electron';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
// Manually define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log('🔄 Initializing Environment Variables...');
const envPath = app.isPackaged
    ? path.join(process.resourcesPath, '.env.production')
    : path.join(__dirname, '../.env');
const result = dotenv.config({ path: envPath });
if (result.error) {
    console.warn(`⚠️ Failed to load env from ${envPath}`, result.error);
}
else {
    console.log(`✅ Environment loaded successfully from: ${envPath}`);
}
