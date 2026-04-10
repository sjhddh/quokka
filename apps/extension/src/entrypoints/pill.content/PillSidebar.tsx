import { useState, useEffect } from 'react'
import { MessageType, sendToBackground } from '../../lib/messaging'
import type { Recipe } from '@quokka/shared'

interface PillSidebarProps {
  isRecording: boolean
  onToggleRecording: () => void
  onClose: () => void
}

export default function PillSidebar({
  isRecording,
  onToggleRecording,
  onClose,
}: PillSidebarProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    loadRecipes()
  }, [])

  async function loadRecipes() {
    try {
      const resp = await sendToBackground<{ ok: boolean; recipes: Recipe[] }>({
        type: MessageType.GET_RECIPES,
      })
      if (resp?.recipes) {
        setRecipes(resp.recipes)
        setConnected(true)
      }
    } catch {
      setConnected(false)
    }
  }

  async function handleRun(recipeId: string) {
    try {
      await sendToBackground({
        type: MessageType.START_RUN,
        payload: { recipeId, slotValues: {} },
      })
    } catch {
      // Run failed
    }
  }

  return (
    <div className="sidebar-overlay">
      {/* Header */}
      <div className="sidebar-header">
        <span className="sidebar-title">Quokka</span>
        <button className="sidebar-close" onClick={onClose}>
          &times;
        </button>
      </div>

      {/* Actions */}
      <div className="sidebar-actions">
        <button
          className={`btn btn-record ${isRecording ? 'active' : ''}`}
          onClick={onToggleRecording}
        >
          {isRecording ? 'Stop Recording' : 'Record'}
        </button>
        <button
          className="btn btn-run"
          disabled={!selectedId}
          onClick={() => selectedId && handleRun(selectedId)}
        >
          Run
        </button>
        <button
          className="btn btn-settings"
          onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_POPUP' })}
          title="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Recipe list */}
      <div className="recipe-list">
        {recipes.length === 0 ? (
          <div className="empty-state">
            No recipes yet. Hit Record to create one.
          </div>
        ) : (
          recipes.map((recipe) => (
            <div
              key={recipe.id}
              className={`recipe-item ${selectedId === recipe.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(recipe.id)}
            >
              <div className="recipe-info">
                <div className="recipe-name">{recipe.name}</div>
                <div className="recipe-meta">
                  {recipe.steps.length} step{recipe.steps.length !== 1 ? 's' : ''}
                  {recipe.hosts.length > 0 && ` · ${recipe.hosts[0]}`}
                </div>
              </div>
              <button
                className="recipe-run-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRun(recipe.id)
                }}
              >
                Run
              </button>
            </div>
          ))
        )}
      </div>

      {/* Status bar */}
      <div className="sidebar-status">
        <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
        {connected ? 'Companion connected' : 'Companion offline'}
      </div>
    </div>
  )
}
