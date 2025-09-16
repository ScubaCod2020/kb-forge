import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Logger } from './logger.service';
import { environment } from '../../environments/environment';
@Component({
  selector: 'app-debug-toolbar', standalone: true, imports: [CommonModule],
  styles:[`.dbg{position:fixed;bottom:12px;right:12px;background:#111;color:#fff;padding:8px 10px;border-radius:8px;opacity:.85;font:12px ui-monospace,monospace}`],
  template:`<div class="dbg" *ngIf="enabled"><span>Debug ON</span> <button (click)="poke()">Ping</button></div>`
})
export class DebugToolbarComponent {
  enabled = environment.DEBUG_TOOL_ENABLED;
  constructor(private log: Logger) {}
  poke(){ this.log.debug('Toolbar ping @', new Date().toISOString()); }
}
