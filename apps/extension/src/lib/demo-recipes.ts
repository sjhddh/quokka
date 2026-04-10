import type { Recipe } from '@quokka/shared'

const now = new Date().toISOString()

/**
 * Pre-loaded demo recipes shown on first install.
 * Marked with `meta.isDemo: true` so they can be identified/hidden later.
 */
export const DEMO_RECIPES: Recipe[] = [
  {
    id: 'demo-google-search',
    name: 'Google Search & Screenshot',
    description:
      'Navigate to Google, type a search query, and wait for results to load.',
    version: '1.0.0',
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    hosts: ['www.google.com'],
    slots: [
      {
        key: 'query',
        label: 'Search query',
        type: 'string',
        default: 'quokka browser automation',
      },
    ],
    guards: [],
    steps: [
      {
        type: 'navigate',
        url: 'https://www.google.com',
        description: 'Open Google',
      },
      {
        type: 'type',
        target: { css: 'textarea[name="q"], input[name="q"]' },
        value: '{{query}}',
        description: 'Type search query',
      },
      {
        type: 'click',
        target: { css: 'input[name="btnK"], button[type="submit"]' },
        description: 'Click search button',
      },
      {
        type: 'wait',
        target: { css: '#search' },
        timeout: 5000,
        description: 'Wait for results',
      },
    ],
    meta: { createdFrom: 'code', tags: ['demo', 'search'], isDemo: true },
  },
  {
    id: 'demo-check-page-title',
    name: 'Check Page Title',
    description:
      'Extract the current page title. Works on any page — a quick way to see extraction in action.',
    version: '1.0.0',
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    hosts: [],
    slots: [],
    guards: [],
    steps: [
      {
        type: 'extract',
        target: { css: 'title' },
        as: 'pageTitle',
        description: 'Extract the page title',
      },
    ],
    meta: { createdFrom: 'code', tags: ['demo', 'extract'], isDemo: true },
  },
  {
    id: 'demo-fill-form',
    name: 'Fill a Form',
    description:
      'Demonstrates parameterized input with slots. Fill any form field on the current page.',
    version: '1.0.0',
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    hosts: [],
    slots: [
      {
        key: 'name',
        label: 'Your name',
        type: 'string',
        default: 'Quokka User',
      },
      {
        key: 'email',
        label: 'Email address',
        type: 'string',
        default: 'user@example.com',
      },
    ],
    guards: [],
    steps: [
      {
        type: 'type',
        target: { css: 'input[name="name"], input[type="text"]' },
        value: '{{name}}',
        description: 'Fill in name field',
      },
      {
        type: 'type',
        target: { css: 'input[name="email"], input[type="email"]' },
        value: '{{email}}',
        description: 'Fill in email field',
      },
    ],
    meta: { createdFrom: 'code', tags: ['demo', 'forms', 'slots'], isDemo: true },
  },
]

/**
 * Domain-to-recipe suggestions for onInstalled starter packs.
 * Maps domain substrings to a suggested recipe that gets surfaced
 * at the top of the library with a "Suggested for this site" badge.
 */
export interface StarterSuggestion {
  domainMatch: string
  recipe: Recipe
}

export const STARTER_SUGGESTIONS: StarterSuggestion[] = [
  {
    domainMatch: 'linkedin.com',
    recipe: {
      id: 'starter-linkedin-profile',
      name: 'Extract LinkedIn Profile',
      description: 'Extract name and headline from a LinkedIn profile page.',
      version: '1.0.0',
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      hosts: ['www.linkedin.com'],
      slots: [],
      guards: [{ type: 'url', expect: 'linkedin.com/in/', timeout: 5000 }],
      steps: [
        {
          type: 'extract',
          target: { css: 'h1' },
          as: 'profileName',
          description: 'Extract profile name',
        },
        {
          type: 'extract',
          target: { css: '.text-body-medium' },
          as: 'headline',
          description: 'Extract headline',
        },
      ],
      meta: {
        createdFrom: 'code',
        tags: ['starter', 'linkedin', 'hr'],
        isDemo: true,
        suggestedFor: 'linkedin.com',
      },
    },
  },
  {
    domainMatch: 'github.com',
    recipe: {
      id: 'starter-github-repo',
      name: 'Extract GitHub Repo Info',
      description: 'Extract the repo name, description, and star count.',
      version: '1.0.0',
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      hosts: ['github.com'],
      slots: [],
      guards: [],
      steps: [
        {
          type: 'extract',
          target: { css: '[itemprop="name"] a, strong[itemprop="name"]' },
          as: 'repoName',
          description: 'Extract repo name',
        },
        {
          type: 'extract',
          target: { css: '#repo-stars-counter-star' },
          as: 'stars',
          description: 'Extract star count',
        },
      ],
      meta: {
        createdFrom: 'code',
        tags: ['starter', 'github', 'dev'],
        isDemo: true,
        suggestedFor: 'github.com',
      },
    },
  },
  {
    domainMatch: 'hubspot.com',
    recipe: {
      id: 'starter-hubspot-contact',
      name: 'Extract HubSpot Contact',
      description: 'Extract contact name and email from a HubSpot CRM record.',
      version: '1.0.0',
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      hosts: ['app.hubspot.com'],
      slots: [],
      guards: [{ type: 'url', expect: 'hubspot.com', timeout: 5000 }],
      steps: [
        {
          type: 'extract',
          target: { css: '[data-test-id="contact-name"], h1' },
          as: 'contactName',
          description: 'Extract contact name',
        },
      ],
      meta: {
        createdFrom: 'code',
        tags: ['starter', 'hubspot', 'sales'],
        isDemo: true,
        suggestedFor: 'hubspot.com',
      },
    },
  },
]

/**
 * Find a starter suggestion matching the given URL's domain.
 */
export function findStarterForUrl(url: string): StarterSuggestion | undefined {
  try {
    const hostname = new URL(url).hostname
    return STARTER_SUGGESTIONS.find((s) => hostname.includes(s.domainMatch))
  } catch {
    return undefined
  }
}
