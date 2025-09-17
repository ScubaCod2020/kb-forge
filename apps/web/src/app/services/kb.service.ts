import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http'; 
import { map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs'; 
import { Logger } from '../core/logger.service';
import { ArticleRow } from '../models/article';
import { cadenceStatus, daysSince, isWithinTaxYear, normalizeCadence } from '../util/freshness.util';
import type { Cadence } from '../config/freshness.config';

@Injectable({ providedIn: 'root' })
export class KbService {
  private http = inject(HttpClient);
  private log = inject(Logger);
  
  loadIndex(): Observable<ArticleRow[]> {
    return this.http.get('data/articles.csv',{responseType:'text'}).pipe(
      tap(() => this.log.info('KB: index fetched')),
      map(text=>{
        if(!text.trim()) return []; 
        const [h,...ls]=text.trim().split('\n'); 
        const ks=h.split(',');
        return ls.map(l=>{ 
          const parts=(l.match(/(".*?"|[^,]+)/g)||[]).map(x=>x.replace(/^"|"$/g,'').replace(/""/g,'"'));
          const row:any={}; 
          ks.forEach((k,i)=>row[k.trim()]=parts[i]??''); 

          // cadence inference: use CSV column 'cadence' if present; else infer by labels/section
          const labelSet = new Set(String(row.labels || '').split('|').map((s:string)=>s.toLowerCase().trim()).filter(Boolean));
          let cadence: Cadence = normalizeCadence(row.cadence as string) || (
            labelSet.has('tax') || labelSet.has('irs') || labelSet.has('season') ? 'tax_year' :
            labelSet.has('release') || labelSet.has('version') || labelSet.has('windows') ? 'event_driven' :
            labelSet.has('urgent') || labelSet.has('outage') ? 'time_sensitive' :
            'evergreen'
          );
          row.cadence = cadence;

          // derived freshness
          row._ageDays = daysSince(row.updated_at);
          row._taxBucket = isWithinTaxYear(row.updated_at, 'current') ? 'current'
                         : isWithinTaxYear(row.updated_at, 'last')    ? 'last'
                         : 'older';
          row._cadenceStatus = cadenceStatus(cadence, row.updated_at);

          // governance signals
          row._needsSummary = (row.lint_flags || '').split('|').includes('missing_tldr');

          // promotion metadata (if front-matter columns exist in CSV)
          row._promoted = String(row.promoted||'').toLowerCase() === 'true';
          const pad = Number(row.promoted_review_after_days || 28);
          const pAt = Date.parse(row.promoted_at || '');
          row._promotionDue = row._promoted && !Number.isNaN(pAt) ? (Date.now() - pAt) / 86400000 > pad : false;

          return row as ArticleRow; 
        });
      })
    );
  }
  
  loadMarkdown(relPath:string){ 
    return this.http.get('data/'+relPath,{responseType:'text'}).pipe(
      tap(() => this.log.info('KB: md loaded', relPath))
    );
  }
}