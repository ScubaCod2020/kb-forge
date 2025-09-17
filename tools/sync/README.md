# Incremental Zendesk Sync

## Overview
Incremental sync system to pull updated articles from Zendesk and maintain the knowledge base.

## API Endpoint
`/api/v2/help_center/incremental/articles.json?start_time=<unix>`

Returns articles modified since the given Unix timestamp.

## Checkpoint Management
- **Location**: `data/.sync/last_since.json`
- **Format**: `{"last_since": 1634567890, "updated_at": "2025-09-17T12:00:00Z"}`
- **Purpose**: Track last successful sync to avoid re-processing articles

## Environment Variables
Add to `.env`:
```
ZD_SUBDOMAIN=yourcompany
ZD_EMAIL=agent@yourcompany.com
ZD_API_TOKEN=your_api_token_here
```

## Merge Strategy
1. **Update/Insert by zendesk_id**: Articles are identified by their Zendesk ID
2. **Preserve ID+name mappings**: Use existing lookup system (`imports/lookups/*.json`)
3. **Re-index after merge**: Run `npm run rag:index` to refresh search embeddings
4. **Maintain CSV consistency**: Update `data/articles.csv` with new/changed articles

## Workflow
1. Check `data/.sync/last_since.json` for last sync timestamp
2. Call Zendesk incremental API with `start_time`
3. Process returned articles through existing ingest pipeline
4. Update checkpoint file with current timestamp
5. Trigger RAG re-indexing

## Error Handling
- Rate limiting: Respect Zendesk API limits (700 requests/minute)
- Network failures: Retry with exponential backoff
- Partial sync failures: Don't update checkpoint if errors occur
- Data validation: Verify article structure before processing
