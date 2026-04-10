import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'Quokka',
    description: 'Watch once. Run forever. Browser-native task automation.',
    permissions: ['activeTab', 'scripting', 'storage', 'notifications'],
  },
})
