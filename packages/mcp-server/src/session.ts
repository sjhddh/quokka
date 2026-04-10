/**
 * SessionManager — manages browser sessions across agent turns.
 *
 * Sessions are keyed by session_id (auto-generated if not provided).
 * Each session stores: browser instance, page, plan cache, execution history.
 * Auto-cleanup after 10 minutes of inactivity.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { PlanCache, MemoryPlanCacheStorage } from '@quokka/core'
import { nanoid } from 'nanoid'

const SESSION_TTL_MS = 10 * 60 * 1000 // 10 minutes

export interface Session {
  id: string
  browser: Browser
  context: BrowserContext
  page: Page
  planCache: PlanCache
  history: Array<{ tool: string; intent: string; timestamp: number }>
  lastAccess: number
}

export class SessionManager {
  private sessions = new Map<string, Session>()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Run cleanup every 60 seconds
    this.cleanupTimer = setInterval(() => this.evictStale(), 60_000)
  }

  /**
   * Get an existing session or create a new one.
   * Touching a session resets its inactivity timer.
   */
  async getOrCreateSession(id?: string): Promise<Session> {
    const sessionId = id ?? nanoid(12)

    const existing = this.sessions.get(sessionId)
    if (existing) {
      existing.lastAccess = Date.now()
      return existing
    }

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    })
    const page = await context.newPage()
    const planCache = new PlanCache(new MemoryPlanCacheStorage())

    const session: Session = {
      id: sessionId,
      browser,
      context,
      page,
      planCache,
      history: [],
      lastAccess: Date.now(),
    }

    this.sessions.set(sessionId, session)
    return session
  }

  /**
   * Close and remove a specific session.
   */
  async closeSession(id: string): Promise<void> {
    const session = this.sessions.get(id)
    if (!session) return
    this.sessions.delete(id)
    try {
      await session.browser.close()
    } catch {
      // Browser may already be closed
    }
  }

  /**
   * Close all sessions and stop the cleanup timer.
   */
  async closeAll(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    const ids = Array.from(this.sessions.keys())
    await Promise.all(ids.map((id) => this.closeSession(id)))
  }

  /**
   * Evict sessions that have been inactive longer than SESSION_TTL_MS.
   */
  private evictStale(): void {
    const now = Date.now()
    for (const [id, session] of this.sessions) {
      if (now - session.lastAccess > SESSION_TTL_MS) {
        this.closeSession(id).catch(() => {})
      }
    }
  }
}
