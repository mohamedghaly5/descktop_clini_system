
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

// Conf
const fallbackSrc = 'assets/logo.png';

// Desktop Config
const desktopSrc = 'assets/desktop-icon.png';
const desktopDestIco = 'public/icon.ico';
const desktopDestPng = 'public/icon.png'; // Used for some electron/web parts

// Mobile Config (Source for Capacitor)
const mobileSrc = 'assets/mobile-icon.png';
const mobileDest = 'assets/icon.png'; // Capacitor searches for this file to generate android icons

async function updateIcons() {
    try {
        console.log('🔄 Checking icon sources...');

        // 1. Handle Desktop Icon
        let currentDesktopSrc = fs.existsSync(desktopSrc) ? desktopSrc : fallbackSrc;
        if (fs.existsSync(currentDesktopSrc)) {
            console.log(`🖥️  Generating Desktop Icon from: ${currentDesktopSrc}`);

            // Generate PNG for public/
            await sharp(currentDesktopSrc)
                .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toFile(desktopDestPng);

            // Generate ICO
            const buf = await pngToIco(desktopDestPng);
            fs.writeFileSync(desktopDestIco, buf);
            console.log(`   ✅ Created ${desktopDestIco}`);
        } else {
            console.warn('⚠️  No desktop icon source found (checked assets/desktop-icon.png and assets/logo.png)');
        }

        // 2. Handle Mobile Icon
        let currentMobileSrc = fs.existsSync(mobileSrc) ? mobileSrc : fallbackSrc;
        if (fs.existsSync(currentMobileSrc)) {
            console.log(`📱 Generating Mobile Icon Source from: ${currentMobileSrc}`);

            // Just copy/resize to assets/icon.png (Capacitor Source)
            // Capacitor recommends 1024x1024
            await sharp(currentMobileSrc)
                .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toFile(mobileDest);

            console.log(`   ✅ Created ${mobileDest} (Ready for Capacitor gen)`);
        } else {
            console.warn('⚠️  No mobile icon source found');
        }

    } catch (err) {
        console.error('❌ Error updating icons:', err);
        process.exit(1);
    }
}

updateIcons();
