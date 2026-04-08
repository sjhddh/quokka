import { useState, useEffect } from 'react'
import { useQuokkaStore } from '../../store'
import QuickRun from './components/QuickRun'
import WatchMe from './components/WatchMe'
import RecipeLibrary from './components/RecipeLibrary'

const TABS = ['Quick Run', 'Watch Me', 'Recipes'] as const
type Tab = (typeof TABS)[number]

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Quick Run')
  const fetchRecipes = useQuokkaStore((s) => s.fetchRecipes)
  const companionConnected = useQuokkaStore((s) => s.companionConnected)

  useEffect(() => {
    fetchRecipes()
  }, [fetchRecipes])

  return (
    <div className="w-[380px] min-h-[480px] bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">Quokka</span>
          <span className="text-xs opacity-70">task automation</span>
        </div>
        <span
          className={`w-2 h-2 rounded-full ${companionConnected ? 'bg-green-400' : 'bg-red-400'}`}
          title={companionConnected ? 'Companion connected' : 'Companion offline'}
        />
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
            {tab}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-3">
        {activeTab === 'Quick Run' && <QuickRun />}
        {activeTab === 'Watch Me' && <WatchMe />}
        {activeTab === 'Recipes' && <RecipeLibrary />}
      </main>
    </div>
  )
}
