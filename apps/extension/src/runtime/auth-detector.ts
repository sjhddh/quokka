import type { Recipe } from '@quokka/shared'

export interface AuthCheck {
  hasAuth: boolean
  warnings: string[]
}

/** Common cookie name patterns that indicate an authenticated session */
const AUTH_COOKIE_PATTERNS = [
  /^session/i,
  /^token/i,
  /^auth/i,
  /^sid$/i,
  /^jwt/i,
  /^_session/i,
  /^connect\.sid$/i,
  /^access.token/i,
  /^refresh.token/i,
  /^logged.in/i,
  /^user.?id/i,
  /^JSESSIONID$/i,
  /^PHPSESSID$/i,
  /^csrftoken/i,
  /^_csrf/i,
]

/**
 * Extract the domain from a host string.
 * Handles both bare domains ("linkedin.com") and full URLs.
 */
function extractDomain(host: string): string {
  try {
    if (host.includes('://')) {
      return new URL(host).hostname
    }
    // Strip any path or port
    return host.split('/')[0].split(':')[0]
  } catch {
    return host
  }
}

/**
 * Check if a cookie name looks like an auth/session cookie.
 */
function isAuthCookie(name: string): boolean {
  return AUTH_COOKIE_PATTERNS.some((pattern) => pattern.test(name))
}

/**
 * Check whether the user appears to be authenticated for the domains
 * referenced by a recipe. Uses chrome.cookies API to inspect session cookies.
 *
 * Returns warnings (non-blocking) when no auth cookies are found for a host.
 */
export async function checkAuthContext(recipe: Recipe): Promise<AuthCheck> {
  if (!recipe.hosts || recipe.hosts.length === 0) {
    return { hasAuth: true, warnings: [] }
  }

  // chrome.cookies may not be available (e.g. in tests or if permission not granted)
  if (typeof chrome === 'undefined' || !chrome.cookies) {
    return { hasAuth: true, warnings: [] }
  }

  const warnings: string[] = []
  let allHaveAuth = true

  for (const host of recipe.hosts) {
    const domain = extractDomain(host)

    try {
      const cookies = await chrome.cookies.getAll({ domain })
      const authCookies = cookies.filter((c) => isAuthCookie(c.name))

      if (authCookies.length === 0) {
        allHaveAuth = false
        warnings.push(`No login cookies found for ${domain} — you may need to sign in first`)
      }
    } catch {
      // If cookie access fails, don't block — just warn
      warnings.push(`Could not check auth state for ${domain}`)
    }
  }

  return { hasAuth: allHaveAuth || warnings.length === 0, warnings }
}
