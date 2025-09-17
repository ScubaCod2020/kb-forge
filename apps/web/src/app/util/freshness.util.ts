import { TAX_YEAR_START_MM_DD, CADENCE_THRESHOLDS_DAYS, DEFAULT_CADENCE, Cadence } from '../config/freshness.config';

export function parseIsoOrNa(iso?: string): number {
  if (!iso) return NaN;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? NaN : t;
}

export function daysSince(iso?: string): number {
  const t = parseIsoOrNa(iso);
  if (Number.isNaN(t)) return 99999;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

export function currentTaxYearStart(now = new Date()): Date {
  const [mm, dd] = TAX_YEAR_START_MM_DD.split('-').map(n => +n);
  const y = (now.getUTCMonth()+1) >= mm ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return new Date(Date.UTC(y, mm-1, dd, 0, 0, 0));
}

export function lastTaxYearStart(now = new Date()): Date {
  const s = currentTaxYearStart(now);
  return new Date(Date.UTC(s.getUTCFullYear()-1, s.getUTCMonth(), s.getUTCDate()));
}

export function isWithinTaxYear(iso?: string, which: 'current'|'last'|'older'|'any' = 'any'): boolean {
  const t = parseIsoOrNa(iso);
  if (Number.isNaN(t)) return false;
  const d = new Date(t);
  const cur = currentTaxYearStart();
  const last = lastTaxYearStart();
  if (which === 'current') return d >= cur;
  if (which === 'last')    return d >= last && d < cur;
  if (which === 'older')   return d < last;
  return true;
}

export function normalizeCadence(c?: string): Cadence {
  const v = String(c || '').toLowerCase().trim();
  if (v === 'tax_year' || v === 'event_driven' || v === 'evergreen' || v === 'time_sensitive') return v as Cadence;
  return DEFAULT_CADENCE;
}

export function cadenceStatus(cadenceRaw: string | undefined, updated_at?: string): 'fresh'|'warn'|'stale' {
  const cadence = normalizeCadence(cadenceRaw);
  const d = daysSince(updated_at);
  const th = CADENCE_THRESHOLDS_DAYS[cadence] || CADENCE_THRESHOLDS_DAYS[DEFAULT_CADENCE];
  if (d <= th.fresh) return 'fresh';
  if (d <= th.warn)  return 'warn';
  return 'stale';
}
