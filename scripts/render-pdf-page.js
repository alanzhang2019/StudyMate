// render a single PDF page to high-res PNG for visual inspection
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const pdf = process.argv[2];
const page = parseInt(process.argv[3], 10);
const out = process.argv[4] || `${path.basename(pdf, '.pdf')}-p${page}.png`;
const dpi = parseInt(process.argv[5] || '400', 10);

fs.mkdirSync(path.dirname(out), { recursive: true });
const code = `import pymupdf
d = pymupdf.open(r'${pdf}')
pix = d[${page - 1}].get_pixmap(dpi=${dpi})
pix.save(r'${out}')
print('Saved', '${out}')`;
execSync(`python -c "${code.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
