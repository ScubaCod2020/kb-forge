import 'dotenv/config';

export async function generateText(prompt: string, system?: string): Promise<string> {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  return provider === 'ollama' ? genOllama(prompt, system) : genOpenAI(prompt, system);
}

async function genOpenAI(prompt: string, system?: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!key) throw new Error('OPENAI_API_KEY missing');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [
      system ? { role: 'system', content: system } : undefined,
      { role: 'user', content: prompt }
    ].filter(Boolean) })
  });
  if (!res.ok) throw new Error(`OpenAI gen ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content?.trim() || '';
}

async function genOllama(prompt: string, system?: string): Promise<string> {
  const base = process.env.OLLAMA_BASEURL || 'http://127.0.0.1:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3.1:8b';
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, stream: false,
      messages: [
        system ? { role: 'system', content: system } : undefined,
        { role: 'user', content: prompt }
      ].filter(Boolean)
    })
  });
  if (!res.ok) throw new Error(`Ollama gen ${res.status} ${await res.text()}`);
  const j = await res.json();
  return (j.message?.content || '').trim();
}
