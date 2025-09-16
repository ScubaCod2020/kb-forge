import { Component, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown'; 
import { DebugToolbarComponent } from '../../core/debug-toolbar.component';
import { environment } from '../../../environments/environment';
import { KbService } from '../../services/kb.service';
import { ArticleRow } from '../../models/article';

@Component({
  standalone:true, 
  selector:'app-triage', 
  imports:[CommonModule, FormsModule, MarkdownModule, DebugToolbarComponent],
  template:`
  <app-debug-toolbar *ngIf="debugOn"></app-debug-toolbar>
  <div class="layout">
    <aside>
      <input placeholder="Search title…" [(ngModel)]="q"/>
      <input placeholder="Filter label…" [(ngModel)]="label"/>
      <select [(ngModel)]="section">
        <option value="">All sections</option>
        <option *ngFor="let s of sections()" [value]="s">{{s}}</option>
      </select>
      <ul class="list">
        <li *ngFor="let r of filtered() | slice:0:500" (click)="select(r)" [class.sel]="sel()?.zendesk_id===r.zendesk_id">
          <div class="t">{{r.title}}</div>
          <div class="m">{{r.section}} · {{r.updated_at?.slice(0,10) || 'No date'}} · {{r.status}}</div>
        </li>
      </ul>
    </aside>
    <main *ngIf="sel() as s; else choose">
      <header>
        <h2>{{s.title}}</h2>
        <div class="meta">#{{s.zendesk_id}} · {{s.category}} / {{s.section}}</div>
      </header>
      <article><markdown [data]="md()"></markdown></article>
    </main>
    <ng-template #choose>
      <main class="placeholder">
        <p>Select an article to preview.</p>
      </main>
    </ng-template>
  </div>`,
  styles:[`
  .layout{display:grid;grid-template-columns:360px 1fr;height:100vh}
  aside{border-right:1px solid #ddd;padding:12px;overflow:auto}
  aside input,aside select{width:100%;margin-bottom:8px;padding:8px;border:1px solid #ccc;border-radius:4px}
  .list{list-style:none;padding:0;margin:0}
  .list li{padding:8px;cursor:pointer;border-radius:8px}
  .list li.sel,.list li:hover{background:#f6f6f6}
  .t{font-weight:600}
  .m{font-size:12px;color:#666}
  main{padding:16px;overflow:auto}
  .placeholder{display:flex;align-items:center;justify-content:center;color:#888}
  `]
})
export default class TriageComponent{
  debugOn = environment.DEBUG_TOOL_ENABLED;
  rows=signal<ArticleRow[]>([]); 
  q=''; 
  label=''; 
  section='';
  sel=signal<ArticleRow|null>(null); 
  md=signal<string>('');
  
  sections = computed(()=>Array.from(new Set(this.rows().map(r=>r.section))).sort());
  
  filtered = computed(()=>this.rows().filter(r =>
    (!this.q || r.title.toLowerCase().includes(this.q.toLowerCase())) &&
    (!this.label || (r.labels||'').toLowerCase().includes(this.label.toLowerCase())) &&
    (!this.section || r.section===this.section)
  ));
  
  constructor(private kb:KbService){
    this.kb.loadIndex().subscribe(rows=>this.rows.set(rows));
    effect(()=>{ 
      const s=this.sel(); 
      if(!s){
        this.md.set('');
        return;
      }
      this.kb.loadMarkdown(s.path).subscribe(t=>this.md.set(t)); 
    });
  }
  
  select(r:ArticleRow){ 
    this.sel.set(r); 
  }
}