import fs from 'fs'; import path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { embedBatch } from './embeddings.js';
import { simpleChunk, Chunk } from './chunk.js';

const ROOT = path.resolve(process.cwd(), '..', '..');
const KB_DIR = path.join(ROOT, 'data', 'kb_md');
const REF_DIR = path.join(ROOT, 'data', 'references');
const OUT_DIR = path.join(ROOT, 'data', '.rag');
const OUT_PATH = path.join(OUT_DIR, 'index.json');

type IndexRow = Chunk & { embedding: number[] };

async function main(){
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const kbFiles = await glob('**/*.md', { cwd: KB_DIR, absolute: true });
  const refFiles = fs.existsSync(REF_DIR) ? await glob('**/*.md', { cwd: REF_DIR, absolute: true }) : [];

  const all: Chunk[] = [];

  for (const f of kbFiles) {
    const md = fs.readFileSync(f,'utf8');
    const parsed = matter(md);
    const body = parsed.content || '';
    const rel = path.relative(ROOT, f).replace(/\\/g,'/');
    all.push(...simpleChunk(body, rel, 'kb'));
  }
  for (const f of refFiles) {
    const md = fs.readFileSync(f,'utf8');
    const rel = path.relative(ROOT, f).replace(/\\/g,'/');
    all.push(...simpleChunk(md, rel, 'ref'));
  }

  if (!all.length) {
    console.log('No content found to index (data/kb_md or data/references).');
    return;
  }

  // Embed in batches
  const batchSize = 64;
  const rows: IndexRow[] = [];
  for (let i=0;i<all.length;i+=batchSize){
    const slice = all.slice(i, i+batchSize);
    const vecs = await embedBatch(slice.map(s => s.text.slice(0, 4000)));
    for (let j=0;j<slice.length;j++){
      rows.push({ ...slice[j], embedding: vecs[j] });
    }
    console.log(`Embedded ${Math.min(i+batchSize, all.length)} / ${all.length}`);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify({ createdAt: new Date().toISOString(), rows }, null, 2), 'utf8');
  console.log(`Indexed ${rows.length} chunks → ${OUT_PATH}`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
