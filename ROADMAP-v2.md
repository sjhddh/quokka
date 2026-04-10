# Quokka Roadmap v2

> Converged from 7-perspective panel debate: Product Vision, Growth Engine, Architecture Evolution, UX/DX, Open Source Ecosystem, Monetization, Quality & Polish.
> Previous roadmap (v1) Phase 1+2 complete. This roadmap covers the path from current state to v1.0.

---

## Key Decisions (Round 2)

| Debate | Verdict | Consensus |
|--------|---------|-----------|
| Recipe sharing model | **URL-based import, not file handoff.** JSON export stays as fallback. | 6/7 |
| Monetization anchor | **Scheduled runs + cloud sync, NOT hosted LLM.** LLM is add-on, not centerpiece. | 5/7 |
| Do mode | **Stay shelved.** Watch gets smarter instead. Bring back only with proven demand. | 7/7 |
| Core package split | **Not yet.** Consolidate duplicate code first, split compiler/runtime only if subpath hack breaks. | 5/7 |
| Storage strategy | **IndexedDB as primary, chrome.storage as metadata cache.** 10MB ceiling must go. | 6/7 |
| When to monetize | **After 500 WAU + 3 organic testimonials.** Foundation first, revenue later. | 6/7 |
| Community platform | **GitHub Discussions now. Discord after 50+ active users.** | 5/7 |

---

## Phase 3A: Polish & Trust (v0.7, ~2 weeks)

> Theme: "Make what exists actually work perfectly."

### Build
- [ ] **Fix README** — update architecture diagram (3 packages, not 9), fix test count (320), update Quick Start to reflect companion-optional flow
- [ ] **CI/CD pipeline** — GitHub Actions: lint + type-check + tests + extension build + bundle size check. Flaky SSE test quarantined or fixed.
- [ ] **ESLint + Prettier** — strict ruleset, format-on-save, CI-enforced
- [ ] **Consolidate selector resolution** — single source of truth in content-executor, remove duplicate in handleStartRun (background/index.ts)
- [ ] **Error UX rewrite** — FailureOverlay: "Try again" / "Skip this step" / "Get help" (plain English, no dev jargon)
- [ ] **Pre-loaded demo recipe on install** — first-time users see a working recipe, not an empty library
- [ ] **Pill onboarding mode** — first launch: expanded coach state with animated guidance, collapses to pill after first recording
- [ ] **StepToast human language** — "Clicked the Sign In button" not "Step 3 captured"
- [ ] **Error boundaries on import/export UI** — malformed JSON fails gracefully, not silently
- [ ] **Remove dist/ from git** — .gitignore build artifacts, add build step to CI

### Do NOT Build
- New features. This phase is pure quality.

### Ship Criteria
> A contributor clones, runs `pnpm dev`, loads the extension, and has a passing CI pipeline — in under 5 minutes. README matches reality.

---

## Phase 3B: Viral Loop (v0.8, ~3 weeks)

> Theme: "Make sharing recipes actually spread."

### Build
- [ ] **URL-based recipe import** — `quokka://import?data=...` deep link that opens extension import preview. Base64-encoded recipe in URL param for small recipes, hosted URL for large ones.
- [ ] **One-click copy share link** — after recording, a "Share" button generates a link (not a file download). Use URL encoding for small recipes, GitHub Gist API (no auth, anonymous) for large ones.
- [ ] **Content script link detector** — detect `.quokka.json` links on any page, inject "Import to Quokka" button overlay
- [ ] **Import by paste** — textarea tab in ImportPreviewDialog alongside file picker
- [ ] **Domain-aware starter suggestion** — on install, detect active tab domain, surface matching starter recipe. Small JSON lookup table in background worker.
- [ ] **Post-replay rating prompt** — after 3 successful replays, non-intrusive "Rate on Chrome Web Store?" banner
- [ ] **Recipe meta enrichment** — add `meta.author`, `meta.runCount` (local, exported with recipe), `meta.description` for social proof at share point
- [ ] **Local usage stats dashboard** — popup "Stats" tab: recipes recorded/replayed, success rate, time saved estimate. Never exfiltrated.

### Do NOT Build
- Cloud sync, accounts, marketplace, backend services

### Ship Criteria
> A user can share a recipe via link (not file), and the recipient can import it in <10 seconds without prior Quokka knowledge.

---

## Phase 3C: Reliability & Depth (v0.9, ~4 weeks)

> Theme: "Make 'Run forever' actually mean forever."

### Build
- [ ] **Recipe health check / dry-run mode** — traverse DOM against recipe selectors without executing. Show pass/fail per step. Surface staleness before it bites.
- [ ] **Migrate primary storage to IndexedDB** — demote chrome.storage.local to metadata cache. IndexedDB has no practical quota. Update packages/storage repos.
- [ ] **Scheduling primitive** — `chrome.alarms` API for MV3-native cron (max 1/min). No backend needed. Schedule recipes from the pill sidebar.
- [ ] **Authenticated context detection** — before running, check if required cookies/tokens exist. Warn rather than silently fail.
- [ ] **Conditional logic in recipes** — if/else on element presence. Add `conditional` step type to schema. Compiler `validate-intent` stage for branch detection.
- [ ] **Self-healing selectors (fast path)** — LLM-free: broader CSS matching, partial class, parent-child heuristics in runtime executor. LLM fallback deferred to companion.
- [ ] **Watch dedup prompt** — when starting recording, scan existing recipes for similar page + action patterns. Surface "you may have done this before."
- [ ] **Recipe versioning** — schema field `meta.version` auto-incremented on edit. Timeline editor shows diff between versions.

### Do NOT Build
- Cloud-based scheduling, LLM self-healing, marketplace

### Ship Criteria
> A recipe recorded 30 days ago still works (or tells the user specifically what broke). Scheduling runs without a terminal or companion.

---

## Phase 4: Platform (v1.0, ~2 months)

> Theme: "Sustainable open-source product."

### Build
- [ ] **Chrome Web Store listing** — production build, store screenshots, listing copy optimized for "browser automation" / "macro recorder" keywords
- [ ] **Publish `@quokka/recipe-schema` to npm** — JSON schema + types for ecosystem tooling
- [ ] **Step type plugin interface** — documented `StepPlugin { type, handler, validate }` for custom step types
- [ ] **Event hooks API** — `onBeforeStep`, `onAfterStep`, `onError` for power user instrumentation
- [ ] **E2E test suite** — Playwright loading the real extension in Chrome, running 5 canonical scenarios
- [ ] **Companion scheduler** — SQLite-backed job queue, receives cron signals, executes via Playwright. Extension UI is read-only.
- [ ] **Pro tier ($7/mo or $59/yr)** — scheduled runs (cloud-triggered), recipe backup/sync, run history + failure alerts. License key check, offline-capable.
- [ ] **Payment integration** — Lemon Squeezy (handles VAT, built for indie). License key → capability set.
- [ ] **Firefox support** — WebExtension polyfill, manifest v2 compat layer

### Do NOT Build
- Enterprise tier, Safari, marketplace, mobile, hosted LLM as tier anchor

### Ship Criteria
> Listed on Chrome Web Store. 100+ WAU. Pro tier generating revenue. Recipe shared via link converts >10% to installs.

---

## Top 10 Priorities (Ranked by Cross-Panel Consensus)

| Rank | Priority | Phase | Panelist Support |
|------|----------|-------|-----------------|
| 1 | Fix README + CI/CD pipeline | 3A | 7/7 |
| 2 | URL-based recipe import (kill file handoff) | 3B | 6/7 |
| 3 | Pre-loaded demo recipe + pill onboarding | 3A | 6/7 |
| 4 | Error UX rewrite (plain English) | 3A | 5/7 |
| 5 | Recipe health check / dry-run | 3C | 5/7 |
| 6 | Scheduling via chrome.alarms | 3C | 5/7 |
| 7 | IndexedDB migration | 3C | 5/7 |
| 8 | Chrome Web Store listing | 4 | 4/7 |
| 9 | Consolidate duplicate selector logic | 3A | 4/7 |
| 10 | Local usage stats dashboard | 3B | 3/7 |

---

## Anti-Goals (Reinforced)

- **Not an AI product.** LLM stays as convenience layer, never the pitch. Self-healing is heuristic-first.
- **Not a cloud platform.** Paid tier is infrastructure (scheduling, sync), not feature gates on the extension.
- **Not enterprise software.** Pro tier for solo devs. Teams only if revenue demands.
- **Not a testing framework.** E2E tests are internal quality, not a user feature.
- **Accounts are poison (for now).** No sign-up walls. Viral loop must work without accounts.

---

## Architecture Direction

```
Phase 3A: Fix trust signals (CI, README, error UX)
     ↓
Phase 3B: Fix viral loop (URL import, share links, onboarding)
     ↓
Phase 3C: Fix reliability (health checks, IndexedDB, scheduling, conditionals)
     ↓
Phase 4:  Ship to market (CWS, Pro tier, Firefox, npm schema)
```

Estimated total: ~10 weeks of focused development to v1.0.

---

*Generated by 7-agent debate panel (Round 2), 2026-04-10*
*Panelists: Product Vision, Growth Engine, Architecture Evolution, UX/DX, OSS Ecosystem, Monetization, Quality & Polish*
