<div align="center">

# Quokka

### Watch once. Run forever.

Quokka turns browser actions into reusable automation recipes.\
Record a workflow once, replay it forever — with AI-powered natural language commands, visual recording, and headless execution.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Build: passing](https://img.shields.io/badge/build-passing-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)
![Tests](https://img.shields.io/badge/tests-117%20passing-brightgreen.svg)
![pnpm](https://img.shields.io/badge/pnpm-monorepo-orange.svg)
![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4.svg)

</div>

---

## What is Quokka?

Quokka is an open-source, browser-native agent framework for teaching, running, and sharing reusable browser tasks. It lives inside your browser as a Chrome extension, records your actions into portable JSON recipes, and replays them on demand — locally, with no cloud dependency or account required.

---

## Why Quokka?

Quokka is not another chat box bolted onto your browser. It starts from the page you're already on and works in three modes:

- **Do** — Tell Quokka what to do in plain language. It figures out the steps.
- **Watch** — Perform a task yourself while Quokka records it as a reusable recipe.
- **Run** — Replay a recipe with one click, with human checkpoints where it matters.

No cloud dependency. No account required. Your recipes are portable JSON that you own.

---

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
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `apps/extension/dist`

---

## Architecture

```
┌─────────────────┐      WebSocket       ┌──────────────┐
│                 │◄───────────────────►│              │
│  Chrome Extension│                     │  Companion   │
│  (content + popup)│                    │  (Node server)│
│                 │                      │              │
└────────┬────────┘                      └──────┬───────┘
         │                                      │
         │  imports                              │  imports
         ▼                                      ▼
┌──────────────────────────────────────────────────────────┐
│                       Packages                           │
│                                                          │
│  shared ── recipe-dsl ── compiler ── runtime ── verifier │
│       model-router    storage    headless    starter-packs│
└──────────────────────────────────────────────────────────┘
```

---

## Core Concepts

| Concept | Description |
|---|---|
| **Recipe** | A portable sequence of browser steps — navigate, click, type, extract, wait. |
| **Run** | A single execution of a recipe, tracking status and step progress. |
| **Slot** | A named parameter in a recipe (e.g. `url`, `email`) filled at run time. |
| **Guard** | A precondition checked before a recipe runs — URL match, DOM element exists, etc. |
| **Checkpoint** | A pause point requiring human review before continuing. |
| **Pack** | A named collection of recipes bundled together for distribution. |

---

## Packages

| Package | Description |
|---------|-------------|
| `@quokka/shared` | Types, schemas, and event definitions (Zod) |
| `@quokka/recipe-dsl` | Fluent builder API for authoring recipes |
| `@quokka/compiler` | Natural language prompt to recipe compiler |
| `@quokka/runtime` | Step executor engine for running recipes |
| `@quokka/verifier` | Recipe validation and test harness |
| `@quokka/model-router` | LLM provider abstraction layer |
| `@quokka/storage` | Recipe and run persistence |
| `@quokka/headless` | Headless browser execution via Puppeteer |
| `@quokka/starter-packs` | Curated recipe collections to get started |
| `@quokka/companion` | Node.js WebSocket server (app) |
| `@quokka/extension` | Chrome extension — popup and content scripts (app) |

---

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

---

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

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

---

## License

[MIT](LICENSE)
