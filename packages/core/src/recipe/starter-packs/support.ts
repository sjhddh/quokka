import type { Recipe, Pack } from '@quokka/shared'

export const supportTicketCategorizeRecipe: Recipe = {
  id: 'starter-support-ticket-categorize',
  name: 'Ticket Auto-Categorize',
  description: 'Read a Zendesk ticket subject and body, then set the category/priority fields',
  version: '1.0.0',
  schemaVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: ['*.zendesk.com'],
  slots: [
    { key: 'category', label: 'Ticket Category', type: 'string', default: 'General' },
    { key: 'priority', label: 'Priority Level', type: 'string', default: 'Normal' },
  ],
  guards: [
    { type: 'url', expect: 'zendesk.com/agent/tickets/', timeout: 5000 },
  ],
  steps: [
    {
      type: 'wait',
      target: { css: 'div[data-test-id="ticket-pane"]' },
      timeout: 8000,
      description: 'Wait for ticket pane to load',
    },
    {
      type: 'extract',
      target: { css: 'input[data-test-id="ticket-pane-subject"]' },
      as: 'ticketSubject',
      description: 'Extract ticket subject',
    },
    {
      type: 'extract',
      target: { css: 'div[data-test-id="omni-log-container"] div.zd-comment' },
      as: 'ticketBody',
      description: 'Extract ticket body content',
    },
    {
      type: 'click',
      target: { css: 'div[data-test-id="ticket-fields-category"] button' },
      description: 'Open category dropdown',
    },
    {
      type: 'click',
      target: { css: 'li[data-test-id="dropdown-option"]', text: '{{category}}' },
      description: 'Select the category',
    },
    {
      type: 'click',
      target: { css: 'div[data-test-id="ticket-fields-priority"] button' },
      description: 'Open priority dropdown',
    },
    {
      type: 'click',
      target: { css: 'li[data-test-id="dropdown-option"]', text: '{{priority}}' },
      description: 'Select the priority',
    },
    {
      type: 'checkpoint',
      message: 'Ticket categorized — submit changes?',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'support', 'zendesk', 'categorization'],
    pack: 'starter-support',
  },
}

export const supportCannedResponseRecipe: Recipe = {
  id: 'starter-support-canned-response',
  name: 'Canned Response Inserter',
  description: 'Insert a pre-written response template into a Freshdesk reply editor',
  version: '1.0.0',
  schemaVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: ['*.freshdesk.com'],
  slots: [
    { key: 'customerName', label: 'Customer Name', type: 'string' },
    { key: 'responseTemplate', label: 'Response Text', type: 'string', default: 'Thank you for reaching out. We are looking into your request and will get back to you shortly.' },
  ],
  guards: [
    { type: 'url', expect: 'freshdesk.com/a/tickets/', timeout: 5000 },
  ],
  steps: [
    {
      type: 'wait',
      target: { css: 'div.ticket-detail' },
      timeout: 8000,
      description: 'Wait for ticket page to load',
    },
    {
      type: 'click',
      target: { css: 'a[data-action="reply"]' },
      description: 'Click Reply button',
    },
    {
      type: 'wait',
      target: { css: 'div.redactor-editor[contenteditable="true"]' },
      timeout: 5000,
      description: 'Wait for reply editor to appear',
    },
    {
      type: 'type',
      target: { css: 'div.redactor-editor[contenteditable="true"]' },
      value: 'Hi {{customerName}},\n\n{{responseTemplate}}\n\nBest regards',
      description: 'Insert the canned response',
    },
    {
      type: 'checkpoint',
      message: 'Response inserted — review and send?',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'support', 'freshdesk', 'canned-response'],
    pack: 'starter-support',
  },
}

export const supportCustomerLookupRecipe: Recipe = {
  id: 'starter-support-customer-lookup',
  name: 'Customer Info Lookup',
  description: 'Look up customer details in Zendesk by searching name or email',
  version: '1.0.0',
  schemaVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: ['*.zendesk.com'],
  slots: [
    { key: 'searchQuery', label: 'Customer Name or Email', type: 'string' },
  ],
  guards: [
    { type: 'url', expect: 'zendesk.com', timeout: 5000 },
  ],
  steps: [
    {
      type: 'click',
      target: { css: 'button[data-test-id="search-icon"]', ariaLabel: 'Search' },
      description: 'Open the search bar',
    },
    {
      type: 'type',
      target: { css: 'input[data-test-id="search-input"]' },
      value: '{{searchQuery}}',
      description: 'Type the search query',
    },
    {
      type: 'wait',
      target: { css: 'div[data-test-id="search-results"]' },
      timeout: 5000,
      description: 'Wait for search results to appear',
    },
    {
      type: 'click',
      target: { css: 'div[data-test-id="search-results"] a.user-result:first-child' },
      description: 'Click the first matching customer result',
    },
    {
      type: 'wait',
      target: { css: 'div[data-test-id="user-profile"]' },
      timeout: 5000,
      description: 'Wait for customer profile to load',
    },
    {
      type: 'extract',
      target: { css: 'div[data-test-id="user-profile"] span.name' },
      as: 'customerName',
      description: 'Extract customer name',
    },
    {
      type: 'extract',
      target: { css: 'div[data-test-id="user-profile"] span.email' },
      as: 'customerEmail',
      description: 'Extract customer email',
    },
    {
      type: 'checkpoint',
      message: 'Customer info retrieved — copy details?',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'support', 'zendesk', 'lookup'],
    pack: 'starter-support',
  },
}

export const supportRecipes = [
  supportTicketCategorizeRecipe,
  supportCannedResponseRecipe,
  supportCustomerLookupRecipe,
]

export const supportPack: Pack = {
  id: 'starter-support',
  name: 'Customer Support',
  description: 'Automate support workflows: ticket categorization, canned responses, and customer lookup',
  version: '1.0.0',
  recipeIds: supportRecipes.map((r) => r.id),
}
