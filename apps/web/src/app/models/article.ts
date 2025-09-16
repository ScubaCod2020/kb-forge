export interface ArticleRow {
  path: string; 
  zendesk_id: string; 
  title: string;
  category: string; 
  section: string; 
  labels: string;
  updated_at: string; 
  status: 'draft'|'active'|string;
}