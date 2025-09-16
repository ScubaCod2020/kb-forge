import fs from 'fs';
import path from 'path';

type Dict = Record<string,string>;

/** Loads JSON or CSV (id,name) into a map. */
function loadMap(file: string): Dict {
  if (!fs.existsSync(file)) return {};
  if (file.endsWith('.json')) {
    return JSON.parse(fs.readFileSync(file,'utf8'));
  }
  const txt = fs.readFileSync(file,'utf8').trim();
  const out: Dict = {};
  for (const line of txt.split(/\r?\n/)) {
    const [id, ...rest] = line.split(',');
    const name = rest.join(',').trim();
    if (id && name) out[id.trim()] = name.replace(/^"|"$/g,'');
  }
  return out;
}

export function loadLookups(ROOT: string){
  const L = path.join(ROOT,'imports','lookups');
  const categories = loadMap(path.join(L, 'categories.json'));
  const sections   = loadMap(path.join(L, 'sections.json'));
  const authors    = loadMap(path.join(L, 'authors.json'));
  return { categories, sections, authors };
}
