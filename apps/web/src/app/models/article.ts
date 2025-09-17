export type ArticleRow = {
  path: string; zendesk_id: string; title: string;
  category?: string; section?: string; labels?: string;
  updated_at?: string; status?: string; quality_score?: string; lint_flags?: string;
  owner?: string; audience?: string; cadence?: string; // new optional
  
  _ageDays?: number;
  _taxBucket?: 'current'|'last'|'older';
  _needsSummary?: boolean;
  _promoted?: boolean;
  _promotionDue?: boolean;
  _cadenceStatus?: 'fresh'|'warn'|'stale';
};