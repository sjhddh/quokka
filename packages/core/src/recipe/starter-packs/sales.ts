import type { Recipe, Pack } from '@quokka/shared'

export const salesCrmContactRecipe: Recipe = {
  id: 'starter-sales-crm-contact',
  name: 'CRM Contact Entry',
  description: 'Create a new contact in HubSpot CRM with provided details',
  version: '1.0.0',
  schemaVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: ['app.hubspot.com'],
  slots: [
    { key: 'contactName', label: 'Contact Full Name', type: 'string' },
    { key: 'contactEmail', label: 'Contact Email', type: 'string' },
    { key: 'contactPhone', label: 'Contact Phone', type: 'string' },
    { key: 'companyName', label: 'Company Name', type: 'string' },
  ],
  guards: [
    { type: 'url', expect: 'app.hubspot.com', timeout: 5000 },
  ],
  steps: [
    {
      type: 'navigate',
      url: 'https://app.hubspot.com/contacts',
      description: 'Navigate to HubSpot contacts page',
    },
    {
      type: 'click',
      target: { css: 'button[data-test-id="create-object-button"]', ariaLabel: 'Create contact' },
      description: 'Click Create Contact button',
    },
    {
      type: 'wait',
      target: { css: 'input[data-field="firstname"]' },
      timeout: 5000,
      description: 'Wait for contact form to open',
    },
    {
      type: 'type',
      target: { css: 'input[data-field="email"]' },
      value: '{{contactEmail}}',
      description: 'Enter contact email',
    },
    {
      type: 'type',
      target: { css: 'input[data-field="firstname"]' },
      value: '{{contactName}}',
      description: 'Enter contact name',
    },
    {
      type: 'type',
      target: { css: 'input[data-field="phone"]' },
      value: '{{contactPhone}}',
      description: 'Enter contact phone',
    },
    {
      type: 'type',
      target: { css: 'input[data-field="company"]' },
      value: '{{companyName}}',
      description: 'Enter company name',
    },
    {
      type: 'checkpoint',
      message: 'Contact details filled — create contact?',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'sales', 'crm', 'hubspot'],
    pack: 'starter-sales',
  },
}

export const salesLeadEnrichmentRecipe: Recipe = {
  id: 'starter-sales-lead-enrichment',
  name: 'Lead Enrichment from LinkedIn',
  description: 'Extract company and contact details from a LinkedIn profile to enrich your lead data',
  version: '1.0.0',
  schemaVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: ['linkedin.com', 'www.linkedin.com'],
  slots: [
    { key: 'profileUrl', label: 'LinkedIn Profile URL', type: 'string' },
  ],
  guards: [
    { type: 'url', expect: 'linkedin.com/in/', timeout: 5000 },
  ],
  steps: [
    {
      type: 'navigate',
      url: '{{profileUrl}}',
      description: 'Navigate to the LinkedIn profile',
    },
    {
      type: 'wait',
      target: { css: 'div.pv-text-details__left-panel' },
      timeout: 8000,
      description: 'Wait for profile to load',
    },
    {
      type: 'extract',
      target: { css: 'h1.text-heading-xlarge' },
      as: 'name',
      description: 'Extract lead name',
    },
    {
      type: 'extract',
      target: { css: 'div.text-body-medium.break-words' },
      as: 'title',
      description: 'Extract job title',
    },
    {
      type: 'scroll',
      target: { css: 'section.artdeco-card.pv-profile-card' },
      description: 'Scroll to experience section',
    },
    {
      type: 'extract',
      target: { css: 'div.display-flex.align-items-center span[aria-hidden="true"]' },
      as: 'experience',
      description: 'Extract experience details',
    },
    {
      type: 'checkpoint',
      message: 'Lead data enriched — copy to CRM?',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'sales', 'linkedin', 'enrichment'],
    pack: 'starter-sales',
  },
}

export const salesInvoiceDownloadRecipe: Recipe = {
  id: 'starter-sales-invoice-download',
  name: 'Invoice PDF Download',
  description: 'Navigate to Stripe dashboard and download an invoice PDF',
  version: '1.0.0',
  schemaVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: ['dashboard.stripe.com'],
  slots: [
    { key: 'invoiceId', label: 'Invoice ID', type: 'string' },
  ],
  guards: [
    { type: 'url', expect: 'dashboard.stripe.com', timeout: 5000 },
  ],
  steps: [
    {
      type: 'navigate',
      url: 'https://dashboard.stripe.com/invoices/{{invoiceId}}',
      description: 'Navigate to the invoice page',
    },
    {
      type: 'wait',
      target: { css: 'div[data-testid="invoice-detail-header"]' },
      timeout: 8000,
      description: 'Wait for invoice details to load',
    },
    {
      type: 'extract',
      target: { css: 'span[data-testid="invoice-amount"]' },
      as: 'invoiceAmount',
      description: 'Extract invoice amount for verification',
    },
    {
      type: 'click',
      target: { css: 'button[data-testid="download-invoice-pdf"]', ariaLabel: 'Download PDF' },
      description: 'Click Download PDF button',
    },
    {
      type: 'checkpoint',
      message: 'Invoice PDF download initiated — verify file?',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'sales', 'invoicing', 'stripe'],
    pack: 'starter-sales',
  },
}

export const salesRecipes = [
  salesCrmContactRecipe,
  salesLeadEnrichmentRecipe,
  salesInvoiceDownloadRecipe,
]

export const salesPack: Pack = {
  id: 'starter-sales',
  name: 'Sales',
  description: 'Automate sales workflows: CRM entry, lead enrichment, and invoice management',
  version: '1.0.0',
  recipeIds: salesRecipes.map((r) => r.id),
}
