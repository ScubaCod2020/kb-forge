import fs from 'fs';
import path from 'path';
import readline from 'readline';

const ROOT = path.resolve(process.cwd(), '..', '..');
const IMPORTS = path.join(ROOT, 'imports');
const OUT_MD = path.join(ROOT, 'data', 'kb_md');
const OUT_CSV = path.join(ROOT, 'data', 'articles.csv');

type Row = {
  brand_name?: string;
  brand_subdomain?: string;
  id?: string; title?: string; html_url?: string;
  section_id?: string; section_name?: string;
  category_id?: string; category_name?: string;
  permission_group_id?: string; permission_group_name?: string;
  user_segment_id?: string; user_segment_ids?: string; user_segment_name?: string; user_segment_names?: string;
  label_names?: string;
  content_tag_ids?: string; content_tag_names?: string;
  comments_disabled?: string; draft?: string; promoted?: string; position?: string;
  vote_sum?: string; vote_count?: string; outdated?: string;
  created_at?: string; edited_at?: string; updated_at?: string;
  author_id?: string; author_name?: string;
  body_text?: string; body_links?: string;
};

function listEnrichedCSVs(): string[] {
  const list = fs.readdirSync(IMPORTS).filter(f =>
    /^helpcenter_\d{4}-\d{2}-\d{2}\.all_articles_enriched\.csv$/i.test(f)
  );
  return list.map(f => path.join(IMPORTS, f));
}

function sanitizeFileName(s: string, id: string): string {
  const base = (s || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${base}--${id}.md`;
}

function ensureDir(p: string) { fs.mkdirSync(p, { recursive: true }); }

function parseCsvLine(line: string, headers: string[]): Row {
  // Simple CSV parser: split on commas, respecting quotes
  const out: string[] = [];
  let cur = ''; let inQ = false;
  for (let i=0;i<line.length;i++){
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { out.push(cur); cur=''; continue; }
    cur += ch;
  }
  out.push(cur);
  const row: any = {};
  headers.forEach((h, i) => row[h] = (out[i] ?? '').trim());
  return row as Row;
}

function asList(piped?: string): string[] {
  return String(piped || '').split('|').map(s => s.trim()).filter(Boolean);
}

function truthy(s?: string): boolean {
  const v = String(s || '').toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes' || v === 'y';
}

function fmLine(key: string, val: string | string[] | undefined) {
  if (Array.isArray(val)) return `${key}: [${val.map(v => JSON.stringify(v)).join(', ')}]`;
  if (val == null || val === '') return `${key}:`;
  return `${key}: ${JSON.stringify(val)}`;
}

async function ingestCsv(file: string) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  let headers: string[] = [];
  let wrote = 0;

  ensureDir(OUT_MD);
  const articleRows: string[] = [];
  let isHeader = true;

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isHeader) { headers = line.split(',').map(h => h.trim()); isHeader = false; continue; }
    const row = parseCsvLine(line, headers);
    const id = row.id || '';
    if (!id) continue;

    const brand = row.brand_name || '';
    const section = row.section_name || '';
    const category = row.category_name || '';
    const title = row.title || '';

    const labels = asList(row.label_names);
    const tags = asList(row.content_tag_names);
    const links = asList(row.body_links);

    // Folder structure: /data/kb_md/<Brand>/<Section>/
    const dir = path.join(OUT_MD, sanitizeFileName(brand, ''), sanitizeFileName(section, '').replace(/--\.md$/, ''));
    ensureDir(dir);
    const fileName = sanitizeFileName(title, id);
    const abs = path.join(dir, fileName);

    const fm = [
      '---',
      fmLine('zendesk_id', id),
      fmLine('title', title),
      fmLine('owner', ''), // governance: to-be-filled team owner
      fmLine('audience', 'external'),
      fmLine('brand', brand),
      fmLine('brand_subdomain', row.brand_subdomain || ''),
      fmLine('category', category),
      fmLine('category_id', row.category_id || ''),
      fmLine('section', section),
      fmLine('section_id', row.section_id || ''),
      fmLine('permission_group', row.permission_group_name || ''),
      fmLine('user_segment', row.user_segment_name || ''),
      fmLine('user_segment_ids', asList(row.user_segment_ids)),
      fmLine('labels', labels),
      fmLine('content_tags', tags),
      fmLine('promoted', truthy(row.promoted) ? 'true' : 'false'),
      fmLine('updated_at', row.updated_at || ''),
      fmLine('created_at', row.created_at || ''),
      fmLine('source_url', row.html_url || ''),
      fmLine('author_id', row.author_id || ''),
      fmLine('author_name', row.author_name || ''),
      fmLine('cadence', ''), // optional: let linter infer if blank
      '---',
      '',
      `> **Summary:** (≤75 words; outcome-first)`,
      `> **When to use:** • …`,
      `> **Gotchas:** • …`,
      `<!-- REGENERATE_TLDR -->`,
      '',
      '# Why this matters',
      '',
      '# Steps',
      '1. …',
      '',
      '## Validation / Troubleshooting',
      '- …',
      '',
      '## References',
      ...links.map(u => `- ${u}`),
      '',
      '---',
      '',
      (row.body_text || '').trim()
    ].join('\n');

    fs.writeFileSync(abs, fm, 'utf8');
    wrote++;

    // For articles.csv aggregation (minimal row; linter may augment later)
    const agg = [
      abs.replace(/\\/g,'/'),
      id,
      JSON.stringify(title).slice(1, -1),
      category,
      section,
      labels.join('|'),
      row.updated_at || '',
      truthy(row.promoted) ? 'true' : 'false',
      '' /* quality_score */,
      '' /* lint_flags */,
      '' /* cadence (optional explicit) */
    ].map(v => String(v ?? ''));

    articleRows.push(agg.join(','));
  }

  // Write/merge data/articles.csv (simple rewrite for now)
  const header = [
    'path','zendesk_id','title','category','section','labels','updated_at','promoted','quality_score','lint_flags','cadence'
  ].join(',');
  fs.writeFileSync(OUT_CSV, [header, ...articleRows].join('\n') + '\n', 'utf8');

  return wrote;
}

async function main() {
  const files = listEnrichedCSVs();
  if (!files.length) { console.log('No enriched CSV found in /imports'); return; }
  let total = 0;
  for (const f of files) {
    console.log('Ingesting CSV:', path.basename(f));
    total += await ingestCsv(f);
  }
  console.log(`Wrote ${total} markdown files; updated data/articles.csv`);
}

main().catch(e => { console.error(e); process.exit(1); });
