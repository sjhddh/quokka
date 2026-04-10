import type { Recipe, Pack } from '@quokka/shared'

export const hrLinkedInScrapeRecipe: Recipe = {
  id: 'starter-hr-linkedin-scrape',
  name: 'LinkedIn Profile Scraper',
  description: 'Extract name, title, and company from a LinkedIn profile page',
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
      description: 'Wait for profile header to load',
    },
    {
      type: 'extract',
      target: { css: 'h1.text-heading-xlarge' },
      as: 'fullName',
      description: 'Extract the full name',
    },
    {
      type: 'extract',
      target: { css: 'div.text-body-medium.break-words' },
      as: 'headline',
      description: 'Extract the headline/title',
    },
    {
      type: 'extract',
      target: { css: 'span.pv-text-details__right-panel-item-text' },
      as: 'company',
      description: 'Extract the current company',
    },
    {
      type: 'checkpoint',
      message: 'Profile data extracted — save to clipboard?',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'hr', 'linkedin', 'scraping'],
    pack: 'starter-hr',
  },
}

export const hrJobPostingAutoFillRecipe: Recipe = {
  id: 'starter-hr-job-autofill',
  name: 'Job Posting Auto-Fill',
  description: 'Auto-fill job application forms on Indeed and LinkedIn with candidate details',
  version: '1.0.0',
  schemaVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: ['indeed.com', 'www.indeed.com', 'linkedin.com', 'www.linkedin.com'],
  slots: [
    { key: 'firstName', label: 'First Name', type: 'string' },
    { key: 'lastName', label: 'Last Name', type: 'string' },
    { key: 'email', label: 'Email Address', type: 'string' },
    { key: 'phone', label: 'Phone Number', type: 'string' },
    { key: 'resumeNotes', label: 'Resume Summary', type: 'string' },
  ],
  guards: [
    { type: 'url', expect: 'indeed.com|linkedin.com', timeout: 5000 },
  ],
  steps: [
    {
      type: 'wait',
      target: { css: 'input[name="firstName"], input[id="first-name-input"]' },
      timeout: 8000,
      description: 'Wait for application form to load',
    },
    {
      type: 'type',
      target: { css: 'input[name="firstName"], input[id="first-name-input"]' },
      value: '{{firstName}}',
      description: 'Fill first name',
    },
    {
      type: 'type',
      target: { css: 'input[name="lastName"], input[id="last-name-input"]' },
      value: '{{lastName}}',
      description: 'Fill last name',
    },
    {
      type: 'type',
      target: { css: 'input[name="email"], input[type="email"]' },
      value: '{{email}}',
      description: 'Fill email address',
    },
    {
      type: 'type',
      target: { css: 'input[name="phone"], input[type="tel"]' },
      value: '{{phone}}',
      description: 'Fill phone number',
    },
    {
      type: 'checkpoint',
      message: 'Form filled — review and submit manually?',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'hr', 'job-application', 'autofill'],
    pack: 'starter-hr',
  },
}

export const hrCandidateEmailRecipe: Recipe = {
  id: 'starter-hr-candidate-email',
  name: 'Candidate Email Template Auto-Send',
  description: 'Compose and send a templated email to a candidate via Gmail',
  version: '1.0.0',
  schemaVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: ['mail.google.com'],
  slots: [
    { key: 'candidateEmail', label: 'Candidate Email', type: 'string' },
    { key: 'candidateName', label: 'Candidate Name', type: 'string' },
    { key: 'position', label: 'Position Title', type: 'string' },
    { key: 'companyName', label: 'Company Name', type: 'string' },
  ],
  guards: [
    { type: 'url', expect: 'mail.google.com', timeout: 5000 },
  ],
  steps: [
    {
      type: 'click',
      target: { css: 'div.T-I.T-I-KE.L3', ariaLabel: 'Compose' },
      description: 'Click the Compose button',
    },
    {
      type: 'wait',
      target: { css: 'textarea[name="to"]' },
      timeout: 5000,
      description: 'Wait for compose window to open',
    },
    {
      type: 'type',
      target: { css: 'textarea[name="to"]' },
      value: '{{candidateEmail}}',
      description: 'Enter recipient email',
    },
    {
      type: 'type',
      target: { css: 'input[name="subjectbox"]' },
      value: 'Regarding the {{position}} role at {{companyName}}',
      description: 'Fill in subject line',
    },
    {
      type: 'type',
      target: { css: 'div[aria-label="Message Body"]' },
      value: 'Hi {{candidateName}},\n\nThank you for your interest in the {{position}} position at {{companyName}}. We would love to schedule a conversation with you.\n\nPlease let us know your availability this week.\n\nBest regards',
      description: 'Fill in email body from template',
    },
    {
      type: 'checkpoint',
      message: 'Email composed — review and send?',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'hr', 'email', 'recruiting'],
    pack: 'starter-hr',
  },
}

export const hrRecipes = [
  hrLinkedInScrapeRecipe,
  hrJobPostingAutoFillRecipe,
  hrCandidateEmailRecipe,
]

export const hrPack: Pack = {
  id: 'starter-hr',
  name: 'HR & Recruiting',
  description: 'Automate recruiting workflows: scrape profiles, fill applications, and send candidate emails',
  version: '1.0.0',
  recipeIds: hrRecipes.map((r) => r.id),
}
