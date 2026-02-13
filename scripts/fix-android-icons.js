
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Source Icon (Full Square Blue)
const srcIcon = 'assets/mobile-icon.png';

// Android Resource Paths
const androidResPath = 'android/app/src/main/res';
const mipmaps = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 }
];

async function updateAndroidIcons() {
    try {
        if (!fs.existsSync(srcIcon)) {
            console.error('❌ Source icon not found:', srcIcon);
            return;
        }

        console.log('🔄 Overwriting Android Icons directly from mobile-icon.png...');

        for (const mip of mipmaps) {
            const destDir = path.join(androidResPath, mip.dir);
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

            // 1. Generate standard square icon (ic_launcher.png)
            await sharp(srcIcon)
                .resize(mip.size, mip.size)
                .toFile(path.join(destDir, 'ic_launcher.png'));

            // 2. Generate round icon (ic_launcher_round.png)
            // We use a circle mask to clip it perfectly
            const circleMask = Buffer.from(
                `<svg><circle cx="${mip.size / 2}" cy="${mip.size / 2}" r="${mip.size / 2}" /></svg>`
            );

            await sharp(srcIcon)
                .resize(mip.size, mip.size)
                .composite([{ input: circleMask, blend: 'dest-in' }])
                .toFile(path.join(destDir, 'ic_launcher_round.png'));

            console.log(`   ✅ Updated ${mip.dir}`);
        }

        console.log('🎉 Done! All Android icons replaced.');

    } catch (err) {
        console.error('❌ Error:', err);
    }
}

updateAndroidIcons();
