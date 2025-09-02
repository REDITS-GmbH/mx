# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `pnpm dev` - Start development server with local database seeding
- `pnpm seedLocalDb` - Apply D1 migrations locally
- `pnpm cf-typegen` - Generate TypeScript types from Wrangler

### Testing
- `pnpm test` - Run integration tests with Vitest (performs dry-run deploy first)
- To run a single test file: `npx vitest run tests/integration/tasks.test.ts --config tests/vitest.config.mts`

### Deployment
- `pnpm deploy` - Deploy to Cloudflare Workers
- `pnpm predeploy` - Apply D1 migrations to remote database (runs automatically before deploy)

### Schema
- `pnpm schema` - Generate OpenAPI schema locally using chanfana

## Architecture

This is a Cloudflare Workers API using:
- **Hono** - Web framework for routing and middleware
- **Chanfana** - OpenAPI 3.1 auto-generation and validation layer on top of Hono
- **D1** - Cloudflare's serverless SQL database
- **Zod** - Schema validation

### Key Architectural Patterns

1. **Main Router Setup** (`src/index.ts`):
   - Creates Hono app with global error handling for ApiExceptions
   - Configures OpenAPI documentation at root path `/`
   - Mounts sub-routers (e.g., `/tasks`) and individual endpoints

2. **Endpoint Organization**:
   - Endpoints grouped by resource in `src/endpoints/`
   - Sub-routers defined for resource collections (e.g., `tasks/router.ts`)
   - Each endpoint extends Chanfana's OpenAPI classes for automatic documentation
   - Endpoints use Zod schemas for request/response validation

3. **Database Integration**:
   - D1 database bound as `DB` in worker environment
   - Migrations in `migrations/` directory, applied via wrangler
   - Models define table schemas with Zod (e.g., `tasks/base.ts`)
   - Models include serializers for data transformation

4. **Testing Setup**:
   - Integration tests use `@cloudflare/vitest-pool-workers`
   - Tests run against local D1 database with migrations applied
   - Test configuration in `tests/vitest.config.mts`
   - Helper functions for common operations in test files

5. **Type Safety**:
   - TypeScript strict mode enabled
   - Worker environment types generated via `worker-configuration.d.ts`
   - Context types defined in `src/types.ts` for Hono handlers

6. **Email Handler**:
   - Worker exports both `fetch` (HTTP) and `email` handlers for dual functionality
   - Email routing features:
     - Domain-independent (ignores sender domain, focuses on local part)
     - Case-insensitive processing via `.toLowerCase()`
     - Supports subaddressing with `+` (preserves tags when forwarding)
     - Multiple aliases per user defined in `forwardMap`
     - Auto-generates multi-forward rules when same prefix maps to multiple users
   - Current user mappings in `forwardMap`:
     - Each user has their full name and shorter aliases
     - Example: "scharf" automatically forwards to all Scharf family members
   - Default fallback: `dietmar.scharf@blueits.com` for unknown senders
   - Implementation in `src/index.ts` alongside HTTP endpoints