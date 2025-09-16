import 'dotenv/config';

export type GenArgs = { prompt: string; system?: string };
export interface Provider { generate(args: GenArgs): Promise<string>; }

class OpenAIProvider implements Provider {
  async generate({ prompt, system }: GenArgs): Promise<string> {
    const key = process.env.OPENAI_API_KEY!;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    if (!key) throw new Error('OPENAI_API_KEY missing');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, messages: [
          system ? { role: 'system', content: system } : undefined,
          { role: 'user', content: prompt }
        ].filter(Boolean)
      })
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status} ${await res.text()}`);
    const j = await res.json();
    return j.choices?.[0]?.message?.content?.trim() || '';
    }
}

class OllamaProvider implements Provider {
  async generate({ prompt, system }: GenArgs): Promise<string> {
    const base = process.env.OLLAMA_BASEURL || 'http://127.0.0.1:11434';
    const model = process.env.OLLAMA_MODEL || 'llama3.1:8b';
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          system ? { role: 'system', content: system } : undefined,
          { role: 'user', content: prompt }
        ].filter(Boolean),
        stream: false
      })
    });
    if (!res.ok) throw new Error(`Ollama ${res.status} ${await res.text()}`);
    const j = await res.json();
    return j.message?.content?.trim() || '';
  }
}

export function getProvider(): Provider {
  const p = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  return p === 'ollama' ? new OllamaProvider() : new OpenAIProvider();
}
