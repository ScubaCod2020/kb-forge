export const TAX_YEAR_START_MM_DD = '11-01'; // Adjust if your org's tax year differs

export type Cadence = 'tax_year'|'event_driven'|'evergreen'|'time_sensitive';

// Default thresholds (days). Used for both UI coloring and fallback logic.
export const CADENCE_THRESHOLDS_DAYS: Record<Cadence, { fresh: number; warn: number; stale: number }> = {
  tax_year:      { fresh: 365, warn: 540, stale: 730 },   // Current/last tax year
  event_driven:  { fresh: 365, warn: 540, stale: 720 },   // After major releases
  evergreen:     { fresh: 540, warn: 720, stale: 1080 },  // 18–24–36 months
  time_sensitive:{ fresh:  45, warn:  90, stale:  180 },  // 7–45–180 days
};

// If an article has an unknown/missing cadence, use this as canonical default.
export const DEFAULT_CADENCE: Cadence = 'evergreen';
