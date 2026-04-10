# Quokka Roadmap v3 — LLM-Native Open Source (Converged)

> **Multi-round convergence**: 7 agents × 2 rounds (critique → defense → synthesis).
> Round 1: 7 critics identified 5 FATAL, 3 CRITICAL, 8 MAJOR flaws.
> Round 2: 6 defenders proposed fixes, 1 convergence architect triaged and synthesized.
> **All FATAL/CRITICAL issues resolved below.**
>
> Core directive: "LLM是核心引擎。用户第一秒就贴API key。智能浏览器助手，不是rule-based repeater。"
> **100% free and open source. BYOK only. No cloud, no accounts.**

---

## Key Decisions (Final Converged)

| Debate | Verdict | Consensus |
|--------|---------|-----------|
| LLM role | **Core engine. Intent-based planning, not selector replay.** | 7/7 |
| Monetization | **None. Pure OSS, MIT/Apache-2.0. BYOK only.** | 7/7 |
| Planning architecture | **Per-page planning (not single-call). One LLM call per page boundary.** | 7/7 (fixed from R1) |
| Recipe format | **Intent-based `.qk` v2 with explicit page boundaries.** | 7/7 (fixed from R1) |
| Target audience (v1) | **Developers + technical prosumers. NOT non-technical users yet.** | 6/7 (converged from R1/R2) |
| Free LLM path | **Chrome Built-in AI + Ollama. Guided mode (no LLM) as deterministic fallback.** | 6/7 |
| Security baseline | **DOM sanitization, credential exclusion, MCP auth — required before beta.** | 7/7 (added from R1) |
| Positioning | **"Open, model-agnostic browser automation layer" — the thing Anthropic will never build.** | 6/7 |

---

## Mission

**Give every developer and AI agent an intelligent, open-source browser automation layer that understands intent, adapts to change, and runs on any LLM — locally, privately, and forever free.**

---

## Positioning

### Tagline
> **Browser automation that thinks. Open. Model-agnostic. Yours.**

### Extended Positioning
Quokka is an **LLM-native** browser automation framework. Unlike macro recorders that replay brittle click sequences, Quokka understands your *intent* and uses AI to execute it on the live page — adapting to changes, handling edge cases, and learning from context.

- **Model-agnostic** — runs on OpenAI, Anthropic, Google, FLOCK, Ollama, or any compatible endpoint. BYOK.
- **Intent-driven** — records what you *meant*, not what you *clicked*. Recipes survive site redesigns.
- **Extension + headless** — same `.qk` recipe runs in Chrome sidebar and CI pipeline.
- **Agent-ready** — the browser skill layer for Claude, GPT, and any MCP-compatible AI agent.
- **Auditable** — you read the source, you own the data, you own your keys.

### Contrarian Stances
- **"AI is the execution path, not the recovery path."** The LLM plans every run. Deterministic replay is a cache optimization.
- **"No accounts. No cloud. No lock-in."** Your recipes are files. Your API key stays on your device.
- **"If your agent can't browse the web, it's not an agent."** Quokka is the missing browser primitive.
- **"Recording is teaching, not programming."** You show Quokka once. It understands what you meant.

### Competitive Moat
Anthropic/OpenAI will ship first-party browser tools. They will be model-locked, cloud-dependent, and opaque. Quokka is the **model-agnostic, self-hostable, auditable** alternative. Every enterprise with compliance requirements, every developer who won't send browsing sessions to a single vendor — that's our permanent wedge.

---

## Architecture

### The Three Primitives

```
Intent Recipe (.qk v2)  — what the user wants, with page boundaries
LLM Planner              — turns intent into actions per page context
Runner Adapter           — execution engine (Playwright / CDP / Extension)
```

### Intent-Based Recipe Format (.qk v2)

```json
{
  "version": "2.0",
  "intent": "Log in and download this month's invoices",
  "steps": [
    {
      "id": "step-1",
      "type": "action",
      "intent": "Enter username into the login field",
      "context_hint": "username or email input near top of login form",
      "value": "{{username}}",
      "verification": "field contains the entered value",
      "likelyNavigates": false
    },
    {
      "id": "step-2",
      "type": "action",
      "intent": "Click the login button",
      "context_hint": "primary submit button, labeled Sign In / Login",
      "likelyNavigates": true
    },
    {
      "id": "step-3",
      "type": "page_boundary",
      "expectedUrl": "/dashboard",
      "waitCondition": "networkIdle"
    },
    {
      "id": "step-4",
      "type": "action",
      "intent": "Navigate to invoices and download current month PDF",
      "context_hint": "billing or invoices link in navigation, then download",
      "verification": "PDF file downloaded",
      "likelyNavigates": false
    }
  ],
  "variables": { "username": "" }
}
```

**Key changes from Round 1:**
- `type: "action" | "page_boundary"` — explicit navigation markers
- `likelyNavigates` flag on actions — signals executor to pause and re-plan
- `expectedUrl` + `waitCondition` on page boundaries
- No selectors stored. LLM plans them at runtime per live DOM.

### LLM Execution Flow (Per-Page Planning)

```
Recording Phase:
  User action → Content script captures context
  → Credential fields auto-redacted (password, CC, SSN patterns)
  → IntentExtractor (LLM, async, 400ms debounce) → Intent step in .qk
  → Step-level inline confirmation in sidebar

Execution Phase:
  Load .qk → For each page phase:
    1. Capture compressed DOM (accessibility tree, interactive nodes only)
    2. DOM sanitization (strip hidden/invisible/injected elements)
    3. ExecutionPlanner (1 LLM call per page) → action plan with selectors
    4. Execute steps locally (pure JS, fast)
    5. On navigation → checkpoint state → re-capture new page DOM → re-plan
    6. On failure → ExceptionHandler (LLM call) → retry with broader context
    7. Verify page-boundary transitions (lightweight, heuristic-first)
  → Return structured result
```

**Critical invariants:**
- One LLM planning call **per page boundary**, not per recipe or per step
- Steps within a page execute as pure JavaScript after planning
- Exception LLM calls only fire on step failure
- Plan cache keyed on structural DOM fingerprint, not just TTL

### Core TypeScript Interfaces

```typescript
// Intent-based recipe with page boundaries
type RecipeStep =
  | ActionStep
  | PageBoundary

interface ActionStep {
  id: string
  type: 'action'
  intent: string
  context_hint?: string
  value?: string                    // supports {{template}} variables
  verification?: string             // postcondition (heuristic-checked first)
  likelyNavigates: boolean          // signals re-plan after execution
}

interface PageBoundary {
  id: string
  type: 'page_boundary'
  expectedUrl?: string              // URL pattern to wait for
  waitCondition?: 'networkIdle' | 'domContentLoaded' | 'load'
}

interface QuokkaRecipe {
  version: '2.0'
  intent: string
  steps: RecipeStep[]
  variables?: Record<string, string>
}

// Per-page planning
interface PlanningPhase {
  pageContext: PageSnapshot
  plannedSteps: PlannedAction[]
}

interface PlanningSession {
  recipeId: string
  phases: PlanningPhase[]           // grows as pages are encountered
  checkpoint: ExecutionCheckpoint   // persisted for MV3 resilience
}

interface PlannedAction {
  action: 'click' | 'type' | 'select' | 'scroll' | 'wait' | 'navigate'
  selector: string                  // computed at runtime by LLM
  value?: string
  confidence: number
  reasoning: string
}

// Page context (compressed, sanitized)
interface PageSnapshot {
  url: string
  title: string
  structuralHash: string            // for cache invalidation
  accessibilityTree: AccessNode[]   // visible, interactive nodes only
}

interface AccessNode {
  role: string
  name: string
  selector: string
  visible: boolean
}

// Provider abstraction
interface LLMProvider {
  complete(messages: Message[], options: CompletionOptions): Promise<string>
  stream?(messages: Message[], options: CompletionOptions): AsyncIterable<string>
}
```

### Developer API: The `intent()` Primitive

```typescript
import { defineRecipe, step, intent, pageBoundary } from "@quokka/core"

export default defineRecipe({
  name: "checkout-flow",
  description: "Add item to cart and complete checkout",

  steps: [
    step.navigate("https://shop.example.com"),
    step.click('[data-testid="add-to-cart"]'),

    pageBoundary({ expectedUrl: "/cart" }),

    intent("Fill in shipping form with test data", {
      hints: ["form layout varies by region"],
    }),

    step.assert("Order confirmation page is shown"),
  ],

  onFailure: "heal"
})
```

### CLI

```bash
quokka create "log in with SSO and verify dashboard loads"  # NL → recipe
quokka run checkout-flow --env staging                       # execute
quokka plan checkout-flow                                    # dry run
npx quokka demo                                              # zero-setup demo (reads env API key)
```

### Configuration

```typescript
// quokka.config.ts
import { defineConfig } from "@quokka/core"

export default defineConfig({
  llm: {
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY,
    cache: {
      enabled: true,
      invalidation: "structural",   // DOM fingerprint, not just TTL
      ttlFloor: "24h"              // minimum cache lifetime
    }
  },
  security: {
    sanitizeDOM: true,              // strip hidden/invisible elements
    redactCredentials: true,        // auto-redact password fields
    mcpAuth: "token"                // require bearer token for MCP
  },
  browser: {
    headless: process.env.CI === "true",
  }
})
```

### Supported LLM Providers (御三家 + FLOCK)

All providers are **BYOK** — users bring their own API key. Quokka is 100% free and open source.

| Provider | Schema | Auth | Notes |
|----------|--------|------|-------|
| **OpenAI** (GPT-4o, GPT-4o-mini) | OpenAI native | `Authorization: Bearer` | 御三家 — first-class support |
| **Anthropic** (Claude Sonnet, Haiku) | Anthropic Messages API | `x-api-key` | 御三家 — first-class support |
| **Google** (Gemini Pro, Flash) | Gemini API | API key param | 御三家 — first-class support |
| **FLOCK** (Qwen3, etc.) | OpenAI-compatible | `x-litellm-api-key` | `api.flock.io/v1` — opt-in only, data disclosure required |
| **OpenAI-compatible** (Groq, Together, Ollama, LM Studio) | OpenAI chat/completions | `Authorization: Bearer` | One adapter covers all |

### Caching Strategy

```typescript
interface PlanCacheEntry {
  pageId: string
  structuralHash: string       // hash of pruned DOM skeleton (tags + ids, no text)
  plannedSteps: PlannedAction[]
  selectorConfidence: Map<string, number>  // EMA success scores
  cachedAt: number
  ttlFloor: number             // minimum TTL, secondary to hash check
}

// Cache hit requires structural hash match + TTL within bounds
// Any deploy that changes element structure busts the cache automatically
```

### MV3 Resilience (Fixed)

```
Service Worker: thin coordinator, no persistent state
  → chrome.alarms keep-alive every 25s during execution
  → All recipe state in chrome.storage.local (survives SW restart)

Offscreen Document: owns execution runtime
  → Maintains WebSocket/CDP connection
  → Checkpoints after every step
  → Resumes from checkpoint on SW restart

Content Script: DOM access layer
  → Captures accessibility tree
  → Sanitizes before sending to SW
  → Executes planned actions
```

### Security Architecture (Required Before Beta)

| Threat | Mitigation | Implementation |
|--------|-----------|----------------|
| DOM prompt injection | Strip hidden/invisible elements before LLM ingestion. Two-context architecture: DOM is data, not instructions. | DOM sanitizer in content script |
| Credential capture | Auto-redact `input[type=password]`, CC patterns, SSN patterns at capture layer BEFORE any LLM call. Template as `{{variable}}`. | Credential filter in recording pipeline |
| MCP unauthenticated access | Token-based auth generated at install. User-confirmed popup for new connections. | MCP auth middleware |
| "Local-first" misleading | Replace with "BYOK — your key, your provider." First-run disclosure of what data leaves device. | Onboarding copy + persistent indicator |
| Malicious shared recipes | Dry-run diff before execution. Destructive actions highlighted in red. Domain flagging for financial sites. | Recipe preview UI |
| API key storage | Encrypt at rest with user passphrase (PBKDF2 → AES-GCM). Passphrase never stored. | Key vault in extension |

### Fallback Without API Key

**No broken degraded mode.** Instead:
- **Guided mode** (no LLM): deterministic recording and replay using traditional selectors. High success rate (~95%) on stable sites. Limited feature set — no intent understanding, no adaptive replay.
- Clear feature gate: "Unlock smart mode with an API key."
- Chrome Built-in AI used automatically if available (zero config).
- No silent degradation. No 60% success rate. Either it works reliably or it tells you what's missing.

---

## Phase 5A: LLM Foundation
> Theme: "Intelligent from the first second."
> Estimated: 10-13 weeks (realistic, 1-2 person team)

### Build

- [ ] **`@quokka/core` extraction** — decouple from extension APIs. Pure Node.js module. Untangle chrome.* calls, IndexedDB, message passing.
  - Effort: 3 weeks (realistic)
  - Pass: `import { run } from '@quokka/core'` works in plain Node.js; extension tests pass

- [ ] **Intent-based `.qk` v2 schema** — new format with page boundaries, navigation markers. Migration tool v1 → v2.
  - Effort: 1 week
  - Pass: schema documented, migration tool works on existing recipes

- [ ] **LLM Provider abstraction** — `LLMProvider` interface + adapters for OpenAI, Anthropic, Google, FLOCK, Ollama, Chrome Built-in AI.
  - Effort: 1.5 weeks
  - Pass: all provider types work end-to-end

- [ ] **DOM sanitization + credential redaction** — strip hidden elements, auto-redact passwords/CC/SSN before any LLM call. **Security-critical, blocks all LLM features.**
  - Effort: 1 week
  - Pass: no password values in any LLM-bound payload; hidden DOM elements excluded

- [ ] **IntentExtractor v1** — recording-time LLM intent extraction. Scoped to 3 site types for v1 (SaaS dashboard, e-commerce, login flows). Eval harness for quality measurement.
  - Effort: 5 weeks (R&D, prompt engineering, eval)
  - Pass: produces clean intent steps on 3 target site types; eval harness measures accuracy

- [ ] **ExecutionPlanner v1** — per-page LLM planning. Takes intent + compressed DOM → action plan. Plan cache with structural fingerprint. Scoped to same 3 site types.
  - Effort: 5 weeks (core R&D, parallel with IntentExtractor after core extraction)
  - Pass: plans generated in <2s; cached plans reused; actions execute correctly on test sites

- [ ] **MV3 resilience** — offscreen document runtime, checkpoint/resume, alarms keep-alive.
  - Effort: 1 week
  - Pass: 20-step recipe survives service worker restart mid-execution

- [ ] **Recording sidebar with inline step editing** — shows intent per step during recording. User can edit individual steps before confirming.
  - Effort: 1 week
  - Pass: each recorded step shows intent inline; user can edit/correct before saving

### Phase 5A Parallelization
```
Week 1-3:   Core extraction (blocks everything)
Week 3-4:   Schema v2 + Provider abstraction + DOM sanitization (parallel)
Week 4-9:   IntentExtractor + ExecutionPlanner (parallel, both depend on core)
Week 9-10:  MV3 resilience + Sidebar redesign (parallel)
Week 10-11: Integration testing + bug fixes
```

### Do NOT Build in 5A
- MCP server, recipe registry, framework adapters
- Community model, telemetry pipeline
- Non-technical user onboarding (developers first)

### Ship Criteria for 5A
> A developer installs the extension, configures BYOK, demonstrates a multi-page workflow, sees per-step intent extraction, and replays with LLM-powered planning that adapts to minor DOM changes. Passwords never leave the device. Hidden DOM elements never reach the LLM.

---

## Phase 5B: Framework + CLI
> Theme: "npm install and go."
> Estimated: 6-8 weeks

### Build

- [ ] **`quokka` CLI** — `npx quokka init`, `quokka run`, `quokka create` (NL → recipe), `quokka plan`, `npx quokka demo` (zero-setup using env API key).
  - Effort: 2 weeks
  - Pass: `npx quokka demo` runs with just OPENAI_API_KEY in env; `quokka create` generates TypeScript recipe

- [ ] **`@quokka/runner-playwright` adapter** — wraps Playwright behind `IRunner`. Default for CLI/CI.
  - Effort: 1.5 weeks
  - Pass: `quokka run sample.qk` completes multi-page recipe headless

- [ ] **Plan caching + optimization** — structural fingerprint cache, recipe-first deterministic execution, DOM subtree windowing.
  - Effort: 1.5 weeks
  - Pass: repeat recipe runs on unchanged pages use 0 LLM calls

- [ ] **CI/CD integration** — GitHub Action `quokka-dev/action@v1`.
  - Effort: 1 week
  - Pass: recipe runs in GitHub Actions with cost reporting

- [ ] **Integration testing + QA** — cross-browser, cross-site, regression suite.
  - Effort: 1.5 weeks

### Ship Criteria for 5B
> `npm install @quokka/core @quokka/runner-playwright` — developer writes recipe with `intent()` primitives and runs in CI. `npx quokka demo` works with zero config if env API key exists.

---

## Phase 5C: Ecosystem
> Theme: "The browser skill layer for AI agents."
> Estimated: 8-10 weeks

### Build

- [ ] **`quokka-mcp` MCP Server** — intent-based tools: `quokka_execute(intent, context)`, `quokka_observe(url, question)`, `quokka_plan(goal)`. Token-based auth. Session persistence across agent turns.
  - Effort: 3 weeks
  - Pass: Claude Desktop invokes `quokka_execute` end-to-end; auth prevents unauthorized access; sessions persist

- [ ] **Framework adapters** — `quokka-langchain` (npm), `quokka-crewai` (PyPI). Thin MCP wrappers (~200 lines each).
  - Effort: 1.5 weeks
  - Pass: LangChain agent uses recipe as tool; CrewAI agent uses recipe as skill

- [ ] **8 seed recipes** (scoped down from 20 for v1) — covering: login flow, form fill, data export, search, dashboard navigation, e-commerce, CRM update, report download. Each with README + demo GIF.
  - Effort: 1.5 weeks
  - Pass: all 8 run successfully against live sites; demo GIFs recorded

- [ ] **`community-recipes` repo** — PR template, CI validation, contribution guide. Flagging system for broken recipes.
  - Effort: 1 week
  - Pass: CI validates schema on PR; health-check cron flags broken recipes

- [ ] **Chrome Web Store launch** — polished listing, developer-focused messaging.
  - Effort: 0.5 weeks

- [ ] **Launch content** — technical blog post (how the planner works), demo video, HN post.
  - Effort: 1.5 weeks

- [ ] **QA + hardening** — security audit, cross-site testing, beta feedback integration.
  - Effort: 2 weeks

### Ship Criteria for 5C
> Three things demonstrated: (1) developer runs `npx quokka run` in CI with intent-based recipes, (2) LLM agent invokes `quokka_execute` via MCP and completes a real browser task, (3) community can submit and discover recipes. All shown in the launch demo.

---

## The Launch Plan

### The Demo (Anchor Asset)

30-second video, three cuts:

1. **(0–10s)** Developer runs `npx quokka demo`. Quokka opens browser, executes a pre-built recipe, sidebar shows intent interpretation per step.
2. **(10–20s)** Site CSS changes (visible in devtools). `quokka run` again. Planner re-plans. "Adapted — found the button after layout change." Completes successfully.
3. **(20–30s)** Claude Desktop: "Download this month's invoices." Claude calls `quokka_execute` via MCP. Real browser opens, navigates, downloads. Terminal shows structured result.

### HN Post
**Title:** `Show HN: Quokka – open-source LLM-native browser automation (intent-based + MCP)`

### Positioning Note
> **Quokka is to browser automation what Cursor is to code editing.** Born LLM-native, not retrofitted. But unlike Cursor, Quokka is model-agnostic, fully open-source, and runs on your own API key.

---

## MCP Server Architecture

```
┌─────────────────────────────────────────────────────┐
│  CALLING AGENT (Claude / GPT / Custom)              │
│  Framework: LangChain / CrewAI / AutoGen / raw MCP  │
└──────────────────────┬──────────────────────────────┘
                       │  MCP protocol + bearer token auth
                       ▼
┌─────────────────────────────────────────────────────┐
│  QUOKKA MCP SERVER (authenticated)                  │
│  Intent Parser → Session Manager → Internal LLM     │
│  (goal → tasks)  (state across     (DOM reader →    │
│                   agent turns)      planner →        │
│                                     verifier)        │
└──────────────────────┬──────────────────────────────┘
                       │  CDP / WebDriver
                       ▼
┌─────────────────────────────────────────────────────┐
│  CHROME (Extension or Headless Playwright)          │
│  Sanitized DOM · Screenshots · Cookies · Real ctx   │
└──────────────────────┬──────────────────────────────┘
                       ▼
         { status, data, artifacts, session_id }
         → Returns to calling agent
```

**Dual-LLM boundary:** Calling agent = strategic planner (what to do). Quokka's LLM = browser tactician (how to do it on this specific page). Clean separation.

---

## What We Explicitly Won't Build

| Anti-goal | Reason |
|-----------|--------|
| Hosted LLM proxy | BYOK is the identity. Cloud dependency kills trust. |
| Paid tiers / freemium | Pure OSS. No friction on any feature. |
| Cloud accounts | Model-agnostic + local is the moat. |
| Full autonomous agent | Quokka executes browser tasks; agents call Quokka. Stay in lane. |
| Proprietary recipe format | Schema is public. Community owns the format. |
| Non-technical user focus (v1) | Developers first. Consumer UX is v2. |
| Per-step LLM in hot path | Plan per page, execute locally. Fast and cheap. |

---

## Timeline Summary (Realistic)

| Phase | Theme | Duration | Gate |
|-------|-------|----------|------|
| 5A: LLM Foundation | Core extraction + intent engine + security | 10-13 weeks | Multi-page intent recording + LLM replay working |
| 5B: Framework + CLI | npm packages + CLI + CI + caching | 6-8 weeks | `npx quokka demo` + CI integration |
| 5C: Ecosystem | MCP server + adapters + recipes + launch | 8-10 weeks | Demo video + HN + MCP working + CWS listed |

**Total: ~24-31 weeks** (realistic for 1-2 person team)
**Accelerated (with parallelization + scope cuts): ~20-22 weeks**

### Critical Path
```
Core extraction (3wk) → ExecutionPlanner (5wk) → CLI (2wk) → MCP Server (3wk) = 13 weeks
                      → IntentExtractor (5wk, parallel with Planner)
```

---

## Success Metrics (Honest)

| Metric | Target (90 days post-launch) |
|--------|------------------------------|
| GitHub stars | 300-500 (quality > quantity) |
| Community recipes submitted | 20 |
| Weekly active CLI users | 100 |
| `quokka-mcp` npm downloads/week | 200 |
| `@quokka/core` npm downloads/week | 150 |
| Seed recipe health rate | >80% passing weekly checks |

---

## Known Risks (Acknowledged)

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Anthropic ships first-party browser tool | HIGH | Model-agnostic positioning. Be the open alternative. |
| Stagehand captures developer mindset | MEDIUM | Ship MCP support first. Own the agent integration niche. |
| LLM API costs for users | LOW | BYOK — user manages their own costs. Caching minimizes calls. Ollama = free. |
| Recipe maintenance burden | MEDIUM | Automated health checks, community flagging, "best-effort" framing. |
| Sustainability without monetization | HIGH | Institutional adoption, contributor growth, potential future services tier. |

---

*Converged from 2 rounds × 7 agents: LLM-Core Architecture · UX & Onboarding · OSS+BYOK Strategy · Competitive Landscape · Performance & Cost · Developer Framework DX · Agentic/MCP Integration*

*Round 1 identified flaws. Round 2 defended and fixed. Convergence architect triaged. All FATAL issues resolved.*
