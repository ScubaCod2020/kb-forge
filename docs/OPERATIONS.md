# KB-Forge Operations Manual

## Ingest (from Zendesk export)
1. Drop `*.json` into `imports/`.
2. Run `npm run ingest:json`.
3. Outputs:
   - `data/articles.csv`
   - `data/kb_md/**.md` (front-matter includes IDs and names)

## References
- Drop `*.pdf|*.docx` into `imports/` and run `npm run ingest:refs`.

## Lookups
- Maintain `imports/lookups/categories.json`, `sections.json`, `authors.json`.
- Re-run `npm run ingest:json` to refresh names.

## TL;DR Regenerator
- Choose provider in `.env`: `LLM_PROVIDER=openai|ollama`.
- All files: `npm run tldr:regen`
- Subset: `GLOB="Authentication/**.md" npm run tldr:regen`

## KB Linter
- `npm run lint:kb`
- Adds/updates `quality_score` and `lint_flags` columns in `data/articles.csv`.
- Common flags: `missing_h1`, `no_steps_or_bullets`, `missing_tldr`, `stale_gt_6m`, `possible_secret`, etc.

## RAG Search & Training
- Index content: `npm run rag:index`
- Start API: `npm run rag:serve` (http://localhost:7070)
- Search: `GET /search?q=reset%20password&k=5`
- Audit: `POST /audit {"path": "data/kb_md/file.md"}`
- Training: `POST /train-outline {"topic": "MFA Reset", "audience": "Agents"}`

## Angular UI
- `npm start` → http://localhost:4200
- Toggle debug via `environment.DEBUG_TOOL_ENABLED` and `LOG_LEVEL`.

## Reference Importer

### Supported Formats
- **PDF files**: `.pdf` extension
- **Word documents**: `.docx` extension

### Usage
1. Place files in `/imports` directory
2. Run `npm run ingest:refs`
3. Output appears in `data/references/`

### Known Limitations
- **PDF layout fidelity**: Complex layouts may not convert cleanly
- **Code blocks detection**: Programming code may not be properly formatted
- **Image extraction**: Images in documents are not currently processed
- **Table formatting**: Complex tables may lose structure

### Troubleshooting
- If PDF processing fails, check that files aren't password protected
- Large files (>50MB) may timeout - consider splitting
- Corrupted files will be skipped with warnings in console

## CI / Security
- GitHub Actions build in `.github/workflows/ci.yml`
- CodeQL in `.github/workflows/codeql.yml`
- Dependabot in `.github/dependabot.yml`

## Handover
- Commit everything except `/data` (generated) and `/imports` (inputs).
- Ensure `.env` kept out of source; share `.env.example`.