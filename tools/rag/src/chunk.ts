import { marked } from 'marked';

export type Chunk = { id: string; path: string; title: string; text: string; kind: 'kb'|'ref' };

export function simpleChunk(md: string, path: string, kind: 'kb'|'ref'): Chunk[] {
  // Split by H2/H3 or paragraph length
  const tokens = marked.lexer(md);
  const chunks: Chunk[] = [];
  let buf: string[] = [];
  let title = '';

  for (const tk of tokens) {
    if (tk.type === 'heading' && (tk.depth === 1 || tk.depth === 2 || tk.depth === 3)) {
      flush();
      title = (tk as any).text || title;
      continue;
    }
    // collect paragraph/code/list text
    if (tk.type === 'paragraph' || tk.type === 'text' || tk.type === 'list' || tk.type === 'code') {
      buf.push((tk as any).text || (tk as any).raw || '');
      if (buf.join('\n').length > 1200) flush(); // approx 200 tokens
    }
  }
  flush();

  function flush(){
    const text = buf.join('\n').trim();
    if (text) chunks.push({ id: `${path}#${chunks.length}`, path, title, text, kind });
    buf = [];
  }

  return chunks;
}
