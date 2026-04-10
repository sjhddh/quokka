/**
 * Simple bearer token auth for the MCP server.
 *
 * If QUOKKA_MCP_TOKEN is set, validates the token on each request.
 * If not set, runs without auth (local dev mode).
 */

const TOKEN = process.env.QUOKKA_MCP_TOKEN

export function isAuthEnabled(): boolean {
  return TOKEN != null && TOKEN.length > 0
}

export function validateToken(bearer: string | undefined): boolean {
  if (!isAuthEnabled()) return true
  if (!bearer) return false
  // Accept "Bearer <token>" or raw token
  const raw = bearer.startsWith('Bearer ') ? bearer.slice(7) : bearer
  return raw === TOKEN
}
