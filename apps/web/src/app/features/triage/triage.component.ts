import { Component, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown'; 
import { DebugToolbarComponent } from '../../core/debug-toolbar.component';
import { environment } from '../../../environments/environment';
import { KbService } from '../../services/kb.service';
import { ArticleRow } from '../../models/article';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  standalone:true, 
  selector:'app-triage', 
  imports:[CommonModule, FormsModule, MarkdownModule, DebugToolbarComponent, MatButtonToggleModule, MatSelectModule, MatFormFieldModule, MatCheckboxModule, MatChipsModule],
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

      <section class="toolbar">
        <mat-button-toggle-group [(ngModel)]="taxWindow" aria-label="Tax Year">
          <mat-button-toggle value="all">All</mat-button-toggle>
          <mat-button-toggle value="current">This Tax Year</mat-button-toggle>
          <mat-button-toggle value="last">Last Tax Year</mat-button-toggle>
          <mat-button-toggle value="older">Older</mat-button-toggle>
        </mat-button-toggle-group>

        <mat-form-field appearance="outline">
          <mat-label>Cadence</mat-label>
          <mat-select [(ngModel)]="cadence">
            <mat-option value="all">All</mat-option>
            <mat-option value="tax_year">Tax Year</mat-option>
            <mat-option value="event_driven">Event-driven</mat-option>
            <mat-option value="evergreen">Evergreen</mat-option>
            <mat-option value="time_sensitive">Time-sensitive</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-checkbox [(ngModel)]="onlyNeedsSummary">Needs Summary</mat-checkbox>
        <mat-checkbox [(ngModel)]="onlyPromoted">Promoted</mat-checkbox>
        <mat-checkbox [(ngModel)]="onlyPromotionDue">Promotion Due</mat-checkbox>
      </section>
      <ul class="list">
        <li *ngFor="let r of filtered() | slice:0:500" (click)="select(r)" [class.sel]="sel()?.zendesk_id===r.zendesk_id">
          <div class="t">{{r.title}}</div>
          <div class="m">{{r.section}} · {{r.updated_at?.slice(0,10) || 'No date'}} · {{r.status}}</div>
          <mat-chip-set>
            <mat-chip *ngIf="r._needsSummary" color="warn">Needs Summary</mat-chip>
            <mat-chip *ngIf="r._promoted" color="primary">Promoted</mat-chip>
            <mat-chip *ngIf="r._promotionDue" color="accent">Rotate</mat-chip>
            <mat-chip>{{ r.cadence || 'cadence?' }}</mat-chip>
            <mat-chip>{{ r._taxBucket }}</mat-chip>
            <mat-chip *ngIf="r._cadenceStatus==='stale'" color="warn">Stale</mat-chip>
            <mat-chip *ngIf="r.quality_score">QS {{r.quality_score}}</mat-chip>
          </mat-chip-set>
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
  .toolbar{margin:12px 0;padding:8px;border:1px solid #eee;border-radius:4px;background:#fafafa}
  .toolbar mat-form-field{width:100%;margin:4px 0}
  .toolbar mat-button-toggle-group{display:flex;width:100%;margin:4px 0}
  .toolbar mat-checkbox{margin:4px 0}
  .list{list-style:none;padding:0;margin:0}
  .list li{padding:8px;cursor:pointer;border-radius:8px;border-bottom:1px solid #eee}
  .list li.sel,.list li:hover{background:#f6f6f6}
  .t{font-weight:600}
  .m{font-size:12px;color:#666;margin:4px 0}
  mat-chip-set{margin-top:4px}
  mat-chip{margin:2px}
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
  
  taxWindow: 'all'|'current'|'last'|'older' = 'all';
  onlyNeedsSummary = false;
  onlyPromoted = false;
  onlyPromotionDue = false;
  cadence: 'all'|'tax_year'|'event_driven'|'evergreen'|'time_sensitive' = 'all';
  
  sections = computed(()=>Array.from(new Set(this.rows().map(r=>r.section))).sort());
  
  filtered = computed(()=>{
    let a = this.rows().filter(r =>
      (!this.q || r.title.toLowerCase().includes(this.q.toLowerCase())) &&
      (!this.label || (r.labels||'').toLowerCase().includes(this.label.toLowerCase())) &&
      (!this.section || r.section===this.section)
    );
    if (this.taxWindow !== 'all') a = a.filter(r => r._taxBucket === this.taxWindow);
    if (this.cadence !== 'all') a = a.filter(r => (r.cadence||'') === this.cadence);
    if (this.onlyNeedsSummary) a = a.filter(r => r._needsSummary);
    if (this.onlyPromoted) a = a.filter(r => r._promoted);
    if (this.onlyPromotionDue) a = a.filter(r => r._promotionDue);
    return a;
  });
  
  constructor(private kb:KbService){
    this.kb.loadIndex().subscribe(rows=>this.rows.set(rows));
    effect(()=>{ 
      const s=this.sel(); 
      if(!s){
        this.md.set('');
        return;
      }
      this.kb.loadMarkdown(s.path).subscribe(t=>this.md.set(t)); 
    }, { allowSignalWrites: true });
  }
  
  select(r:ArticleRow){ 
    this.sel.set(r); 
  }
}