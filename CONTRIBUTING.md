# Contributing to Quokka

Thanks for your interest in contributing to Quokka!

## Development Setup

1. **Prerequisites**: Node.js 18+ and [pnpm](https://pnpm.io/) 9+

2. **Clone and install**:
   ```bash
   git clone https://github.com/niceboss/quokka.git
   cd quokka
   pnpm install
   ```

3. **Build all packages**:
   ```bash
   pnpm build
   ```

4. **Run tests**:
   ```bash
   pnpm test
   ```

## Project Structure

This is a pnpm workspace monorepo. Packages live in `packages/` and apps in `apps/`. Each package has its own `tsconfig.json` extending the root `tsconfig.base.json`.

## Making Changes

1. Create a feature branch from `main`.
2. Make your changes in the relevant package(s).
3. Add or update tests as needed.
4. Run `pnpm build` and `pnpm test` to verify everything passes.
5. Open a pull request with a clear description of the change.

## Code Style

- TypeScript strict mode throughout.
- Use Zod schemas for runtime validation (defined in `@quokka/shared`).
- Prefer explicit types over `any`.
- Keep packages focused — shared types go in `@quokka/shared`.

## Adding a Starter Recipe

1. Create a new file in `packages/starter-packs/src/recipes/`.
2. Export a `Recipe` object that conforms to `RecipeSchema`.
3. Add a test in `src/__tests__/validate.test.ts` to validate the recipe.
4. Re-export from `src/index.ts`.
5. Optionally add the recipe ID to a pack in `src/packs/`.

## Questions?

Open an issue or start a discussion on GitHub.
