import type { Recipe, Pack } from '@quokka/shared'

export const dataEntryFormFillerRecipe: Recipe = {
  id: 'starter-data-entry-form-filler',
  name: 'Spreadsheet-to-Form Filler',
  description: 'Fill a web form with values from a spreadsheet row via slot parameters',
  version: '1.0.0',
  schemaVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: ['docs.google.com', 'forms.google.com'],
  slots: [
    { key: 'field1', label: 'Field 1 Value', type: 'string' },
    { key: 'field2', label: 'Field 2 Value', type: 'string' },
    { key: 'field3', label: 'Field 3 Value', type: 'string' },
    { key: 'formUrl', label: 'Google Form URL', type: 'string' },
  ],
  guards: [
    { type: 'url', expect: 'docs.google.com/forms|forms.google.com', timeout: 5000 },
  ],
  steps: [
    {
      type: 'navigate',
      url: '{{formUrl}}',
      description: 'Navigate to the Google Form',
    },
    {
      type: 'wait',
      target: { css: 'div.freebirdFormviewerViewFormCard' },
      timeout: 8000,
      description: 'Wait for form to load',
    },
    {
      type: 'type',
      target: { css: 'div.freebirdFormviewerComponentsQuestionTextRoot:nth-child(1) input.quantumWizTextinputPaperinputInput' },
      value: '{{field1}}',
      description: 'Fill the first form field',
    },
    {
      type: 'type',
      target: { css: 'div.freebirdFormviewerComponentsQuestionTextRoot:nth-child(2) input.quantumWizTextinputPaperinputInput' },
      value: '{{field2}}',
      description: 'Fill the second form field',
    },
    {
      type: 'type',
      target: { css: 'div.freebirdFormviewerComponentsQuestionTextRoot:nth-child(3) input.quantumWizTextinputPaperinputInput' },
      value: '{{field3}}',
      description: 'Fill the third form field',
    },
    {
      type: 'checkpoint',
      message: 'Form filled — review and submit?',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'data-entry', 'forms', 'google-forms'],
    pack: 'starter-data-entry',
  },
}

export const dataEntryConsolidationRecipe: Recipe = {
  id: 'starter-data-entry-consolidation',
  name: 'Multi-Tab Data Consolidation',
  description: 'Extract data from a web page table and consolidate into a Google Sheet',
  version: '1.0.0',
  schemaVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: ['docs.google.com', '*'],
  slots: [
    { key: 'sourceUrl', label: 'Source Page URL', type: 'string' },
    { key: 'sheetUrl', label: 'Google Sheet URL', type: 'string' },
  ],
  guards: [
    { type: 'url', expect: '.*', timeout: 5000 },
  ],
  steps: [
    {
      type: 'navigate',
      url: '{{sourceUrl}}',
      description: 'Navigate to the source data page',
    },
    {
      type: 'wait',
      target: { css: 'table, div[role="grid"]' },
      timeout: 8000,
      description: 'Wait for data table to load',
    },
    {
      type: 'extract',
      target: { css: 'table tbody tr, div[role="row"]' },
      as: 'tableRows',
      description: 'Extract all table row data',
    },
    {
      type: 'navigate',
      url: '{{sheetUrl}}',
      description: 'Navigate to the Google Sheet',
    },
    {
      type: 'wait',
      target: { css: 'div#docs-editor-container' },
      timeout: 8000,
      description: 'Wait for Google Sheet to load',
    },
    {
      type: 'click',
      target: { css: 'div.cell-input[data-row="0"][data-col="0"], td.s0:first-child' },
      description: 'Click first empty cell',
    },
    {
      type: 'checkpoint',
      message: 'Data extracted from source — paste into sheet?',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'data-entry', 'consolidation', 'google-sheets'],
    pack: 'starter-data-entry',
  },
}

export const dataEntryClipboardAutoFillRecipe: Recipe = {
  id: 'starter-data-entry-clipboard-autofill',
  name: 'Form Auto-Population from Clipboard',
  description: 'Fill form fields with values provided via slots, simulating clipboard paste into common form patterns',
  version: '1.0.0',
  schemaVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: ['*'],
  slots: [
    { key: 'name', label: 'Full Name', type: 'string' },
    { key: 'email', label: 'Email Address', type: 'string' },
    { key: 'address', label: 'Street Address', type: 'string' },
    { key: 'city', label: 'City', type: 'string' },
    { key: 'zip', label: 'ZIP/Postal Code', type: 'string' },
  ],
  guards: [
    { type: 'dom', selector: 'form', expect: 'visible', timeout: 5000 },
  ],
  steps: [
    {
      type: 'wait',
      target: { css: 'form' },
      timeout: 5000,
      description: 'Wait for form to be present on page',
    },
    {
      type: 'type',
      target: { css: 'input[name="name"], input[autocomplete="name"], input#name' },
      value: '{{name}}',
      description: 'Fill name field',
    },
    {
      type: 'type',
      target: { css: 'input[name="email"], input[type="email"], input[autocomplete="email"]' },
      value: '{{email}}',
      description: 'Fill email field',
    },
    {
      type: 'type',
      target: { css: 'input[name="address"], input[autocomplete="street-address"], input#address' },
      value: '{{address}}',
      description: 'Fill address field',
    },
    {
      type: 'type',
      target: { css: 'input[name="city"], input[autocomplete="address-level2"], input#city' },
      value: '{{city}}',
      description: 'Fill city field',
    },
    {
      type: 'type',
      target: { css: 'input[name="zip"], input[name="postalCode"], input[autocomplete="postal-code"]' },
      value: '{{zip}}',
      description: 'Fill ZIP code field',
    },
    {
      type: 'checkpoint',
      message: 'Form auto-populated — review and submit?',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'data-entry', 'autofill', 'clipboard'],
    pack: 'starter-data-entry',
  },
}

export const dataEntryRecipes = [
  dataEntryFormFillerRecipe,
  dataEntryConsolidationRecipe,
  dataEntryClipboardAutoFillRecipe,
]

export const dataEntryPack: Pack = {
  id: 'starter-data-entry',
  name: 'Data Entry Automation',
  description: 'Automate data entry workflows: form filling, data consolidation, and clipboard auto-population',
  version: '1.0.0',
  recipeIds: dataEntryRecipes.map((r) => r.id),
}
