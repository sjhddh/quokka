import type { Recipe } from '@quokka/shared'

export const extractLinksRecipe: Recipe = {
  id: 'extract-page-links',
  name: 'Extract Page Links',
  description: 'Navigate to a URL and extract all link hrefs from the page',
  version: '0.1.0',
  schemaVersion: 1,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  hosts: ['*'],
  slots: [
    {
      key: 'url',
      label: 'Page URL',
      type: 'string',
    },
  ],
  guards: [
    {
      type: 'url',
      expect: '{{url}}',
      timeout: 5000,
    },
  ],
  steps: [
    {
      type: 'navigate',
      url: '{{url}}',
      description: 'Navigate to the target page',
    },
    {
      type: 'extract',
      target: { css: 'a[href]' },
      as: 'links',
      description: 'Extract all link hrefs from the page',
    },
    {
      type: 'checkpoint',
      message: 'Found links — save results?',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'extraction'],
    pack: 'getting-started',
  },
}
