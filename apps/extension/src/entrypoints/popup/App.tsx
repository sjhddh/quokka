import { useState, useEffect } from 'react'
import { useQuokkaStore } from '../../store'
import QuickRun from './components/QuickRun'
import WatchMe from './components/WatchMe'
import RecipeLibrary from './components/RecipeLibrary'
import DoMode from './components/DoMode'
import CheckpointDialog from './components/CheckpointDialog'
import LLMSettings from './components/LLMSettings'

const TABS = ['Quick Run', 'Watch Me', 'Recipes', 'Do'] as const
type Tab = (typeof TABS)[number]

const TAB_ICONS: Record<Tab, string> = {
  'Quick Run': '',
  'Watch Me': '',
  Recipes: '',
  Do: '\u2728',
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Quick Run')
  const [showSettings, setShowSettings] = useState(false)
  const fetchRecipes = useQuokkaStore((s) => s.fetchRecipes)
  const companionConnected = useQuokkaStore((s) => s.companionConnected)
  const useLocalRuntime = useQuokkaStore((s) => s.useLocalRuntime)
  const setUseLocalRuntime = useQuokkaStore((s) => s.setUseLocalRuntime)

  useEffect(() => {
    fetchRecipes()
  }, [fetchRecipes])

  return (
    <div className="w-[380px] min-h-[480px] bg-gray-50 flex flex-col relative">
      <CheckpointDialog />
      {showSettings && <LLMSettings onClose={() => setShowSettings(false)} />}

      {/* Header */}
      <header className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">Quokka</span>
          <span className="text-xs opacity-70">task automation</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="text-white/70 hover:text-white transition-colors"
            title="Provider settings"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            onClick={() => setUseLocalRuntime(!useLocalRuntime)}
            className={`text-xs px-1.5 py-0.5 rounded ${
              useLocalRuntime
                ? 'bg-green-500/30 text-green-200'
                : 'bg-white/20 text-white/70'
            }`}
            title={useLocalRuntime ? 'Local runtime (click to switch to companion)' : 'Companion mode (click to switch to local)'}
          >
            {useLocalRuntime ? 'Local' : 'Remote'}
          </button>
          <span
            className={`w-2 h-2 rounded-full ${companionConnected ? 'bg-green-400' : 'bg-red-400'}`}
            title={companionConnected ? 'Companion connected' : 'Companion offline'}
          />
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex border-b border-gray-200 bg-white">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {TAB_ICONS[tab] ? `${TAB_ICONS[tab]} ${tab}` : tab}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-3">
        {activeTab === 'Quick Run' && <QuickRun />}
        {activeTab === 'Watch Me' && <WatchMe />}
        {activeTab === 'Recipes' && <RecipeLibrary />}
        {activeTab === 'Do' && <DoMode />}
      </main>
    </div>
  )
}
