import fs from 'fs';
import path from 'path';
import TurndownService from 'turndown';
import yaml from 'js-yaml';
import { format } from 'fast-csv';
import type { FrontMatter, ZendeskArticle } from './types.js';

// Assumes npm -w tools/ingest runs with cwd=tools/ingest
const ROOT = path.resolve(process.cwd(), '..', '..');           // C:\Dev\kb-forge
const IMPORTS = path.join(ROOT, 'imports');                      // C:\Dev\kb-forge\imports
const OUT_DIR = path.join(ROOT, 'data', 'kb_md');                // C:\Dev\kb-forge\data\kb_md
const CSV_PATH = path.join(ROOT, 'data', 'articles.csv');       // C:\Dev\kb-forge\data\articles.csv

const turndown = new TurndownService({ headingStyle: 'atx' });
const ensure = (p:string) => fs.mkdirSync(p, { recursive: true });
const slug = (s:string) => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
const fm = (m:FrontMatter) => '---\n' + yaml.dump(m, { lineWidth: 120 }).trim() + '\n---\n';

function convert(a: ZendeskArticle) {
  const meta: FrontMatter = {
    zendesk_id: a.id,
    title: (a.title || ('untitled-' + a.id)).replace(/\n/g,' ').trim(),
    category: a.category || 'uncategorized',
    section: a.section || 'misc',
    labels: a.label_names || [],
    audience: a.audience || 'internal',
    product: a.product || '',
    status: a.draft ? 'draft' : 'active',
    owner: a.author_id ?? '',
    created_at: a.created_at || '',
    updated_at: a.updated_at || '',
    source_url: a.html_url || '',
    locale: a.locale || 'en-us'
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

  const folder = path.join(OUT_DIR, meta.category, meta.section);
  ensure(folder);
  const fname = `${slug(meta.title)}--${meta.zendesk_id}.md`;
  const fpath = path.join(folder, fname);
  fs.writeFileSync(fpath, fm(meta) + tldr + mdBody + '\n', 'utf8');

  return { meta, rel: path.relative(path.join(ROOT, 'data'), fpath).replace(/\\/g,'/') };
}

function readAllJson(): ZendeskArticle[] {
  ensure(IMPORTS);
  const files = fs.readdirSync(IMPORTS).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('No JSON files in /imports. Place your Zendesk export(s) there.');
    return [];
  }
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
      labels: meta.labels.join('|'),
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
