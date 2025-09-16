import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http'; 
import { map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs'; 
import { Logger } from '../core/logger.service';
import { ArticleRow } from '../models/article';

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
          const o:any={}; 
          ks.forEach((k,i)=>o[k]=parts[i]??''); 
          return o as ArticleRow; 
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