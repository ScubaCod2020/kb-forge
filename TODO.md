# KB-Forge TODO

## Resume checklist (next session)
- [ ] Drop latest Zendesk JSON into /imports and run: npm run ingest:json
- [ ] (Optional) npm run lint:kb → confirm quality_score/lint_flags updated
- [ ] npm run rag:index → refresh search embeddings
- [ ] npm run rag:serve → smoke test /search and /train-outline
- [ ] Review TODOs below and triage

## Current Session Work (Incomplete)
- [ ] Complete RAG workspace implementation
  - [ ] Finish tools/rag/src/ files (embeddings.ts, chunk.ts, indexer.ts, etc.)
  - [ ] Install dependencies: npm -w tools/rag i
  - [ ] Test indexing: npm run rag:index
  - [ ] Test API endpoints: npm run rag:serve
- [ ] Set up LLM provider in .env (copy from .env.example)
- [ ] Update README.md with RAG documentation section
- [ ] Create initial RAG index from existing KB content

## Future Enhancements
- [ ] Incremental Zendesk sync
- [ ] RAG quality metrics
- [ ] Enhanced chunking strategies
- [ ] Multi-modal support (images, PDFs)
- [ ] Usage analytics and logging
