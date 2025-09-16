import fs from 'fs'; import path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const ROOT = path.resolve(process.cwd(), '..', '..');
const KB_DIR = path.join(ROOT, 'data', 'kb_md');
const CSV_PATH = path.join(ROOT, 'data', 'articles.csv');

type Row = Record<string,string>;
const now = new Date();

function scoreArticle(md: string, meta: any){
  const flags: string[] = [];
  let score = 100;

  // Headings & structure
  if (!/^#\s+/m.test(md)) { flags.push('missing_h1'); score -= 10; }
  if (!/^(\d+\)|\d+\.)\s+/m.test(md) && !/^-\s+/m.test(md)) { flags.push('no_steps_or_bullets'); score -= 8; }

  // TL;DR presence
  if (!/Summary \(/.test(md) || !/<!-- REGENERATE_TLDR -->/.test(md)) { flags.push('missing_tldr'); score -= 10; }

  // Labels & owner
  if (!meta?.labels || !meta.labels.length) { flags.push('no_labels'); score -= 6; }
  if (!meta?.owner) { flags.push('no_owner'); score -= 4; }

  // Age
  const upd = meta?.updated_at ? new Date(meta.updated_at) : null;
  const ageDays = upd ? Math.floor((now.getTime() - upd.getTime())/86400000) : 9999;
  if (ageDays > 365) { flags.push('stale_gt_1y'); score -= 10; }
  else if (ageDays > 180) { flags.push('stale_gt_6m'); score -= 6; }

  // Secret-ish patterns
  if (/(api[_-]?key|token|secret)\s*[:=]\s*[A-Za-z0-9_\-]{12,}/i.test(md)) { flags.push('possible_secret'); score -= 20; }
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(md)) { flags.push('possible_ssn'); score -= 20; }

  // Broken image refs (very basic)
  const imgRefs = [...md.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)].map(m=>m[1]);
  if (imgRefs.length && !imgRefs.every(x => x.startsWith('http') || fs.existsSync(path.join(KB_DIR, x)))) {
    flags.push('image_missing'); score -= 6;
  }

  // Floor/ceiling
  if (score < 0) score = 0; if (score > 100) score = 100;
  return { score, flags: flags.join('|') };
}

function readMeta(mdContent: string){
  const parsed = matter(mdContent);
  const fm = parsed.data || {};
  return { meta: fm, content: parsed.content || '' };
}

function loadCsv(): Row[] {
  if (!fs.existsSync(CSV_PATH)) return [];
  const text = fs.readFileSync(CSV_PATH, 'utf8');
  const recs: Row[] = parse(text, { columns: true, skip_empty_lines: true });
  return recs;
}

function writeCsv(rows: Row[]) {
  const csv = stringify(rows, { header: true });
  fs.writeFileSync(CSV_PATH, csv, 'utf8');
}

async function main(){
  const files = await glob('**/*.md', { cwd: KB_DIR, absolute: true });
  if (!files.length) { console.log('No markdown in data/kb_md'); return; }

  // Load existing CSV (if any) and index by path
  const rows = loadCsv();
  const byPath = new Map<string, Row>();
  for (const r of rows) byPath.set(r.path, r);

  // Score each file and merge
  for (const f of files) {
    const md = fs.readFileSync(f, 'utf8');
    const { meta, content } = readMeta(md);
    const rel = path.relative(path.join(ROOT,'data'), f).replace(/\\/g,'/');
    const { score, flags } = scoreArticle(content, meta);

    let row = byPath.get(rel);
    if (!row) row = { path: rel, zendesk_id: String(meta.zendesk_id||''), title: String(meta.title||'') } as Row;
    row.quality_score = String(score);
    row.lint_flags = flags;
    // Preserve existing keys
    byPath.set(rel, { ...row, category: row.category ?? String(meta.category||''), section: row.section ?? String(meta.section||'') });
  }

  // Write back in stable order
  const outRows = [...byPath.values()].sort((a,b)=> (a.title||'').localeCompare(b.title||''));
  writeCsv(outRows);
  console.log(`Lint complete: ${outRows.length} rows updated. Columns now include quality_score and lint_flags.`);
}

main().catch(e => { console.error(e); process.exit(1); });
