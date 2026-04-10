# Good First Issues

Concrete, well-scoped issues for new contributors. Pick one that interests you, open an issue referencing it, and submit a PR!

---

### 1. Add a community recipe: Wikipedia article search
**Difficulty:** Easy

Write a `.quokka.json` recipe that navigates to Wikipedia, searches for a term (via a slot), and extracts the article summary.

**Files involved:** `community-recipes/`

---

### 2. Add a community recipe: YouTube video search
**Difficulty:** Easy

Create a recipe that goes to YouTube, types a search query, and extracts the titles of the first page of results.

**Files involved:** `community-recipes/`

---

### 3. Improve error message when a recipe has no steps
**Difficulty:** Easy

When a recipe with an empty `steps` array is validated, the error message is generic. Add a `.min(1)` constraint to `steps` in `RecipeSchema` with a clear message like "Recipe must have at least one step."

**Files involved:** `packages/shared/src/schemas/recipe.ts`, `packages/shared/src/__tests__/schemas.test.ts`

---

### 4. Add test coverage for QuokkaExport schema validation
**Difficulty:** Easy

Write tests in `packages/shared` that validate correct and malformed `QuokkaExport` objects, covering edge cases like missing `recipe`, invalid `quokka_version`, etc.

**Files involved:** `packages/shared/src/__tests__/schemas.test.ts`

---

### 5. Add `aria-label` locator examples to documentation
**Difficulty:** Easy

The README and CONTRIBUTING docs only show `css` selector examples. Add examples showing `ariaLabel` and `text` locators so contributors know these options exist.

**Files involved:** `README.md`, `CONTRIBUTING.md`, `community-recipes/README.md`

---

### 6. Add keyboard shortcut to open the extension popup
**Difficulty:** Medium

Register a Chrome command (e.g. `Ctrl+Shift+Q`) in the WXT manifest config that opens the Quokka popup. Requires adding a `commands` entry to the manifest.

**Files involved:** `apps/extension/wxt.config.ts`, `apps/extension/src/`

---

### 7. Improve tooltip text on the extension popup buttons
**Difficulty:** Easy

The popup buttons (Watch, Run, etc.) could have more descriptive `title` attributes so users see helpful tooltips on hover.

**Files involved:** `apps/extension/src/`

---

### 8. Add `select` step type to the example recipes
**Difficulty:** Easy

None of the current example recipes demonstrate the `select` step type (for dropdowns). Create a community recipe that uses it, e.g. selecting a language on a settings page.

**Files involved:** `community-recipes/`

---

### 9. Write a test for the `hover` step schema
**Difficulty:** Easy

The `hover` step type exists in `StepSchema` but may not have dedicated test coverage. Add a test that validates a hover step with various locator combinations.

**Files involved:** `packages/shared/src/__tests__/schemas.test.ts`

---

### 10. Add JSON schema validation script for community recipes
**Difficulty:** Medium

Create a script (e.g. `scripts/validate-recipes.ts`) that reads all `.quokka.json` files in `community-recipes/` and validates them against `QuokkaExportSchema`. Wire it up as `pnpm run validate:recipes` in the root `package.json`.

**Files involved:** `scripts/validate-recipes.ts`, `package.json`
