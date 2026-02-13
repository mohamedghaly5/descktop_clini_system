
import sharp from 'sharp';
import fs from 'fs';

const src = 'assets/logo.png';
const dest = 'assets/logo_fixed.png';

async function fixIcon() {
    try {
        console.log(`Processing ${src}...`);

        // 1. Load image
        let img = sharp(src);
        const metadata = await img.metadata();
        console.log(`Original dimensions: ${metadata.width}x${metadata.height}`);

        // 2. Trim green borders (uses top-left pixel color)
        // We set a threshold to catch slightly varying green pixels
        img = img.trim({ threshold: 50 });

        // Get trimmed metadata
        // Note: to get buffer and reload to check new dimensions
        const trimmedBuffer = await img.toBuffer();
        const trimmedImg = sharp(trimmedBuffer);
        const trimmedMeta = await trimmedImg.metadata();
        console.log(`Trimmed dimensions: ${trimmedMeta.width}x${trimmedMeta.height}`);

        // 3. Crop bottom to remove text (assume text is in bottom 25%)
        // The logo should be centered in the remaining top part
        const cropHeight = Math.floor(trimmedMeta.height * 0.75); // Keep top 75%
        console.log(`Cropping to height: ${cropHeight} (removing bottom 25% for text)`);

        img = trimmedImg.extract({
            left: 0,
            top: 0,
            width: trimmedMeta.width,
            height: cropHeight
        });

        // 4. Square it up on a white background
        // Find the max dimension to make it square
        const size = Math.max(trimmedMeta.width, cropHeight);
        const padding = Math.floor(size * 0.1); // Add 10% padding
        const finalSize = size + (padding * 2);

        console.log(`Final output size: ${finalSize}x${finalSize} (with white background)`);

        await img
            .resize(size, size, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 } // Transparent background for the logo itself
            })
            .extend({
                top: padding,
                bottom: padding,
                left: padding,
                right: padding,
                background: { r: 255, g: 255, b: 255, alpha: 1 } // White background for the icon
            })
            .toFile(dest);

        console.log(`Saved fixed icon to ${dest}`);

    } catch (err) {
        console.error('Error fixing icon:', err);
        process.exit(1);
    }
}

fixIcon();
