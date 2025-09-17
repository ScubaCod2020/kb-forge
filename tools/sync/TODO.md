# Zendesk Sync Implementation TODO

## Phase 1: Core Infrastructure
- [ ] Create `tools/sync/package.json` with dependencies
  - [ ] Add axios for HTTP requests
  - [ ] Add rate limiting middleware
  - [ ] Add retry logic utilities
- [ ] Create `tools/sync/src/client.ts` - Zendesk API client
- [ ] Create `tools/sync/src/checkpoint.ts` - Timestamp management
- [ ] Create `tools/sync/src/sync.ts` - Main sync orchestration

## Phase 2: Integration
- [ ] Update root `package.json` with sync scripts:
  - [ ] `"sync:incremental": "npm -w tools/sync run sync"`
  - [ ] `"sync:full": "npm -w tools/sync run sync -- --full"`
- [ ] Integrate with existing ingest pipeline
- [ ] Add sync workspace to CI build process

## Phase 3: Enhanced Features
- [ ] Add `--dry-run` mode for testing
- [ ] Implement diff detection (skip unchanged articles)
- [ ] Add sync metrics and logging
- [ ] Create sync status dashboard endpoint
- [ ] Add webhook receiver for real-time updates

## Phase 4: Production Readiness
- [ ] Add comprehensive error handling
- [ ] Implement sync monitoring/alerting
- [ ] Create sync scheduling (cron jobs)
- [ ] Add backup/restore for checkpoints
- [ ] Performance optimization for large datasets

## Implementation Notes
- Start with manual trigger: `npm run sync:incremental`
- Use existing lookup system for ID→name resolution
- Leverage current `tools/ingest/src/json.ts` logic
- Maintain backward compatibility with manual JSON imports
