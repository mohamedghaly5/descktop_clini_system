
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run this from the project root
const destDir = 'dist-electron';
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

const destFile = path.join(destDir, 'package.json');
const content = '{"type": "commonjs"}';

try {
    fs.writeFileSync(destFile, content);
    console.log(`Created ${destFile} with "type": "commonjs"`);
} catch (error) {
    console.error(`Failed to create ${destFile}:`, error);
    process.exit(1);
}
