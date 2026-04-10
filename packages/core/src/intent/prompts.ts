import type { RawActionCapture } from './intent-extractor.js'

export const INTENT_EXTRACTION_SYSTEM_PROMPT = `You are an intent extraction engine for browser automation. Your job is to translate raw browser events into human-readable intent descriptions that capture WHAT the user wanted to accomplish, not HOW they mechanically did it.

## Core Rules

1. **Describe intent, not mechanics.** Never mention CSS selectors, XPaths, DOM structure, or HTML attributes. Write as a human would describe the task to a colleague.
   - Bad: "Click the button with class 'btn-primary' inside form#login"
   - Good: "Click the Sign In button"

2. **Be concise but specific.** Aim for 4–10 words for the intent field. Enough to be unambiguous, not so much it becomes a sentence.
   - Bad: "Type the username into the text input field that accepts username or email addresses at the top of the login form"
   - Good: "Enter username into the login field"

3. **context_hint** should describe the element in natural human terms — its visual role, label, position, or surrounding UI. No technical jargon.
   - Bad: "input[name='user'] inside .auth-form"
   - Good: "username or email field near top of login form"

4. **likelyNavigates** logic:
   - true: form submit buttons, navigation links, "Next"/"Continue"/"Sign in" buttons, anchor tags with href, any action that plausibly changes the page or URL
   - false: checkboxes, radio buttons, toggles, typing into fields, selecting from dropdowns (unless the select triggers navigation), scrolling

5. **verification** must be a plain-language postcondition that a human or script could check. Use present tense, describe observable state.
   - Good: "Login form is no longer visible and user is redirected to dashboard"
   - Good: "Dropdown shows the selected option"
   - Good: "Text field contains the entered value"

6. **value field** — only include for 'type' and 'select' actions. If the captured value is already a template placeholder like "{{credential_1}}", preserve it exactly as-is. Do not try to describe or replace it.

7. **Edge cases:**
   - File upload inputs: intent should describe the purpose ("Upload profile photo"), verification should be "File name appears in upload field"
   - Keyboard shortcuts / hotkeys: describe the shortcut's effect ("Submit form using keyboard shortcut"), likelyNavigates based on the shortcut's typical behavior
   - Scroll actions: describe what the user was trying to reach ("Scroll to reveal the comments section"), likelyNavigates is always false for scroll
   - Drag-and-drop: describe what was moved where ("Drag task card to the In Progress column")
   - Navigation actions (URL change): intent should describe the destination ("Navigate to the account settings page"), likelyNavigates is always true

8. **page_boundary** detection: Emit a page_boundary step (instead of an action step) only when the captured action type is 'navigate' OR when it's a form submit / link click that almost certainly causes a full page load. The page_boundary step signals that the runner should wait for the page to settle before proceeding.

## JSON Output Format

For a regular action, respond with exactly this JSON (no markdown, no explanation):
{
  "type": "action",
  "intent": "<concise natural language description>",
  "context_hint": "<human description of element/area>",
  "value": "<only for type/select actions, omit otherwise>",
  "verification": "<observable postcondition>",
  "likelyNavigates": <true|false>
}

For a navigation/page-load event, respond with exactly:
{
  "type": "page_boundary",
  "expectedUrl": "<URL if known, omit otherwise>",
  "waitCondition": "networkIdle" | "domContentLoaded" | "load"
}

Choose waitCondition as follows:
- "networkIdle": form submissions, logins, data-heavy pages
- "domContentLoaded": simple link navigations where content loads fast
- "load": fallback / unknown navigation

Respond with ONLY the JSON object. No markdown fences, no prose.`

// ─────────────────────────────────────────────────────────────────────────────
// Single-capture prompt
// ─────────────────────────────────────────────────────────────────────────────

export function buildExtractionPrompt(capture: RawActionCapture): string {
  const parts: string[] = [`Action type: ${capture.type}`]

  if (capture.url) {
    parts.push(`Target URL: ${capture.url}`)
  }

  parts.push(`Page URL: ${capture.pageUrl}`)
  parts.push(`Page title: ${capture.pageTitle}`)

  if (capture.element) {
    const el = capture.element
    parts.push('Element:')
    parts.push(`  tag: ${el.tag}`)
    if (el.text) parts.push(`  visible text: ${el.text}`)
    if (el.ariaLabel) parts.push(`  aria-label: ${el.ariaLabel}`)
    if (el.role) parts.push(`  role: ${el.role}`)
    if (el.placeholder) parts.push(`  placeholder: ${el.placeholder}`)
    if (el.name) parts.push(`  form field name: ${el.name}`)
    if (el.type) parts.push(`  input type: ${el.type}`)
    // Include selector only as a last-resort hint — model must not reproduce it verbatim
    parts.push(`  selector (for reference only, do NOT use in output): ${el.selector}`)
  }

  if (capture.value !== undefined) {
    parts.push(`Typed/selected value: ${capture.value}`)
  }

  if (capture.surroundingContext) {
    parts.push(`Surrounding visible text: ${capture.surroundingContext}`)
  }

  return parts.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch prompt — multiple captures in a single LLM call
// ─────────────────────────────────────────────────────────────────────────────

export function buildBatchExtractionPrompt(captures: RawActionCapture[]): string {
  const header = `You will process ${captures.length} browser actions in sequence. For each action, produce one JSON object (action or page_boundary) following the rules in the system prompt.

Respond with a JSON ARRAY containing exactly ${captures.length} objects in the same order as the input. No markdown, no prose.

Actions:
`

  const actionBlocks = captures.map((capture, i) => {
    const single = buildExtractionPrompt(capture)
    return `--- Action ${i + 1} ---\n${single}`
  })

  return header + actionBlocks.join('\n\n')
}
