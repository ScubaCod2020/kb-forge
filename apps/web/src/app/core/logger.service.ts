import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
type Level = 'debug'|'info'|'warn'|'error'|'off';
const order: Record<Level, number> = { debug:10, info:20, warn:30, error:40, off:99 };
@Injectable({ providedIn: 'root' })
export class Logger {
  private level: Level = (environment.LOG_LEVEL as Level) ?? 'info';
  setLevel(l: Level){ this.level = l; }
  private allow(l: Level){ return order[l] >= order[this.level]; }
  debug(...a:any[]){ if(this.allow('debug')) console.debug('[DBG]', ...a); }
  info (...a:any[]){ if(this.allow('info' )) console.info ('[INF]', ...a); }
  warn (...a:any[]){ if(this.allow('warn' )) console.warn ('[WRN]', ...a); }
  error(...a:any[]){ if(this.allow('error')) console.error('[ERR]', ...a); }
}
