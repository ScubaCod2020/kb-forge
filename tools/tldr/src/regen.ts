import fs from 'fs'; import path from 'path';
import { glob } from 'glob';
import { getProvider } from './provider.js';

const ROOT = path.resolve(process.cwd(), '..', '..');            // repo root
const KB_DIR = path.join(ROOT, 'data', 'kb_md');

const TLDR_START = '> **Summary (draft):';
const TLDR_MARK  = '<!-- REGENERATE_TLDR -->';

const system = `You are a concise Knowledge Base editor.
Return ONLY a markdown block that replaces the TL;DR area.
Format:
> **Summary:** <1-2 sentences>
> **When to use:** <bulleted 2-4 items>
> **Gotchas:** <bulleted 2-4 items>
No extra commentary.`;

function replaceTldr(md: string, tldr: string) {
  const lines = md.split('\n');
  const start = lines.findIndex(l => l.startsWith('---')) + 1;
  let i = lines.findIndex((l, idx) => idx > start && l.startsWith(TLDR_START));
  const markIdx = lines.findIndex(l => l.includes(TLDR_MARK));
  if (i === -1 || markIdx === -1) return null;
  // Replace from first TLDR line up to marker
  const before = lines.slice(0, i).join('\n');
  const after  = lines.slice(markIdx).join('\n');
  return `${before}\n${tldr.trim()}\n\n${after}`;
}

async function main() {
  const provider = getProvider();
  const pattern = process.env.GLOB || '**/*.md';
  const files = await glob(pattern, { cwd: KB_DIR, absolute: true });
  if (!files.length) { console.log('No markdown files found in data/kb_md'); return; }

  let changed = 0, skipped = 0;
  for (const f of files) {
    const md = fs.readFileSync(f, 'utf8');
    if (!md.includes(TLDR_MARK)) { skipped++; continue; }
    const bodyOnly = md.split('---').slice(2).join('---').trim().slice(0, 6000);
    const prompt = `Article body:\n\n${bodyOnly}\n\nWrite the TL;DR block as specified.`;
    const tldr = await provider.generate({ prompt, system });
    const replaced = replaceTldr(md, tldr);
    if (!replaced) { skipped++; continue; }
    fs.writeFileSync(f, replaced, 'utf8');
    console.log('Updated TL;DR →', path.relative(KB_DIR, f));
    changed++;
  }
  console.log(`TL;DR regen complete: changed=${changed}, skipped=${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
