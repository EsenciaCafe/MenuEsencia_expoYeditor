

// tools/gen_media_index.mjs
// Genera v2.0/media/index.json a partir de los ficheros presentes en esa carpeta.
// Ejecuta: node tools/gen_media_index.mjs

import { readdir, stat, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carpeta donde están las imágenes
const mediaDir = path.resolve(__dirname, '../media');
const outFile = path.join(mediaDir, 'index.json');

const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);

function toAlt(name){
  return name.replace(/\.[^.]+$/, '')
             .replace(/[-_]+/g, ' ')
             .replace(/\s+/g, ' ')
             .trim()
             .replace(/\b\w/g, c => c.toUpperCase());
}

async function main(){
  let files;
  try {
    files = await readdir(mediaDir);
  } catch (e) {
    console.error(`❌ No se pudo leer la carpeta: ${mediaDir}`);
    console.error('Asegúrate de que existe v2.0/media');
    process.exit(1);
  }

  const images = [];
  for (const f of files){
    if (f === 'index.json') continue; // evitamos auto-incluir el manifiesto
    const ext = path.extname(f).toLowerCase();
    if (!exts.has(ext)) continue;
    const full = path.join(mediaDir, f);
    try {
      const st = await stat(full);
      if (!st.isFile()) continue;
    } catch {
      continue;
    }
    images.push({ name: f, src: `./${f}`, alt: toAlt(f) });
  }

  // Orden alfabético estable
  images.sort((a,b)=> a.name.localeCompare(b.name, 'es'));

  const json = { images };
  const pretty = JSON.stringify(json, null, 2) + '\n';

  await writeFile(outFile, pretty, 'utf8');
  console.log(`✅ Generado ${outFile} con ${images.length} imagen(es).`);
}

main().catch(err => {
  console.error('❌ Error generando el índice:', err);
  process.exit(1);
});