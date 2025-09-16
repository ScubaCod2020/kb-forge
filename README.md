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

## Contributing

See `docs/OPERATIONS.md` for detailed operational procedures and `CHANGELOG.md` for recent changes.
