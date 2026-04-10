import type { Recipe } from '@quokka/shared'

export const exportTableRecipe: Recipe = {
  id: 'export-table-data',
  name: 'Export Table Data',
  description: 'Navigate to a page and extract table text content',
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
      type: 'dom',
      selector: 'table',
      expect: 'exists',
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
      type: 'wait',
      target: { css: 'table' },
      timeout: 10000,
      description: 'Wait for table element to appear',
    },
    {
      type: 'extract',
      target: { css: 'table' },
      as: 'tableData',
      description: 'Extract table text content',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'extraction', 'tables'],
    pack: 'getting-started',
  },
}
