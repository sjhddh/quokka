# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-04-08

### Added
- Guard enforcement in recipe runtime (`guard-checker`)
- Checkpoint approval UI in Chrome extension
- Provider persistence with Drizzle SQLite (`provider-repo`)
- Recipe import/export with library UI
- LLM recipe generation (`POST /api/generate`)
- "Do" mode — 4th tab in Chrome extension for freeform agent tasks
- Provider settings UI in extension popup
- SSE event streaming via `/api/events` (replacing polling)
- Headless execution with Playwright (`@quokka/headless`)
- Starter packs with curated recipes
- Event bus for internal pub/sub

### Fixed
- Health check URL mismatch in extension background script
- ModelRouter sync on provider CRUD operations
- Missing SSE event in headless error path
- Click selector precedence bug in runtime

## [0.1.0] - 2026-04-08

### Added
- Initial monorepo setup with pnpm workspaces
- Core packages: shared, recipe-dsl, compiler, runtime, verifier, model-router, storage
- Chrome extension (Manifest V3) with Watch and Run modes
- Companion Fastify server with WebSocket communication
- 72 tests across all packages
- TypeScript strict mode with shared base config
- Vitest workspace configuration
