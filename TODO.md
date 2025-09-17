# KB-Forge TODO

## Immediate Next Steps
- [ ] Copy .env.example to .env and configure LLM provider
- [ ] Run `npm run rag:index` to create search embeddings  
- [ ] Test RAG API: `npm run rag:serve` then visit http://localhost:7070
- [ ] Confirm RAG endpoints work:
  - [ ] GET /search?q=reset%20password&k=5
  - [ ] POST /train-outline {"topic": "Reset MFA", "audience":"Tier 1 Agents"}
  - [ ] POST /audit {"path": "data/kb_md/Authentication/misc/some-file.md"}

## RAG Quality Testing  
- [ ] Confirm RAG /train-outline output quality on 3 topics
- [ ] Test search relevance on common support queries
- [ ] Verify audit suggestions are actionable
- [ ] Decide OpenAI vs Ollama for production

## Development Priorities
- [ ] Implement tools/sync incremental Zendesk pull
- [ ] Add "Freshness filter" to Angular UI (last 7/30/90 days)
- [ ] Add "Needs summary" filter (missing TL;DR)
- [ ] Enhance chunking strategies for better RAG results

## Infrastructure
- [ ] Add RAG monitoring/health endpoints
- [ ] Set up sync scheduling (cron jobs)
- [ ] Add usage analytics and logging
- [ ] Performance optimization for large datasets

## Nice-to-Have
- [ ] Multi-modal support (images, PDFs in RAG)
- [ ] Real-time Zendesk webhooks
- [ ] Advanced search filters in Angular UI
- [ ] Export training materials as presentations