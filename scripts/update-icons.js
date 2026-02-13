
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const src = 'assets/logo.png';
const pngDest = 'public/icon.png';
const icnsDest = 'public/icon.ico';

async function updateIcons() {
    try {
        console.log(`Processing ${src}...`);

        // 1. Resize/Normalize to 256x256 PNG
        console.log('Generating 256x256 PNG...');
        await sharp(src)
            .resize(256, 256, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toFile(pngDest);
        console.log(`Saved ${pngDest}`);

        // 2. Generate ICO from the clean PNG
        console.log('Generating ICO...');
        const buf = await pngToIco(pngDest);
        fs.writeFileSync(icnsDest, buf);
        console.log(`Saved ${icnsDest}`);

    } catch (err) {
        console.error('Error updating icons:', err);
        process.exit(1);
    }
}

updateIcons();
