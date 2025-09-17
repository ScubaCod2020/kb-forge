import 'dotenv/config';

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  if (provider === 'ollama') return embedOllama(texts);
  return embedOpenAI(texts);
}

async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
  if (!key) throw new Error('OPENAI_API_KEY missing');
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: texts, model })
  });
  if (!res.ok) throw new Error(`OpenAI embed ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.data.map((d: any) => d.embedding as number[]);
}

async function embedOllama(texts: string[]): Promise<number[][]> {
  const base = process.env.OLLAMA_BASEURL || 'http://127.0.0.1:11434';
  const model = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
  const out: number[][] = [];
  for (const t of texts) {
    const res = await fetch(`${base}/api/embeddings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: t })
    });
    if (!res.ok) throw new Error(`Ollama embed ${res.status} ${await res.text()}`);
    const j = await res.json();
    out.push(j.embedding);
  }
  return out;
}

export function cosine(a: number[], b: number[]): number {
  let dot=0, na=0, nb=0;
  for (let i=0;i<a.length;i++){ dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
  return dot / (Math.sqrt(na)*Math.sqrt(nb) + 1e-9);
}
