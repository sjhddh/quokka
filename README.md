# Quokka

**Watch once. Run forever.**

Open-source browser-native agent framework for teaching, running, and sharing reusable browser tasks.

---

## Why Quokka?

Quokka is not another chat box bolted onto your browser. It starts from the page you're already on and works in three modes:

- **Do** — Tell Quokka what to do in plain language. It figures out the steps.
- **Watch** — Perform a task yourself while Quokka records it as a reusable recipe.
- **Run** — Replay a recipe with one click, with human checkpoints where it matters.

No cloud dependency. No account required. Your recipes are portable JSON that you own.

## Quick Start

```bash
# Clone the repo
git clone https://github.com/niceboss/quokka.git
cd quokka

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start the companion server
pnpm --filter @quokka/companion dev

# Load the extension in Chrome:
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" → select apps/extension/dist
```

## Architecture

```
┌─────────────────┐      WebSocket       ┌──────────────┐
│                  │◄───────────────────►│              │
│  Chrome Extension │                     │  Companion   │
│  (content + popup)│                     │  (Node server)│
│                  │                      │              │
└────────┬─────────┘                      └──────┬───────┘
         │                                       │
         │  imports                               │  imports
         ▼                                       ▼
┌──────────────────────────────────────────────────────────┐
│                      Packages                            │
│                                                          │
│  shared ── recipe-dsl ── compiler ── runtime ── verifier │
│              model-router    storage    starter-packs     │
└──────────────────────────────────────────────────────────┘
```

## Core Concepts

| Concept | Description |
|---|---|
| **Recipe** | A portable sequence of browser steps — navigate, click, type, extract, wait. |
| **Run** | A single execution of a recipe, tracking status and step progress. |
| **Slot** | A named parameter in a recipe (e.g. `url`, `email`) filled at run time. |
| **Guard** | A precondition checked before a recipe runs — URL match, DOM element exists, etc. |
| **Checkpoint** | A pause point requiring human review before continuing. |
| **Pack** | A named collection of recipes bundled together for distribution. |

## Example Recipe

Build recipes programmatically with `@quokka/recipe-dsl`:

```typescript
import { recipe } from '@quokka/recipe-dsl'

const scrapeLinks = recipe('Extract Page Links')
  .description('Navigate to a URL and extract all link hrefs')
  .hosts('*')
  .slot('url', 'Page URL', 'string')
  .step('navigate', { url: '{{url}}' })
  .step('extract', {
    target: { css: 'a[href]' },
    as: 'links',
    description: 'Extract all link hrefs',
  })
  .checkpoint('Found links — save results?')
  .build()
```

## Project Structure

```
quokka/
├── apps/
│   ├── companion/          # Node.js WebSocket server
│   └── extension/          # Chrome extension (popup + content scripts)
├── packages/
│   ├── shared/             # Types, schemas, events (Zod)
│   ├── recipe-dsl/         # Fluent builder API for recipes
│   ├── compiler/           # Prompt → recipe compiler
│   ├── runtime/            # Step executor engine
│   ├── verifier/           # Recipe validation & testing
│   ├── model-router/       # LLM provider abstraction
│   ├── storage/            # Recipe & run persistence
│   └── starter-packs/      # Curated recipe collections
├── tsconfig.base.json
├── vitest.workspace.ts
└── pnpm-workspace.yaml
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Dev mode (watch all packages)
pnpm dev

# Lint (type-check)
pnpm lint
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

[MIT](LICENSE)
