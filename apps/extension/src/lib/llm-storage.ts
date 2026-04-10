import type { ProviderConfig } from './api'

const STORAGE_KEY = 'quokka_providers'
const ACTIVE_PROVIDER_KEY = 'quokka_active_provider'

export async function getProviders(): Promise<ProviderConfig[]> {
  const result = await chrome.storage.sync.get(STORAGE_KEY)
  return (result[STORAGE_KEY] as ProviderConfig[] | undefined) ?? []
}

export async function saveProvider(config: ProviderConfig): Promise<void> {
  const providers = await getProviders()
  const idx = providers.findIndex((p) => p.id === config.id)
  if (idx >= 0) {
    providers[idx] = config
  } else {
    providers.push(config)
  }
  await chrome.storage.sync.set({ [STORAGE_KEY]: providers })
}

export async function deleteProvider(id: string): Promise<void> {
  const providers = await getProviders()
  const filtered = providers.filter((p) => p.id !== id)
  await chrome.storage.sync.set({ [STORAGE_KEY]: filtered })

  // If the deleted provider was active, clear active
  const activeId = await getActiveProviderId()
  if (activeId === id) {
    await chrome.storage.sync.remove(ACTIVE_PROVIDER_KEY)
  }
}

async function getActiveProviderId(): Promise<string | null> {
  const result = await chrome.storage.sync.get(ACTIVE_PROVIDER_KEY)
  return (result[ACTIVE_PROVIDER_KEY] as string | undefined) ?? null
}

export async function getActiveProvider(): Promise<ProviderConfig | null> {
  const activeId = await getActiveProviderId()
  if (!activeId) return null
  const providers = await getProviders()
  return providers.find((p) => p.id === activeId) ?? null
}

export async function setActiveProvider(id: string): Promise<void> {
  await chrome.storage.sync.set({ [ACTIVE_PROVIDER_KEY]: id })
}
