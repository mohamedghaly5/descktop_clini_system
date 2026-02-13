
import fs from 'fs';
import pngToIco from 'png-to-ico';

const src = 'assets/logo.png';
const dest = 'public/icon.ico';

if (!fs.existsSync(src)) {
    console.error('Source file not found:', src);
    process.exit(1);
}

pngToIco(src)
    .then(buf => {
        fs.writeFileSync(dest, buf);
        console.log('Successfully generated public/icon.ico');
    })
    .catch(err => {
        console.error('Error generating icon:', err);
        process.exit(1);
    });
