import type { Recipe } from '@quokka/shared'

export const fillFormRecipe: Recipe = {
  id: 'fill-demo-form',
  name: 'Fill Demo Form',
  description: 'Navigate to a demo form, fill in fields, and submit',
  version: '0.1.0',
  schemaVersion: 1,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  hosts: ['httpbin.org'],
  slots: [
    {
      key: 'url',
      label: 'Form URL',
      type: 'string',
      default: 'https://httpbin.org/forms/post',
    },
    {
      key: 'name',
      label: 'Customer Name',
      type: 'string',
    },
    {
      key: 'email',
      label: 'Email Address',
      type: 'string',
    },
  ],
  guards: [
    {
      type: 'dom',
      selector: 'form',
      expect: 'exists',
      timeout: 5000,
    },
  ],
  steps: [
    {
      type: 'navigate',
      url: '{{url}}',
      description: 'Navigate to the demo form',
    },
    {
      type: 'type',
      target: { css: 'input[name="custname"]' },
      value: '{{name}}',
      description: 'Type customer name',
    },
    {
      type: 'type',
      target: { css: 'input[name="custemail"]' },
      value: '{{email}}',
      description: 'Type email address',
    },
    {
      type: 'checkpoint',
      message: 'About to submit form — review and continue?',
    },
    {
      type: 'click',
      target: { css: 'button[type="submit"], input[type="submit"]' },
      description: 'Click submit button',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'forms'],
    pack: 'getting-started',
  },
}
