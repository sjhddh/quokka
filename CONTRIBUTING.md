# Contributing to Quokka

Thanks for your interest in contributing to Quokka! This guide will get you set up and explain how things work.

## Quick Start

**Prerequisites:** Node.js 18+ and [pnpm](https://pnpm.io/) 9+

```bash
git clone https://github.com/niceboss/quokka.git
cd quokka
pnpm install
pnpm build
pnpm test        # all tests should pass
```

### Load the Extension in Chrome

1. Run `cd apps/extension && pnpm build`
2. Open `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `apps/extension/dist` folder
5. The Quokka icon should appear in your toolbar

### Dev Mode

```bash
pnpm dev   # watches all packages in parallel
```

For the companion server alone:

```bash
pnpm --filter @quokka/companion dev
```

## Project Structure

```
quokka/
├── apps/
│   ├── extension/        # Chrome MV3 extension (WXT + React)
│   └── companion/        # Node.js WebSocket server
├── packages/
│   ├── shared/           # Types, Zod schemas, events (the source of truth)
│   ├── core/             # Recipe DSL, compiler, runtime, verifier
│   └── storage/          # Recipe and run persistence
├── community-recipes/    # User-contributed recipe JSON files
├── vitest.workspace.ts   # Workspace-level test config
├── tsconfig.base.json    # Shared TS config
└── pnpm-workspace.yaml
```

Each package has its own `tsconfig.json` extending the root `tsconfig.base.json` and its own `vitest.config.ts`.

## Code Style

- **TypeScript strict mode** throughout — no `any` unless truly unavoidable.
- **Zod** for all runtime validation. Schemas live in `@quokka/shared`.
- **Vitest** for testing. Each package has co-located `__tests__/` directories.
- Keep packages focused: shared types go in `@quokka/shared`, not duplicated.

## Making Changes

1. **Fork** the repo and create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Make your changes in the relevant package(s).
3. Add or update tests for any new behavior.
4. Verify everything works:
   ```bash
   pnpm build && pnpm test && pnpm lint
   ```
5. Open a **pull request** against `main` with a clear description.

### Commit Message Convention

Use conventional prefixes:

| Prefix | When to use |
|--------|-------------|
| `feat:` | New feature or capability |
| `fix:` | Bug fix |
| `refactor:` | Code restructuring without behavior change |
| `docs:` | Documentation only |
| `test:` | Adding or updating tests |
| `chore:` | Build, CI, dependency updates |

Examples:
```
feat: add hover step type to recipe DSL
fix: recipe validation rejects valid checkpoint steps
docs: update CONTRIBUTING with recipe contribution guide
```

## Contributing Recipes

Community recipes live in `community-recipes/`. To contribute one:

1. Create a `.quokka.json` file following the `QuokkaExport` schema (see `packages/shared/src/schemas/recipe.ts`).
2. Place it in `community-recipes/` — use a descriptive filename like `github-star-repo.quokka.json`.
3. Validate it against the schema:
   ```bash
   pnpm --filter @quokka/shared test
   ```
4. Add a brief description in your PR.

See `community-recipes/README.md` and the examples in `community-recipes/example/` for reference.

## Adding a Starter Recipe (in-tree)

For recipes bundled with the extension:

1. Create a new file in `packages/starter-packs/src/recipes/`.
2. Export a `Recipe` object that conforms to `RecipeSchema`.
3. Add a test in `src/__tests__/validate.test.ts`.
4. Re-export from `src/index.ts`.

## Questions?

Open an [issue](https://github.com/niceboss/quokka/issues) or start a [discussion](https://github.com/niceboss/quokka/discussions) on GitHub. We're happy to help!
