export type ZendeskArticle = {
  id: number;
  title?: string;
  body?: string;         // HTML
  html_url?: string;
  created_at?: string;
  updated_at?: string;
  draft?: boolean;
  label_names?: string[];
  locale?: string;
  category?: string;
  section?: string;
  author_id?: number | string;
  audience?: string;
  product?: string;
};

export type FrontMatter = {
  zendesk_id: number;
  title: string;
  category: string;
  section: string;
  labels: string[];
  audience: string;
  product: string;
  status: 'draft'|'active';
  owner: string | number | '';
  created_at: string;
  updated_at: string;
  source_url: string;
  locale: string;
};
