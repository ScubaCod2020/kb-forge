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

## Angular UI
- `npm start` → http://localhost:4200
- Toggle debug via `environment.DEBUG_TOOL_ENABLED` and `LOG_LEVEL`.

## CI / Security
- GitHub Actions build in `.github/workflows/ci.yml`
- CodeQL in `.github/workflows/codeql.yml`
- Dependabot in `.github/dependabot.yml`

## Handover
- Commit everything except `/data` (generated) and `/imports` (inputs).
- Ensure `.env` kept out of source; share `.env.example`.
