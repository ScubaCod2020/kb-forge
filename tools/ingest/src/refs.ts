import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { globby } from 'globby';

// Paths based on running in tools/ingest
const ROOT = path.resolve(process.cwd(), '..', '..');
const IMPORTS = path.join(ROOT, 'imports');
const OUT = path.join(ROOT, 'data', 'references');

const ensure = (p:string) => fs.mkdirSync(p, { recursive: true });
const slug = (s:string) => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);

async function docxToMd(file:string){
  const res = await mammoth.convertToMarkdown({ path: file });
  return res.value.trim();
}
async function pdfToMd(file:string){
  const buf = fs.readFileSync(file);
  const data = await pdf(buf);
  const t = (data.text || '').replace(/\r\n/g,'\n').trim();
  return t ? '\n\n````\n' + t + '\n````\n' : '';
}

(async function run(){
  ensure(IMPORTS); ensure(OUT);
  const files = await globby(['**/*.pdf','**/*.docx'], { cwd: IMPORTS, absolute: true });
  if (files.length === 0) {
    console.log('No PDF/DOCX files in /imports to ingest.');
    return;
  }
  let count = 0;
  for (const f of files) {
    const base = path.basename(f);
    const name = slug(base.replace(/\.(pdf|docx)$/i,''));
    const out = path.join(OUT, name + '.md');
    let md = '';
    if (/\.docx$/i.test(f)) md = await docxToMd(f);
    else md = await pdfToMd(f);
    const header = `---\ntitle: ${base}\nsource_path: ${path.relative(ROOT, f).replace(/\\/g,'/')}\n---\n\n`;
    fs.writeFileSync(out, header + md, 'utf8');
    count++;
  }
  console.log(`Imported references: ${count}`);
})();
