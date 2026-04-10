import type { ModelProvider, ProviderConfig } from '../provider.js'

export class MockProvider implements ModelProvider {
  constructor(private config: ProviderConfig) {}

  async complete(
    prompt: string,
    _options?: { system?: string; temperature?: number }
  ): Promise<string> {
    const lower = prompt.toLowerCase()

    if (lower.includes('compile') || lower.includes('name')) {
      return 'auto-login-flow'
    }

    if (lower.includes('plan') || lower.includes('step')) {
      return [
        '1. Navigate to the login page',
        '2. Fill in the username field',
        '3. Fill in the password field',
        '4. Click the submit button',
        '5. Verify the dashboard loaded',
      ].join('\n')
    }

    return `mock-response-from-${this.config.id}`
  }
}
