/**
 * quokka_observe — Observe a page and answer a question about it.
 *
 * Navigates to the URL, captures a sanitized DOM snapshot,
 * then uses the LLM to answer the question from the DOM.
 */

import type { LLMProvider, ChatMessage } from '@quokka/core'
import { capturePlaywrightSnapshot } from '@quokka/runner-playwright'
import type { SessionManager } from '../session.js'

export interface ObserveInput {
  url: string
  question: string
  session_id?: string
}

export interface ObserveOutput {
  answer: string
  page_title: string
  url: string
}

export async function handleObserve(
  input: ObserveInput,
  sessionManager: SessionManager,
  llmProvider: LLMProvider,
): Promise<ObserveOutput> {
  const session = await sessionManager.getOrCreateSession(input.session_id)

  session.history.push({
    tool: 'quokka_observe',
    intent: input.question,
    timestamp: Date.now(),
  })

  // Navigate to the target URL
  await session.page.goto(input.url, { waitUntil: 'domcontentloaded' })

  // Capture sanitized DOM snapshot
  const snapshot = await capturePlaywrightSnapshot(session.page)

  // Build a compact representation of the accessibility tree for the LLM
  const treeText = snapshot.accessibilityTree
    .filter((node) => node.visible)
    .map((node) => `[${node.role}] "${node.name}" (${node.selector})`)
    .join('\n')

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a browser observation assistant. You are given a DOM snapshot of a web page as an accessibility tree. Answer the user's question based solely on what is visible in the DOM. Be concise and factual. If the answer cannot be determined from the DOM, say so.`,
    },
    {
      role: 'user',
      content: `Page URL: ${snapshot.url}
Page Title: ${snapshot.title}

Accessibility Tree:
${treeText}

Question: ${input.question}`,
    },
  ]

  const answer = await llmProvider.complete(messages)

  return {
    answer,
    page_title: snapshot.title,
    url: snapshot.url,
  }
}
