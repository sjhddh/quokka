# Community Recipes

User-contributed automation recipes for Quokka.

## What's a recipe file?

Each `.quokka.json` file is a `QuokkaExport` object containing a recipe and metadata. The schema is defined in `packages/shared/src/schemas/recipe.ts`.

### Minimal structure

```json
{
  "quokka_version": "0.1.0",
  "exported_at": "2025-01-01T00:00:00.000Z",
  "recipe": {
    "id": "unique-recipe-id",
    "name": "My Recipe",
    "description": "What this recipe does",
    "version": "0.1.0",
    "schemaVersion": 1,
    "hosts": ["example.com"],
    "slots": [],
    "guards": [],
    "steps": [
      { "type": "navigate", "url": "https://example.com" }
    ],
    "meta": {
      "createdFrom": "code",
      "tags": ["example"]
    }
  }
}
```

## How to contribute a recipe

1. Create a `.quokka.json` file with a descriptive name (e.g. `github-star-repo.quokka.json`).
2. Make sure it follows the `QuokkaExport` schema above.
3. Test it by importing it into the Quokka extension.
4. Open a PR adding the file to this directory.

See the `example/` folder for working examples you can use as templates.

## Tips

- Use descriptive `name` and `description` fields so others know what the recipe does.
- Add `slots` for any values that vary between runs (URLs, search terms, etc.).
- Use `guards` to verify the recipe is on the right page before executing.
- Add `checkpoint` steps before destructive actions so users can review.
- Tag your recipes in `meta.tags` so they're easy to find.
