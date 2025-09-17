# KB-Forge

A knowledge base management system built with Angular and Node.js/TypeScript that processes Zendesk exports into searchable markdown articles with intelligent scoring and TL;DR generation.

## Features

- **Ingest System**: Convert Zendesk JSON exports to structured markdown with CSV index
- **Lookup System**: ID→name mapping for categories, sections, and authors
- **TL;DR Regenerator**: AI-powered summary generation using OpenAI or Ollama
- **KB Linter**: Quality scoring system with automated flags
- **Angular UI**: Modern triage interface for browsing and previewing articles
- **Debug Tools**: Comprehensive logging and error handling

## Quick Start

1. **Install dependencies**:
   ```bash
   npm ci
   ```

2. **Configure environment** (copy `.env.example` to `.env`):
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Import data**:
   ```bash
   # Place Zendesk JSON files in imports/
   npm run ingest:json
   ```

4. **Start the application**:
   ```bash
   npm start
   # Open http://localhost:4200
   ```

## Usage

### Data Ingestion
```bash
# Convert Zendesk JSON to markdown + CSV
npm run ingest:json

# Process reference documents (PDF/DOCX)
npm run ingest:refs
```

### Quality Management
```bash
# Run KB linter - adds quality_score and lint_flags to articles.csv
npm run lint:kb

# Regenerate TL;DR summaries using AI
npm run tldr:regen

# Regenerate specific files only
GLOB="Security/**/*.md" npm run tldr:regen
```

### Development
```bash
# Start Angular dev server
npm start

# Build for production  
npm run ci:build
```

## Configuration

### LLM Providers
Set in `.env`:
- **OpenAI**: Set `LLM_PROVIDER=openai` and `OPENAI_API_KEY`
- **Ollama**: Set `LLM_PROVIDER=ollama` and ensure Ollama is running locally

### Lookups
Edit `imports/lookups/*.json` files to customize ID→name mappings:
- `categories.json` - Article categories
- `sections.json` - Article sections  
- `authors.json` - Author mappings

## Architecture

- **apps/web** - Angular frontend application
- **tools/ingest** - Data processing utilities
- **tools/tldr** - AI-powered TL;DR generation
- **tools/lint** - Quality assessment tools
- **data/** - Generated outputs (not in source control)
- **imports/** - Input files (not in source control)

## Freshness (Tax-Year Aware) & Cadence

### Tax Year Configuration
Set `TAX_YEAR_START_MM_DD` in `apps/web/src/app/config/freshness.config.ts` to define when your organization's tax year begins (default: November 1st).

### Content Cadence
Each article can declare a `cadence` type that determines freshness thresholds:
- **tax_year**: Content updated annually with tax seasons
- **event_driven**: Updated after major software releases or policy changes  
- **evergreen**: Timeless content that changes infrequently
- **time_sensitive**: Urgent content requiring frequent updates

Cadence can be set via CSV column or auto-inferred from labels (tax/irs/season → tax_year, release/version → event_driven, urgent/outage → time_sensitive).

### UI Filters
The Angular interface provides filters for:
- **Tax Year Windows**: This Tax Year, Last Tax Year, Older
- **Cadence Selector**: Filter by content update cadence
- **Governance Checkboxes**: Needs Summary, Promoted, Promotion Due

### Content Chips
Articles display visual indicators:
- **Needs Summary**: Missing TL;DR content
- **Promoted**: Highlighted content for training
- **Rotate**: Promoted content due for review
- **Cadence Badge**: Shows content update frequency
- **Tax Bucket**: Current/Last/Older tax year classification
- **Stale Warning**: Content exceeding cadence thresholds
- **Quality Score**: Overall content assessment (0-100)

## Governance

### Owner Validation
The linter flags `owner_not_team` when articles lack valid ownership using `imports/lookups/owners.json` to maintain a approved team member list.

### Quality Monitoring  
The KB linter evaluates content across multiple dimensions:
- **Structure**: Headings, numbered steps, bullet points
- **Completeness**: TL;DR summaries, ownership, labeling
- **Freshness**: Age relative to cadence requirements
- **Security**: Potential secrets or sensitive information
- **Assets**: Broken image references

### Automated Workflows
- **Ingestion**: Processes Zendesk exports with ID→name lookups
- **Quality Scoring**: Runs linting checks and updates CSV metrics
- **Content Enhancement**: AI-powered TL;DR generation and auditing

## Export from Zendesk (local, PowerShell)

Use Mark's exporter via a wrapper that prompts for Zendesk Email, API Token, and primary subdomain.

```powershell
# From repo root
npm run sync:export
```

This will:
- Run the exporter for all brands with Help Center enabled
- Place an enriched CSV into `imports\` (date-stamped)  
- Run `ingest:csv`, `lint:kb`, and `rag:index`

To pre-fill prompts, set env vars before running:
```powershell
$env:ZD_EMAIL = "you@company.com"
$env:ZD_API_TOKEN = "XXXX"
$env:ZD_SUBDOMAIN = "libertytax"
npm run sync:export
```

## Contributing

See `docs/OPERATIONS.md` for detailed operational procedures and `CHANGELOG.md` for recent changes.
