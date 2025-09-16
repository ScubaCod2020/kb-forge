import fs from 'fs';
import path from 'path';
import TurndownService from 'turndown';
import yaml from 'js-yaml';
import { format } from 'fast-csv';
import type { FrontMatter, ZendeskArticle } from './types.js';
import { loadLookups } from './lookups.js';

const ROOT = path.resolve(process.cwd(), '..', '..');
const IMPORTS = path.join(ROOT, 'imports');
const OUT_DIR = path.join(ROOT, 'data', 'kb_md');
const CSV_PATH = path.join(ROOT, 'data', 'articles.csv');
const LOOKUPS = loadLookups(ROOT);

const turndown = new TurndownService({ headingStyle: 'atx' });
const ensure = (p:string) => fs.mkdirSync(p, { recursive: true });
const slug = (s:string) => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
const fm = (m:FrontMatter & Record<string,unknown>) => '---\n' + yaml.dump(m, { lineWidth: 120 }).trim() + '\n---\n';

function convert(a: ZendeskArticle) {
  const meta: (FrontMatter & Record<string,unknown>) = {
    zendesk_id: a.id,
    title: (a.title || ('untitled-' + a.id)).replace(/\n/g,' ').trim(),
    category: a.category || LOOKUPS.categories?.[String(a.category_id ?? '')] || 'uncategorized',
    section:  a.section  || LOOKUPS.sections?.[String(a.section_id  ?? '')] || 'misc',
    labels: a.label_names || [],
    audience: a.audience || 'internal',
    product: a.product || '',
    status: a.draft ? 'draft' : 'active',
    owner: LOOKUPS.authors?.[String(a.author_id ?? '')] || (a.author_id ?? ''),
    created_at: a.created_at || '',
    updated_at: a.updated_at || '',
    source_url: a.html_url || '',
    locale: a.locale || 'en-us',
    // passthrough IDs for round-trip
    category_id: a.category_id ?? '',
    section_id:  a.section_id  ?? '',
    author_id:   a.author_id   ?? ''
  };

  const mdBody = turndown.turndown(a.body || '').replace(/\r\n/g,'\n').trim();
  const tldr = [
    '> **Summary (draft):** _regen later_',
    '> **When to use:** _TBD_',
    '> **Gotchas:** _TBD_',
    '',
    '<!-- REGENERATE_TLDR -->',
    ''
  ].join('\n');

  const folder = path.join(OUT_DIR, String(meta.category), String(meta.section));
  ensure(folder);
  const fname = `${slug(String(meta.title))}--${meta.zendesk_id}.md`;
  const fpath = path.join(folder, fname);
  fs.writeFileSync(fpath, fm(meta) + tldr + mdBody + '\n', 'utf8');

  return { meta, rel: path.relative(path.join(ROOT, 'data'), fpath).replace(/\\/g,'/') };
}

function readAllJson(): ZendeskArticle[] {
  ensure(IMPORTS);
  const files = fs.readdirSync(IMPORTS).filter(f => f.endsWith('.json'));
  if (files.length === 0) { console.log('No JSON files in /imports.'); return []; }
  let out: ZendeskArticle[] = [];
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(path.join(IMPORTS, f), 'utf8'));
    out.push(...(j.articles ?? j));
  }
  return out;
}

(async function run() {
  ensure(OUT_DIR); ensure(path.dirname(CSV_PATH));
  const articles = readAllJson();
  const rows: any[] = [];
  for (const a of articles) {
    const { meta, rel } = convert(a);
    rows.push({
      path: rel,
      zendesk_id: meta.zendesk_id,
      title: meta.title,
      category: meta.category,
      section: meta.section,
      labels: (meta.labels as string[]).join('|'),
      updated_at: meta.updated_at,
      status: meta.status
    });
  }
  const ws = fs.createWriteStream(CSV_PATH);
  const csv = format({ headers: true });
  csv.pipe(ws);
  rows.forEach(r => csv.write(r));
  csv.end();
  console.log(`Exported ${rows.length} → /data`);
})();