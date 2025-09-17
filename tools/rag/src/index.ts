import 'dotenv/config';
import fs from 'fs'; import path from 'path';
import express from 'express';
import { cosine } from './embeddings.js';
import { generateText } from './generate.js';
import { AUDIT_SYSTEM, OUTLINE_SYSTEM } from './prompt.js';

const ROOT = path.resolve(process.cwd(), '..', '..');
const KB_DIR = path.join(ROOT, 'data', 'kb_md');
const OUT_PATH = path.join(ROOT, 'data', '.rag', 'index.json');

type Row = { id:string; path:string; title:string; text:string; kind:'kb'|'ref'; embedding:number[] };

function loadIndex(): Row[] {
  if (!fs.existsSync(OUT_PATH)) throw new Error('RAG index missing. Run: npm run rag:index');
  const j = JSON.parse(fs.readFileSync(OUT_PATH,'utf8'));
  return j.rows as Row[];
}

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const k = Math.max(1, Math.min(20, Number(req.query.k || 5)));
    if (!q) return res.status(400).json({ error: 'q required' });

    // lazy embed query with provider used by indexer (same env)
    const { embedBatch } = await import('./embeddings.js');
    const [qv] = await embedBatch([q]);

    const rows = loadIndex();
    const scored = rows.map(r => ({ ...r, score: cosine(qv, r.embedding) }))
                       .sort((a,b)=>b.score - a.score)
                       .slice(0,k)
                       .map(({embedding, ...rest}) => rest);
    res.json({ q, k, results: scored });
  } catch (e:any) { res.status(500).json({ error: e.message }); }
});

app.post('/audit', async (req, res) => {
  try {
    const { path: rel, text } = req.body || {};
    let body = text as string | undefined;
    if (!body && rel) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) return res.status(404).json({ error: 'file not found', path: rel });
      const raw = fs.readFileSync(abs,'utf8');
      body = raw.split('---').slice(2).join('---'); // strip front-matter if present
    }
    if (!body) return res.status(400).json({ error: 'provide path or text' });

    const prompt = [
      'Article excerpt(s):',
      body.slice(0, 6000),
      '',
      'Return JSON with keys: issues[], suggestions[], risks[]'
    ].join('\n');
    const out = await generateText(prompt, AUDIT_SYSTEM);
    res.json({ ok: true, out });
  } catch (e:any) { res.status(500).json({ error: e.message }); }
});

app.post('/train-outline', async (req, res) => {
  try {
    const { topic, audience } = req.body || {};
    if (!topic) return res.status(400).json({ error: 'topic required' });

    const { embedBatch } = await import('./embeddings.js');
    const [qv] = await embedBatch([`${topic} for ${audience || 'general users'}`]);

    const rows = loadIndex();
    const top = rows.map(r => ({...r, score: cosine(qv, r.embedding)}))
                    .sort((a,b)=>b.score - a.score)
                    .slice(0,8);

    const citations = top.map(t => `- [${t.title || t.path}](${t.path})`).join('\n');
    const context = top.map(t => `(${t.kind}) ${t.title}\n${t.text}`).join('\n\n---\n\n');

    const prompt = [
      `Build a training outline for "${topic}" (audience: ${audience || 'general'}).`,
      'Use the following retrieved context:',
      context.slice(0, 7000),
      '',
      'Include a "Links" section with the file paths:',
      citations
    ].join('\n');

    const outline = await generateText(prompt, OUTLINE_SYSTEM);
    res.json({ ok: true, k: top.length, outline, citations: top.map(t=>({title:t.title, path:t.path})) });
  } catch (e:any) { res.status(500).json({ error: e.message }); }
});

const PORT = Number(process.env.RAG_PORT || 7070);
app.listen(PORT, () => console.log(`RAG API on http://localhost:${PORT}`));
